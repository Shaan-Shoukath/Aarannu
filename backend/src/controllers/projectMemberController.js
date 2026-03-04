/**
 * Project Member Controller
 * ─────────────────────────
 * HTTP handlers for member registration, approval, and management.
 */

const memberService = require("../services/projectMemberService");
const projectService = require("../services/projectService");

/**
 * POST /api/members/register/:projectId — Public registration
 */
const registerMember = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, email, photoUrl, customFields } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required." });

    // Fetch project to get org_id and check member limit
    const { data: project, error: pErr } =
      await projectService.getProjectById(projectId);
    if (pErr || !project)
      return res.status(404).json({ error: "Project not found." });
    if (project.status !== "active")
      return res
        .status(400)
        .json({ error: "This project is no longer accepting registrations." });

    // Check member limit
    if (project.member_limit) {
      const { data: existing } =
        await memberService.getMembersByProject(projectId);
      if (existing && existing.length >= project.member_limit) {
        return res
          .status(400)
          .json({ error: "Member registration limit reached." });
      }
    }

    const { data, error } = await memberService.registerMember({
      projectId,
      orgId: project.org_id,
      name,
      email,
      photoUrl,
      customFields,
      submittedBy: null, // public registration
    });

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ member: data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/members/:projectId — List members (admin)
 */
const listMembers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;
    const { data, error } = await memberService.getMembersByProject(
      projectId,
      status || null,
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ members: data });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/members/:id/approve
 */
const approve = async (req, res, next) => {
  try {
    const { data, error } = await memberService.approveMember(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ member: data });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/members/:id/reject
 */
const reject = async (req, res, next) => {
  try {
    const { data, error } = await memberService.rejectMember(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ member: data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/members/bulk-approve
 */
const bulkApprove = async (req, res, next) => {
  try {
    const { memberIds } = req.body;
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: "memberIds array is required." });
    }
    const { data, error } = await memberService.bulkApproveMembers(memberIds);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ approved: data });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/members/:id
 */
const removeMember = async (req, res, next) => {
  try {
    const { error } = await memberService.deleteMember(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerMember,
  listMembers,
  approve,
  reject,
  bulkApprove,
  removeMember,
};
