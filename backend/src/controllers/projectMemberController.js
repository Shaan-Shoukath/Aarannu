/**
 * Project Member Controller
 * ─────────────────────────
 * HTTP handlers for member registration, approval, and management.
 * Sends email notification on approval via Brevo.
 */

const memberService = require("../services/projectMemberService");
const projectService = require("../services/projectService");
const orgService = require("../services/orgService");

// ── Email notification helper ──────────────────────────────────
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Fire-and-forget approval email to member.
 * Fails silently — approval itself still succeeds even if email fails.
 */
const sendApprovalEmail = async (member, project, orgName) => {
  try {
    if (!member.email || !process.env.BREVO_API_KEY) return;

    const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@communityid.app";
    const senderName = process.env.BREVO_SENDER_NAME || orgName || "Community ID";
    const safeName = member.name || "Member";
    const safeOrg = orgName || "Community ID";
    const projectName = project?.name || "the project";

    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: member.email, name: safeName }],
      subject: `Your registration for ${projectName} has been approved!`,
      htmlContent: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Hello ${safeName},</h2>
          <p style="color: #475569; line-height: 1.6;">
            Great news! Your registration for <strong>${projectName}</strong>
            at <strong>${safeOrg}</strong> has been <span style="color: #16a34a; font-weight: 600;">approved</span>.
          </p>
          <p style="color: #475569; line-height: 1.6;">
            Your ID card will be generated shortly. You'll receive another email
            with your digital ID card attached once it's ready.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">
            This is an automated email from ${safeOrg}'s Community ID Platform.
          </p>
        </div>
      `,
    };

    await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[approval-email] Failed to send:", err.message);
  }
};

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

    // Check member limit — only pending + approved count against the limit
    if (project.member_limit) {
      const { data: existing } =
        await memberService.getMembersByProject(projectId);
      const activeCount = (existing || []).filter(
        (m) => m.status === "pending" || m.status === "approved",
      ).length;
      if (activeCount >= project.member_limit) {
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

    // Fire-and-forget approval email
    if (data?.email && data?.project_id) {
      const { data: project } = await projectService.getProjectById(data.project_id);
      let orgName = "";
      if (project?.org_id) {
        const { data: org } = await orgService.getOrgById(project.org_id);
        orgName = org?.name || "";
      }
      sendApprovalEmail(data, project, orgName);
    }

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

    // Fire-and-forget approval emails for all approved members
    if (data && data.length > 0) {
      const firstMember = data[0];
      if (firstMember.project_id) {
        const { data: project } = await projectService.getProjectById(firstMember.project_id);
        let orgName = "";
        if (project?.org_id) {
          const { data: org } = await orgService.getOrgById(project.org_id);
          orgName = org?.name || "";
        }
        data.forEach((m) => {
          if (m.email) sendApprovalEmail(m, project, orgName);
        });
      }
    }

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
