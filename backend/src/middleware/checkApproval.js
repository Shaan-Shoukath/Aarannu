/**
 * Approval Check Middleware
 * ─────────────────────────
 * Runs AFTER `verifyToken` — so `req.user` is guaranteed to exist.
 *
 * Queries the `members` table to confirm:
 *   1. A row exists for this user_id.
 *   2. `approved` is `true`.
 *
 * If either check fails the request is rejected with 403 Forbidden.
 *
 * Why not check this on the frontend?
 *   - The frontend can be tampered with.
 *   - This is a server-side gate that enforces business rules
 *     regardless of what the client sends.
 */

const { supabase } = require("../config/supabaseClient");

const checkApproval = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: member, error } = await supabase
      .from("members")
      .select("approved, role")
      .eq("user_id", userId)
      .single();

    if (error || !member) {
      return res.status(403).json({
        error: "Forbidden",
        message: "No membership record found. Please register first.",
      });
    }

    if (!member.approved) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Your account is pending admin approval.",
      });
    }

    // Attach member metadata for downstream use
    req.member = member;
    next();
  } catch (err) {
    console.error("[checkApproval] Unexpected error:", err.message);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Approval check failed.",
    });
  }
};

module.exports = checkApproval;
