/**
 * JWT Verification Middleware
 * ───────────────────────────
 * Extracts the Supabase JWT from the `Authorization: Bearer <token>` header,
 * verifies it against Supabase Auth, and attaches the decoded user object
 * to `req.user`.
 *
 * Why verify on the backend?
 *   - Never trust data that originates from the client.
 *   - RLS alone does NOT protect backend API routes.
 *   - This middleware is the single gate through which every
 *     authenticated request must pass.
 *
 * Security notes:
 *   - Uses `supabase.auth.getUser(token)` which makes a round-trip
 *     to Supabase Auth and returns a fresh user object (not just
 *     decoded claims).  This means revoked tokens are caught.
 *   - Token format: `Bearer eyJhbG...`
 */

const { supabase } = require("../config/supabaseClient");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing or malformed Authorization header.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token || token.length < 10) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token format.",
      });
    }

    // ── Verify against Supabase Auth ─────────────────────────
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token verification failed.",
      });
    }

    // Attach verified user to request for downstream handlers
    req.user = user;
    next();
  } catch (err) {
    console.error("[verifyToken] Unexpected error:", err.message);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Authentication check failed.",
    });
  }
};

module.exports = verifyToken;
