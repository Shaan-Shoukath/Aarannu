/**
 * Expiry Helper
 * ─────────────
 * Centralises the 15-day expiry rule so every part of the codebase
 * uses the exact same calculation.
 *
 * Why 15 days?
 *   - Short enough to force periodic re-verification of identity.
 *   - Long enough to be practical for events / campaigns.
 *   - Matches the spec requirement.
 */

const EXPIRY_DAYS = 15;

/**
 * Returns an ISO-8601 timestamp that is `EXPIRY_DAYS` from now.
 * Supabase stores `timestamptz` so ISO format is the safest.
 *
 * @returns {string} e.g. "2026-03-02T22:30:00.000Z"
 */
const getExpiryDate = () => {
  const now = new Date();
  now.setDate(now.getDate() + EXPIRY_DAYS);
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

module.exports = { EXPIRY_DAYS, getExpiryDate, getNow, isExpired };
