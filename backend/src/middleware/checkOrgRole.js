/**
 * Check Org Role Middleware
 * ─────────────────────────
 * Verifies the authenticated user has the required role (or higher)
 * in the organization specified by :id or :orgId param.
 *
 * Role hierarchy: owner > admin > member
 *
 * Usage in routes:
 *   router.put("/:id", verifyToken, checkOrgRole("admin"), controller.update);
 */

const { getUserOrgRole } = require("../services/orgService");

const ROLE_LEVELS = { member: 1, admin: 2, owner: 3 };

/**
 * @param {string} requiredRole - Minimum role needed: 'member' | 'admin' | 'owner'
 * @returns Express middleware
 */
const checkOrgRole = (requiredRole = "member") => {
  return async (req, res, next) => {
    try {
      // Look for org ID in route params — supports :id, :orgId, or body
      const orgId = req.params.id || req.params.orgId || req.body?.orgId;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required." });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required." });
      }

      const { role, error } = await getUserOrgRole(orgId, userId);

      if (error) {
        console.error("[checkOrgRole] DB error:", error.message);
        return res.status(500).json({ error: "Internal server error." });
      }

      if (!role) {
        return res
          .status(403)
          .json({ error: "You are not a member of this organization." });
      }

      const userLevel = ROLE_LEVELS[role] || 0;
      const requiredLevel = ROLE_LEVELS[requiredRole] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          error: `Insufficient permissions. Required: ${requiredRole}, your role: ${role}.`,
        });
      }

      // Attach org role to request for downstream use
      req.orgRole = role;
      req.orgId = orgId;

      next();
    } catch (err) {
      console.error("[checkOrgRole] Unexpected error:", err.message);
      return res.status(500).json({ error: "Internal server error." });
    }
  };
};

module.exports = checkOrgRole;
