/**
 * Expiry Helper
 * ─────────────
 * Centralises expiry calculation so every part of the codebase
 * uses the exact same logic.
 *
 * Expiry is **configurable**:
 *   - Subscription / service projects use the project's `expiry_days` setting.
 *   - Bulk uploads default to 365 days (1 year).
 *   - Legacy endpoint defaults to 365 days.
 *   - Admins can override, extend, or revoke expiry at any time.
 */

const DEFAULT_EXPIRY_DAYS = 365;

/**
 * Returns an ISO-8601 timestamp `days` from now.
 * Supabase stores `timestamptz` so ISO format is the safest.
 *
 * @param   {number} [days=DEFAULT_EXPIRY_DAYS] – number of days until expiry
 * @returns {string} e.g. "2027-03-02T22:30:00.000Z"
 */
const getExpiryDate = (days = DEFAULT_EXPIRY_DAYS) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
};

/**
 * Returns the current timestamp in ISO-8601 format.
 * Used for `expires_at > now()` comparisons.
 *
 * @returns {string}
 */
const getNow = () => new Date().toISOString();

/**
 * Checks if a given ISO date string is still in the future.
 *
 * @param   {string}  isoDate
 * @returns {boolean}
 */
const isExpired = (isoDate) => new Date(isoDate) <= new Date();

module.exports = { DEFAULT_EXPIRY_DAYS, getExpiryDate, getNow, isExpired };
