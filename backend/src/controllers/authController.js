/**
 * Auth Controller
 * ───────────────
 * Thin HTTP layer for authentication-related endpoints.
 *
 * The actual JWT verification happens in `verifyToken` middleware.
 * This controller provides a `/me` endpoint so the frontend can
 * confirm the token is valid and get the current user + member info.
 */

const { getMemberByUserId } = require("../services/supabaseService");

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile + member record.
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: member, error } = await getMemberByUserId(userId);

    if (error && error.code !== "PGRST116") {
      // PGRST116 = "no rows returned" — that's OK, user may not have a member row yet
      console.error("[authController.getMe] DB error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to fetch member profile.",
      });
    }

    return res.status(200).json({
      user: {
        id: req.user.id,
        email: req.user.email,
        created_at: req.user.created_at,
      },
      member: member || null,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe };
