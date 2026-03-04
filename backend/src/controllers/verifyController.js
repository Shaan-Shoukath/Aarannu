/**
 * Verify Controller
 * ─────────────────
 * Public endpoint for QR code verification.
 */

const generateService = require("../services/generateService");

/**
 * GET /api/verify/:cardId — Public QR verification
 */
const verifyCard = async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { data, error } =
      await generateService.getCardForVerification(cardId);

    if (error || !data) {
      return res.status(404).json({
        valid: false,
        error: "Card not found.",
      });
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    const isExpired = expiresAt < now;
    const isRevoked = data.status === "revoked";

    res.json({
      valid: !isExpired && !isRevoked,
      status: data.status,
      expired: isExpired,
      member: {
        name: data.project_members?.name,
        email: data.project_members?.email,
        photo_url: data.project_members?.photo_url,
        custom_fields: data.project_members?.custom_fields,
      },
      organization: {
        name: data.organizations?.name,
        logo_url: data.organizations?.logo_url,
        slug: data.organizations?.slug,
      },
      project: {
        name: data.projects?.name,
        type: data.projects?.type,
      },
      expires_at: data.expires_at,
      issued_at: data.created_at,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { verifyCard };
