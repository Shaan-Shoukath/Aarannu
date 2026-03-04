/**
 * Webhook Controller
 * ══════════════════
 *
 * Handles incoming Google Form submissions via webhook.
 *
 * Flow:
 *   1. Validate webhook ID + secret from request.
 *   2. Map form fields to card data using the webhook's field_mapping.
 *   3. Render the card server-side via Puppeteer.
 *   4. Upload the card image to Supabase Storage.
 *   5. Insert a `generated_ids` row.
 *   6. (Optional) Email the card PDF to the member.
 *
 * Endpoint: POST /api/webhook/:webhookId
 * Headers:  X-Webhook-Secret: <secret>
 * Body:     Form field key-value pairs (from Google Apps Script)
 */

const {
  getWebhookConfigById,
  verifyWebhookSecret,
} = require("../services/webhookService");
const { renderCard } = require("../services/cardRenderer");
const { supabase } = require("../config/supabaseClient");
const { getExpiryDate, DEFAULT_EXPIRY_DAYS } = require("../utils/expiryHelper");
const { v4: uuidv4 } = require("uuid");
const { deductTokens, refundTokens } = require("../services/tokenService");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BUCKET = "id-cards";

/**
 * POST /api/webhook/:webhookId
 *
 * Receives a form submission, generates an ID card, and optionally emails it.
 */
const handleFormSubmission = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const providedSecret =
      req.headers["x-webhook-secret"] || req.query.secret || "";

    // ── 1. Fetch webhook config ─────────────────────────────
    const { data: config, error: configError } =
      await getWebhookConfigById(webhookId);

    if (configError || !config) {
      return res.status(404).json({
        error: "Not Found",
        message: "Webhook configuration not found.",
      });
    }

    if (!config.is_active) {
      return res.status(403).json({
        error: "Forbidden",
        message: "This webhook is currently disabled.",
      });
    }

    // ── 2. Verify secret ────────────────────────────────────
    if (!verifyWebhookSecret(providedSecret, config.secret)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid webhook secret.",
      });
    }

    // ── 2b. Deduct 1 token from webhook owner ───────────────
    const { error: tokenErr } = await deductTokens(
      config.user_id,
      1,
      `Webhook card generation – "${config.name}"`,
      `webhook_${webhookId}`,
    );
    if (tokenErr) {
      const status = tokenErr.code === "INSUFFICIENT_TOKENS" ? 402 : 500;
      return res.status(status).json({
        error:
          tokenErr.code === "INSUFFICIENT_TOKENS"
            ? "Insufficient Tokens"
            : "Token Error",
        message: tokenErr.message,
      });
    }

    // ── 3. Map form fields to card data ─────────────────────
    const formData = req.body;
    const mapping = config.field_mapping || {};

    // The field_mapping maps card fields to form field names:
    // { "name": "Full Name", "role": "Position", "email": "Email Address", ... }
    const cardData = {};
    const cardFields = [
      "name",
      "role",
      "id_number",
      "email",
      "dob",
      "gender",
      "blood_group",
      "photo_url",
      "address",
    ];

    for (const field of cardFields) {
      const formFieldName = mapping[field];
      if (formFieldName && formData[formFieldName] !== undefined) {
        cardData[field] = String(formData[formFieldName]).trim();
      }
    }

    // Map custom fields if defined
    if (mapping.customFields && typeof mapping.customFields === "object") {
      cardData.customValues = {};
      for (const [cardLabel, formField] of Object.entries(
        mapping.customFields,
      )) {
        if (formData[formField] !== undefined) {
          cardData.customValues[cardLabel] = String(formData[formField]).trim();
        }
      }
    }

    // Validate that at least name is present
    if (!cardData.name) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          'Missing required field: "name". Check your field_mapping configuration.',
      });
    }

    // Default role based on template
    if (!cardData.role) {
      const defaultRoles = {
        custom: "Member",
        corporate: "Employee",
        student: "Student",
        event: "VIP Guest",
      };
      cardData.role = defaultRoles[config.template] || "Member";
    }

    // Generate ID number if not provided
    if (!cardData.id_number) {
      const prefix =
        (config.org_name || "ORG")
          .replace(/[^A-Za-z]/g, "")
          .slice(0, 3)
          .toUpperCase() || "ORG";
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const seq = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
      cardData.id_number = `${prefix}-${yy}${mm}-${seq}`;
    }

    console.log(
      `[webhook] Processing submission for "${cardData.name}" via webhook "${config.name}"`,
    );

    // ── 4. Render card via Puppeteer ────────────────────────
    let renderResult;
    try {
      renderResult = await renderCard({
        data: cardData,
        template: config.template,
        orgName: config.org_name,
        logoUrl: config.logo_url,
        cardStyles: config.card_styles,
        gradientColors: config.gradient_colors,
        fieldVisibility: config.field_visibility,
        orientation: config.orientation,
        validityText: config.validity_text,
        watermark: config.watermark || {},
      });
    } catch (renderErr) {
      console.error("[webhook] Card render error:", renderErr.message);
      // Refund the token since rendering failed
      await refundTokens(
        config.user_id,
        1,
        `Refund – render failed: ${renderErr.message}`,
        `webhook_${webhookId}`,
      );
      return res.status(500).json({
        error: "Render Error",
        message: "Failed to render the ID card. Is the frontend running?",
      });
    }

    // ── 5. Upload to Supabase Storage ───────────────────────
    const rowId = uuidv4();
    const safeName =
      cardData.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "member";
    const timestamp = Date.now();
    const filePath = `webhook/${config.user_id}/${safeName}_${timestamp}_${rowId.slice(0, 8)}.png`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, renderResult.frontPng, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("[webhook] Storage upload error:", uploadError.message);
      // Refund the token since upload failed
      await refundTokens(
        config.user_id,
        1,
        `Refund – upload failed: ${uploadError.message}`,
        `webhook_${webhookId}`,
      );
      return res.status(500).json({
        error: "Storage Error",
        message: "Failed to upload generated card image.",
      });
    }

    // ── 6. Insert generated_ids metadata row ────────────────
    const expiryDays = config.expiry_days || DEFAULT_EXPIRY_DAYS;
    const { error: dbError } = await supabase.from("generated_ids").insert({
      id: rowId,
      user_id: config.user_id,
      file_url: filePath,
      expires_at: getExpiryDate(expiryDays),
    });

    if (dbError) {
      console.error("[webhook] DB insert error:", dbError.message);
      // Try to clean up the uploaded file
      await supabase.storage.from(BUCKET).remove([filePath]);
      // Refund the token since DB insert failed
      await refundTokens(
        config.user_id,
        1,
        `Refund – DB insert failed: ${dbError.message}`,
        `webhook_${webhookId}`,
      );
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to save card metadata.",
      });
    }

    // ── 7. Email the card (if auto_email enabled + email present) ──
    let emailSent = false;
    let emailError = null;

    if (
      config.auto_email &&
      cardData.email &&
      process.env.BREVO_API_KEY &&
      renderResult.pdfBase64
    ) {
      try {
        const senderEmail =
          process.env.BREVO_SENDER_EMAIL || "noreply@communityid.app";
        const senderName =
          process.env.BREVO_SENDER_NAME || config.org_name || "Community ID";
        const safeOrg = config.org_name || "Community ID";
        const attachmentName = `${safeName}_ID.pdf`;

        const payload = {
          sender: { name: senderName, email: senderEmail },
          to: [{ email: cardData.email, name: cardData.name }],
          subject: `Your ID Card from ${safeOrg}`,
          htmlContent: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1e293b; margin-bottom: 8px;">Hello ${cardData.name},</h2>
              <p style="color: #475569; line-height: 1.6;">
                Your digital ID card from <strong>${safeOrg}</strong> is attached to this email as a PDF.
              </p>
              <p style="color: #475569; line-height: 1.6;">
                This card was automatically generated when you submitted your registration form.
                Please keep this document safe.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 12px;">
                This is an automated email sent via ${safeOrg}'s Community ID Platform.
              </p>
            </div>
          `,
          attachment: [
            {
              content: renderResult.pdfBase64,
              name: attachmentName,
            },
          ],
        };

        const response = await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": process.env.BREVO_API_KEY,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          emailSent = true;
          console.log(
            `[webhook] Email sent to ${cardData.email} for "${cardData.name}"`,
          );
        } else {
          const errData = await response.json().catch(() => ({}));
          emailError = errData.message || `Brevo returned ${response.status}`;
          console.warn("[webhook] Email send failed:", emailError);
        }
      } catch (err) {
        emailError = err.message;
        console.warn("[webhook] Email error:", err.message);
      }
    }

    // ── 8. Respond ──────────────────────────────────────────
    return res.status(201).json({
      success: true,
      message: `ID card generated for "${cardData.name}".`,
      card: {
        id: rowId,
        file_path: filePath,
        member_name: cardData.name,
        template: config.template,
        email_sent: emailSent,
        email_error: emailError,
      },
    });
  } catch (err) {
    console.error("[webhook] Unexpected error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred processing the webhook.",
    });
  }
};

module.exports = { handleFormSubmission };
