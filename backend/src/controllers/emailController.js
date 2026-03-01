/**
 * Email Controller — Brevo (Sendinblue) Integration
 * ═══════════════════════════════════════════════════
 *
 * Sends generated ID card PDFs as email attachments via Brevo's
 * transactional email REST API (v3).
 *
 * Uses native `fetch` (Node 18+) — no extra SDK required.
 *
 * Required env vars:
 *   BREVO_API_KEY       — Your Brevo API key
 *
 * Optional env vars:
 *   BREVO_SENDER_EMAIL  — Sender email (default: noreply@communityid.app)
 *   BREVO_SENDER_NAME   — Sender display name (default: "Community ID")
 *
 * Endpoint: POST /api/email/send-card
 * Body:
 *   - recipientEmail  (string, required)
 *   - recipientName   (string, optional)
 *   - pdfBase64       (string, required) — base64-encoded PDF
 *   - fileName        (string, optional) — attachment filename
 *   - orgName         (string, optional) — organization name for subject
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * POST /api/email/send-card
 * Send an ID card PDF to a single recipient via Brevo.
 */
const sendCard = async (req, res) => {
  try {
    const { recipientEmail, recipientName, pdfBase64, fileName, orgName } =
      req.body;

    // ── Validation ──
    if (!recipientEmail || !pdfBase64) {
      return res.status(400).json({
        error: "Bad Request",
        message: "recipientEmail and pdfBase64 are required.",
      });
    }

    if (!process.env.BREVO_API_KEY) {
      return res.status(503).json({
        error: "Service Unavailable",
        message:
          "Brevo API key is not configured. Set BREVO_API_KEY in the backend environment.",
      });
    }

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid email address format.",
      });
    }

    // ── Build email payload for Brevo v3 API ──
    const senderEmail =
      process.env.BREVO_SENDER_EMAIL || "noreply@communityid.app";
    const senderName =
      process.env.BREVO_SENDER_NAME || orgName || "Community ID";
    const safeName = recipientName || "Member";
    const safeOrg = orgName || "Community ID";
    const attachmentName =
      fileName || `${safeName.replace(/[^a-zA-Z0-9]/g, "_")}_ID.pdf`;

    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipientEmail, name: safeName }],
      subject: `Your ID Card from ${safeOrg}`,
      htmlContent: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Hello ${safeName},</h2>
          <p style="color: #475569; line-height: 1.6;">
            Your digital ID card from <strong>${safeOrg}</strong> is attached to this email as a PDF.
          </p>
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

    // ── Send via Brevo REST API ──
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
      console.error("[email] Brevo API error:", response.status, data);
      return res
        .status(response.status >= 400 && response.status < 500 ? 400 : 502)
        .json({
          error: "Email Send Failed",
          message:
            data.message || `Brevo API returned status ${response.status}`,
        });
    }

    return res.status(200).json({
      success: true,
      messageId: data.messageId,
      message: `Email sent to ${recipientEmail}`,
    });
  } catch (err) {
    console.error("[email] Brevo send failed:", err?.message || err);
    return res.status(500).json({
      error: "Email Send Failed",
      message:
        err?.message || "An unexpected error occurred while sending the email.",
    });
  }
};

module.exports = { sendCard };
