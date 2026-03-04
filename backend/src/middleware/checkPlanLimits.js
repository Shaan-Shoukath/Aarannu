/**
 * Check Plan Limits Middleware
 * ────────────────────────────
 * Enforces subscription plan limits for an organization.
 * Checks member count, project count, and other plan constraints.
 *
 * Usage:
 *   router.post("/", verifyToken, checkPlanLimits("members"), controller);
 *   router.post("/", verifyToken, checkPlanLimits("projects"), controller);
 */

const { supabase } = require("../config/supabaseClient");

const checkPlanLimits = (resource = "members") => {
  return async (req, res, next) => {
    try {
      const orgId = req.orgId || req.params.orgId || req.body?.orgId;
      if (!orgId) return next(); // No org context, skip check

      // Fetch org with plan details
      const { data: org } = await supabase
        .from("organizations")
        .select("plan, subscription_plans(*)")
        .eq("id", orgId)
        .single();

      if (!org || !org.subscription_plans) return next(); // No plan, allow

      const plan = org.subscription_plans;

      // Check plan expiry
      if (org.plan_expires && new Date(org.plan_expires) < new Date()) {
        // Plan expired — treat as free
        // Could also return 402 here
      }

      if (resource === "members") {
        if (plan.max_members === null) return next(); // Unlimited
        const { count } = await supabase
          .from("project_members")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);

        if (count >= plan.max_members) {
          return res.status(403).json({
            error: `Member limit reached (${plan.max_members} members on ${plan.display_name} plan). Please upgrade.`,
            code: "PLAN_LIMIT_MEMBERS",
          });
        }
      }

      if (resource === "projects") {
        if (plan.max_projects === null) return next(); // Unlimited
        const { count } = await supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);

        if (count >= plan.max_projects) {
          return res.status(403).json({
            error: `Project limit reached (${plan.max_projects} projects on ${plan.display_name} plan). Please upgrade.`,
            code: "PLAN_LIMIT_PROJECTS",
          });
        }
      }

      next();
    } catch (err) {
      console.error("[checkPlanLimits] Error:", err.message);
      next(); // Fail open — don't block on plan check errors
    }
  };
};

module.exports = checkPlanLimits;
