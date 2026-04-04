/**
 * Email Controller - Brevo (Sendinblue) Integration
 * --------------------------------------------------
 * Sends generated ID card PDFs as email attachments via Brevo's
 * transactional email REST API (v3).
 *
 * The browser generates the PDF, but the backend owns Brevo credentials
 * and stores the final `sent` / `failed_send` result back onto
 * `project_members` so the admin dashboard can recover state after reload.
 */

const memberService = require("../services/projectMemberService");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const persistFailedSend = async (
  memberId,
  message,
  cardId = null,
  verificationUrl = "",
) => {
  if (!memberId) return null;

  const { data } = await memberService.updateMemberDelivery(memberId, {
    phase: "failed_send",
    error: message,
    cardId,
    verificationUrl,
  });

  return data || null;
};

/**
 * POST /api/email/send-card
 * Send an ID card PDF to a single recipient via Brevo.
 */
const sendCard = async (req, res) => {
  const {
    recipientEmail,
    recipientName,
    pdfBase64,
    fileName,
    orgName,
    projectName,
    memberId,
    cardId,
    verificationUrl,
  } = req.body || {};

  try {
    if (!recipientEmail || !pdfBase64) {
      const message = "recipientEmail and pdfBase64 are required.";
      await persistFailedSend(memberId, message, cardId, verificationUrl);
      return res.status(400).json({
        error: "Bad Request",
        message,
      });
    }

    if (!process.env.BREVO_API_KEY) {
      const message =
        "Brevo API key is not configured. Set BREVO_API_KEY in the backend environment.";
      await persistFailedSend(memberId, message, cardId, verificationUrl);
      return res.status(503).json({
        error: "Service Unavailable",
        message,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      const message = "Invalid email address format.";
      await persistFailedSend(memberId, message, cardId, verificationUrl);
      return res.status(400).json({
        error: "Bad Request",
        message,
      });
    }

    const senderEmail =
      process.env.BREVO_SENDER_EMAIL || "noreply@communityid.app";
    const senderName =
      process.env.BREVO_SENDER_NAME || orgName || "Community ID";
    const safeName = recipientName || "Member";
    const safeOrg = orgName || "Community ID";
    const safeProject = projectName || safeOrg;
    const attachmentName =
      fileName || `${safeName.replace(/[^a-zA-Z0-9]/g, "_")}_ID.pdf`;

    const verificationSection = verificationUrl
      ? `
          <p style="color: #475569; line-height: 1.6;">
            Verify your card here:
            <a href="${verificationUrl}" style="color: #2563eb; font-weight: 600;">
              ${verificationUrl}
            </a>
          </p>
        `
      : "";

    const cardIdSection = cardId
      ? `
          <p style="color: #475569; line-height: 1.6;">
            Card ID: <strong>${cardId}</strong>
          </p>
        `
      : "";

    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipientEmail, name: safeName }],
      subject: `Your ID Card from ${safeOrg}`,
      htmlContent: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Hello ${safeName},</h2>
          <p style="color: #475569; line-height: 1.6;">
            Your registration for <strong>${safeProject}</strong> has been approved.
            Your digital ID card from <strong>${safeOrg}</strong> is attached to this email as a PDF.
          </p>
          ${verificationSection}
          ${cardIdSection}
          <p style="color: #475569; line-height: 1.6;">
            Please keep this document safe. If you have questions about your ID card,
            contact your organization administrator.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">
            This is an automated email sent via ${safeOrg}'s Community ID Platform.
          </p>
        </div>
      `,
      attachment: [
        {
          content: pdfBase64,
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data.message || `Brevo API returned status ${response.status}`;
      console.error("[email] Brevo API error:", response.status, data);
      const member = await persistFailedSend(
        memberId,
        message,
        cardId,
        verificationUrl,
      );
      return res
        .status(response.status >= 400 && response.status < 500 ? 400 : 502)
        .json({
          error: "Email Send Failed",
          message,
          member,
        });
    }

    let member = null;
    if (memberId) {
      const { data: updatedMember } = await memberService.updateMemberDelivery(
        memberId,
        {
          phase: "sent",
          cardId,
          verificationUrl,
          messageId: data.messageId || "",
          emailSentAt: new Date().toISOString(),
          clearError: true,
        },
      );
      member = updatedMember || null;
    }

    return res.status(200).json({
      success: true,
      messageId: data.messageId,
      message: `Email sent to ${recipientEmail}`,
      member,
    });
  } catch (err) {
    const message =
      err?.message || "An unexpected error occurred while sending the email.";
    console.error("[email] Brevo send failed:", message);
    const member = await persistFailedSend(
      memberId,
      message,
      cardId,
      verificationUrl,
    );
    return res.status(500).json({
      error: "Email Send Failed",
      message,
      member,
    });
  }
};

module.exports = { sendCard };
