/**
 * Admin Controller
 * ────────────────
 * Endpoints restricted to admin users.
 *
 * Admin detection:
 *   The `members` table has a `role` column.
 *   A user is considered admin if `role === 'admin'` (case-insensitive).
 *
 * Security:
 *   - All routes require `verifyToken` (JWT).
 *   - Admin role is checked server-side from the DB — never
 *     from a frontend-provided value.
 */

const {
  getPendingMembers,
  approveMember,
  getMemberByUserId,
  cleanupExpiredIds,
} = require("../services/supabaseService");
const { isValidUUID } = require("../utils/validators");

/**
 * Checks whether the authenticated user is an admin.
 * Returns the member record if yes, or sends 403 and returns null.
 */
const requireAdmin = async (req, res) => {
  const { data: member, error } = await getMemberByUserId(req.user.id);

  if (error || !member) {
    res.status(403).json({
      error: "Forbidden",
      message: "No membership record found.",
    });
    return null;
  }

  if (member.role?.toLowerCase() !== "admin") {
    res.status(403).json({
      error: "Forbidden",
      message: "Admin access required.",
    });
    return null;
  }

  return member;
};

/**
 * GET /api/admin/pending
 * ──────────────────────
 * Returns all members with `approved = false`.
 */
const getPending = async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return; // response already sent

    const { data, error } = await getPendingMembers();

    if (error) {
      console.error("[adminController.getPending] DB error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to fetch pending members.",
      });
    }

    return res.status(200).json({
      pending: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/approve/:userId
 * ────────────────────────────────
 * Sets `approved = true` for the target user.
 */
const approve = async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { userId } = req.params;

    // Validate UUID format
    if (!isValidUUID(userId)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid user ID format.",
      });
    }

    const { data, error } = await approveMember(userId);

    if (error) {
      console.error("[adminController.approve] DB error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to approve member.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Not Found",
        message: "No member found with that user ID.",
      });
    }

    return res.status(200).json({
      message: "Member approved successfully.",
      member: data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/cleanup
 * ───────────────────────
 * Deletes all expired `generated_ids` rows.
 * Optional maintenance endpoint.
 */
const cleanup = async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { error } = await cleanupExpiredIds();

    if (error) {
      console.error("[adminController.cleanup] DB error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Cleanup failed.",
      });
    }

    return res.status(200).json({
      message: "Expired records cleaned up successfully.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPending, approve, cleanup };
