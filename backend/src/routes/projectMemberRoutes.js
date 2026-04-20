/**
 * Project Member Routes
 * ─────────────────────
 * /api/members — Member registration, approval, and management
 *
 * Authorization strategy:
 *   - Public registration — no auth (anyone can submit the form)
 *   - All admin actions (list, approve, reject, delete, bulk-approve,
 *     queue-delivery) require checkOrgRole("admin") in the member's org.
 *   - Delivery-status updates need only checkOrgRole("member") since
 *     the dashboard progress tracker is low-risk.
 *
 * Because most routes carry a member :id (not an orgId), two resolver
 * helpers look up the member → project → org_id and inject it into
 * req.params.id so checkOrgRole can read it.
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkOrgRole = require("../middleware/checkOrgRole");
const memberService = require("../services/projectMemberService");
const projectService = require("../services/projectService");
const {
  registerMember,
  listMembers,
  approve,
  reject,
  bulkApprove,
  queueDelivery,
  updateDeliveryStatus,
  removeMember,
} = require("../controllers/projectMemberController");

// ─── Resolver helpers ───────────────────────────────────────────────────────

/**
 * resolveMemberOrg — for routes with :id (a member UUID).
 * Looks up the member, then its project, and injects the org_id into
 * req.params.id so checkOrgRole can validate org membership.
 * Also saves the original member id as req.targetMemberId.
 */
const resolveMemberOrg = async (req, res, next) => {
  try {
    const { data: member } = await memberService.getMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: "Member not found." });
    const { data: project } = await projectService.getProjectById(
      member.project_id,
    );
    if (!project) return res.status(404).json({ error: "Project not found." });
    req.targetMemberId = member.id; // preserve original id for controllers
    req.params.id = project.org_id; // checkOrgRole reads req.params.id
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * resolveProjectOrg — for routes with :projectId.
 * Looks up the project and injects its org_id into req.params.id.
 */
const resolveProjectOrg = async (req, res, next) => {
  try {
    const pid = req.params.projectId || req.body?.projectId;
    if (!pid) return res.status(400).json({ error: "projectId is required." });
    const { data: project } = await projectService.getProjectById(pid);
    if (!project) return res.status(404).json({ error: "Project not found." });
    req.params.id = project.org_id;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * resolveBulkOrg — for bulk-approve which carries memberIds in the body.
 * Resolves org from the first memberId.
 */
const resolveBulkOrg = async (req, res, next) => {
  try {
    const firstId = req.body?.memberIds?.[0];
    if (!firstId) {
      return res.status(400).json({ error: "memberIds array is required." });
    }
    const { data: member } = await memberService.getMemberById(firstId);
    if (!member) return res.status(404).json({ error: "Member not found." });
    const { data: project } = await projectService.getProjectById(
      member.project_id,
    );
    if (!project) return res.status(404).json({ error: "Project not found." });
    req.params.id = project.org_id;
    next();
  } catch (err) {
    next(err);
  }
};

// ─── Public (no auth) ──────────────────────────────────────────────────────
// Public registration form submission — intentionally unauthenticated
router.post("/register/:projectId", registerMember);

// ─── Authenticated — admin role required ───────────────────────────────────

// List project members (with optional ?status= filter)
router.get(
  "/:projectId",
  verifyToken,
  resolveProjectOrg,
  checkOrgRole("admin"),
  listMembers,
);

// Approve a single member
router.patch(
  "/:id/approve",
  verifyToken,
  resolveMemberOrg,
  checkOrgRole("admin"),
  approve,
);

// Reject a single member
router.patch(
  "/:id/reject",
  verifyToken,
  resolveMemberOrg,
  checkOrgRole("admin"),
  reject,
);

// Bulk approve members (memberIds in body)
router.post(
  "/bulk-approve",
  verifyToken,
  resolveBulkOrg,
  checkOrgRole("admin"),
  bulkApprove,
);

// Re-queue card delivery for an approved member
router.post(
  "/:id/queue-delivery",
  verifyToken,
  resolveMemberOrg,
  checkOrgRole("admin"),
  queueDelivery,
);

// Persist client-side delivery progress — member-level access is sufficient
router.patch(
  "/:id/delivery-status",
  verifyToken,
  resolveMemberOrg,
  checkOrgRole("member"),
  updateDeliveryStatus,
);

// Delete a member from a project
router.delete(
  "/:id",
  verifyToken,
  resolveMemberOrg,
  checkOrgRole("admin"),
  removeMember,
);

module.exports = router;
