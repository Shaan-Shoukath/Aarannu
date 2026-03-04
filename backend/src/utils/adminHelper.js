/**
 * Admin Helper
 * ────────────
 * Determines whether a user ID belongs to a platform administrator.
 *
 * Admin user IDs are defined in the ADMIN_USER_IDS environment variable
 * as a comma-separated list of Supabase user UUIDs.
 *
 * Admin privileges:
 *   • Unlimited (infinite) tokens — no balance checks, no deductions
 *   • Bypass checkTokens middleware
 *   • Balance endpoints show ∞
 *
 * Usage:
 *   const { isAdmin } = require("../utils/adminHelper");
 *   if (isAdmin(userId)) { ... }
 */

/**
 * Parse ADMIN_USER_IDS once at module load.
 * Normalise to lowercase for case-insensitive UUID comparison.
 */
const ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Check if a user ID is an admin.
 *
 * @param {string} userId – Supabase auth user UUID
 * @returns {boolean}
 */
function isAdmin(userId) {
  if (!userId) return false;
  return ADMIN_IDS.has(userId.toLowerCase());
}

/**
 * Get the set of admin user IDs (for debugging/logging).
 * @returns {Set<string>}
 */
function getAdminIds() {
  return ADMIN_IDS;
}

module.exports = { isAdmin, getAdminIds };
