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
  updateExpiry,
} = require("../services/supabaseService");
const { isValidUUID } = require("../utils/validators");
const { getExpiryDate } = require("../utils/expiryHelper");

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
 * Deletes expired `generated_ids` rows.
 * Accepts optional `beforeDate` in body to control the cutoff.
 * Only runs when explicitly invoked by an admin.
 */
const cleanup = async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { beforeDate } = req.body || {};
    const { error, deletedFiles } = await cleanupExpiredIds(beforeDate);

    if (error) {
      console.error("[adminController.cleanup] DB error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Cleanup failed.",
      });
    }

    return res.status(200).json({
      message: "Expired records cleaned up successfully.",
      deletedFiles: deletedFiles || 0,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/expiry
 * ───────────────────────
 * Update the expiry date for specific generated_ids.
 *
 * Body:
 *   - ids: string[]  – array of generated_ids UUIDs to update
 *   - expiryDays: number – new expiry (days from now)
 *
 * OR:
 *   - ids: string[]
 *   - expiresAt: string – explicit ISO-8601 date
 */
const setExpiry = async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { ids, expiryDays, expiresAt } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "ids array is required.",
      });
    }

    // Validate all UUIDs
    for (const id of ids) {
      if (!isValidUUID(id)) {
        return res.status(400).json({
          error: "Validation Error",
          message: `Invalid UUID: ${id}`,
        });
      }
    }

    let newExpiry;
    if (expiresAt) {
      newExpiry = expiresAt;
    } else if (expiryDays && Number.isFinite(expiryDays) && expiryDays > 0) {
      newExpiry = getExpiryDate(expiryDays);
    } else {
      return res.status(400).json({
        error: "Validation Error",
        message: "Provide either expiryDays (number) or expiresAt (ISO date).",
      });
    }

    const { data, error } = await updateExpiry(ids, newExpiry);

    if (error) {
      console.error("[adminController.setExpiry] DB error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to update expiry.",
      });
    }

    return res.status(200).json({
      message: `Expiry updated for ${data?.length || 0} record(s).`,
      updated: data || [],
      newExpiry,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPending, approve, cleanup, setExpiry };
