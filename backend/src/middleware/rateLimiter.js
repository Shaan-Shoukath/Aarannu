/**
 * Rate Limiter Middleware
 * ──────────────────────
 * Uses `express-rate-limit` to cap requests per IP.
 *
 * Default: 100 requests per 15-minute window.
 *
 * Why rate-limit?
 *   - Prevents brute-force attacks against auth endpoints.
 *   - Mitigates abuse of ID generation (which triggers storage writes).
 *   - Protects Supabase quota from being drained by a single actor.
 *
 * The limiter returns RFC-compliant `Retry-After` and
 * `X-RateLimit-*` headers automatically.
 */

const rateLimit = require("express-rate-limit");

// ── General API limiter ──────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: "Too Many Requests",
    message: "You have exceeded the rate limit. Please try again later.",
  },
});

// ── Stricter limiter for auth-related endpoints ──────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // only 20 auth attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Too many authentication attempts. Please try again later.",
  },
});

module.exports = { apiLimiter, authLimiter };
