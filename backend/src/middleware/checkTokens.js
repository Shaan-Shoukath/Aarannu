/**
 * checkTokens Middleware
 * ─────────────────────
 * Validates that the authenticated user has enough tokens
 * before allowing card-generation endpoints to proceed.
 *
 * Usage:
 *   router.post('/generate', verifyToken, checkTokens(1), controller);
 *   router.post('/bulk',     verifyToken, checkTokens('body.count'), controller);
 *
 * The `required` parameter can be:
 *   • A fixed number        → checkTokens(5)
 *   • A dot-path string     → checkTokens('body.members.length')
 *     Resolved at runtime from `req` (e.g. req.body.members.length)
 *   • A function            → checkTokens((req) => req.body.members.length)
 *
 * On failure → 402 Payment Required with { error, code, required, available }.
 * On internal error → fail open (log + continue) so service isn't blocked
 *   by a transient DB issue.
 */

const { getBalance } = require("../services/tokenService");
const { isAdmin } = require("../utils/adminHelper");

/**
 * Resolve a dot-path like "body.members.length" against an object.
 */
function resolvePath(obj, path) {
  return path
    .split(".")
    .reduce((o, key) => (o != null ? o[key] : undefined), obj);
}

/**
 * Factory that returns an Express middleware.
 *
 * @param {number|string|function} required
 * @returns {function} Express middleware
 */
function checkTokens(required = 1) {
  return async (req, res, next) => {
    try {
      // Determine how many tokens are needed
      let needed;
      if (typeof required === "function") {
        needed = required(req);
      } else if (typeof required === "string") {
        needed = resolvePath(req, required);
      } else {
        needed = required;
      }

      needed = Number(needed);
      if (!Number.isFinite(needed) || needed <= 0) {
        // If we can't determine the count, let the request through
        // (the controller will handle validation)
        return next();
      }

      const userId = req.user?.id || req.user?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Admin users have unlimited tokens — skip all checks
      if (isAdmin(userId)) {
        req.tokenBalance = Infinity;
        req.tokensRequired = needed;
        req.isAdminBypass = true;
        return next();
      }

      // Org-scoped wallet check (if orgId is available)
      const orgId = req.params?.orgId || req.body?.orgId || null;

      const { balance, error } = await getBalance(userId, orgId);

      if (error) {
        // Fail open — don't block the user on a transient DB error
        console.error(
          "[checkTokens] Balance check failed, allowing through:",
          error,
        );
        return next();
      }

      if (balance < needed) {
        return res.status(402).json({
          error: `Insufficient tokens. Required: ${needed}, Available: ${balance}`,
          code: "INSUFFICIENT_TOKENS",
          required: needed,
          available: balance,
        });
      }

      // Attach info for downstream controllers
      req.tokenBalance = balance;
      req.tokensRequired = needed;
      next();
    } catch (err) {
      // Fail open on unexpected errors
      console.error("[checkTokens] Unexpected error, allowing through:", err);
      next();
    }
  };
}

module.exports = checkTokens;
