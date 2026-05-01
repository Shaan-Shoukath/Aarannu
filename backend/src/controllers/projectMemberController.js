/**
 * Project Member Controller
 * --------------------------------------------------
 * HTTP handlers for member registration, approval, and management.
 *
 * Approval is backend-authoritative, but the PDF/email delivery work is
 * tracked as a resumable client-side queue. The backend prepares card records,
 * stores the last known delivery phase on `project_members`, and lets the
 * dashboard advance that state as the admin keeps the page open.
 */

const memberService = require("../services/projectMemberService");
const projectService = require("../services/projectService");
const generateService = require("../services/generateService");

const FRONTEND_URL = (
  process.env.FRONTEND_URL || "http://localhost:5173"
).replace(/\/+$/, "");

const buildVerificationUrl = (cardId) => `${FRONTEND_URL}/members/${cardId}`;

const buildDeliveryState = (member, card) => {
  if (!card?.id) {
    return {
      phase: "failed_prepare",
      error:
        "Approved, but the ID card record could not be prepared automatically.",
      cardId: null,
      verificationUrl: "",
    };
  }

  if (!member?.email) {
    return {
      phase: "skipped_no_email",
      error: "No email address is available for automatic delivery.",
      cardId: card.id,
      verificationUrl: card.verificationUrl,
    };
  }

  return {
    phase: "queued",
    error: "",
    cardId: card.id,
    verificationUrl: card.verificationUrl,
  };
};

const withDeliveryState = (member, deliveryState) => ({
  ...member,
  delivery_phase: deliveryState.phase || null,
  delivery_error: deliveryState.error || "",
  delivery_card_id: deliveryState.cardId || null,
  delivery_verification_url: deliveryState.verificationUrl || "",
});

const getProjectContext = async (projectId) => {
  const { data: project } = await projectService.getProjectById(projectId);
  return project || null;
};

const getCardMapForMembers = async (project, memberIds = []) => {
  const targetMemberIds = Array.isArray(memberIds)
    ? memberIds.filter(Boolean)
    : [];

  if (!project?.id || !project?.org_id || targetMemberIds.length === 0) {
    return { cardMap: new Map(), warning: null };
  }

  let warning = null;

  const { error: generationError } = await generateService.createCardRecords(
    project.org_id,
    project.id,
    project.expiry_days || 365,
    targetMemberIds,
  );

  if (generationError) {
    warning =
      "Member approved, but the card record could not be prepared automatically.";
    console.warn("[approval-card] Generation failed:", generationError.message);
  }

  const { cards, error: lookupError } =
    await generateService.getActiveCardsForMembers(project.id, targetMemberIds);

  if (lookupError) {
    warning =
      warning ||
      "Member approved, but the generated card link could not be loaded.";
    console.warn("[approval-card] Lookup failed:", lookupError.message);
    return { cardMap: new Map(), warning };
  }

  const cardMap = new Map(
    (cards || []).map((card) => [
      card.member_id,
      {
        ...card,
        verificationUrl: buildVerificationUrl(card.id),
      },
    ]),
  );

  return { cardMap, warning };
};

const prepareMembersForDelivery = async (members = []) => {
  let warning = null;
  const preparedMembers = [];
  const membersByProject = new Map();

  for (const member of members) {
    if (!member?.project_id) continue;
    if (!membersByProject.has(member.project_id)) {
      membersByProject.set(member.project_id, []);
    }
    membersByProject.get(member.project_id).push(member);
  }

  for (const [projectId, projectMembers] of membersByProject.entries()) {
    const project = await getProjectContext(projectId);

    if (!project) {
      warning =
        warning ||
        "Some approved members could not be queued because the project was missing.";

      for (const member of projectMembers) {
        const deliveryState = buildDeliveryState(member, null);
        const { data: updatedMember } = await memberService.updateMemberDelivery(
          member.id,
          deliveryState,
        );
        preparedMembers.push(updatedMember || withDeliveryState(member, deliveryState));
      }
      continue;
    }

    const { cardMap, warning: cardWarning } = await getCardMapForMembers(
      project,
      projectMembers.map((member) => member.id),
    );

    if (cardWarning && !warning) {
      warning = cardWarning;
    }

    for (const member of projectMembers) {
      const deliveryState = buildDeliveryState(member, cardMap.get(member.id));

      if (deliveryState.phase === "skipped_no_email" && !warning) {
        warning =
          "Some approved members have no email address, so delivery was skipped for them.";
      }

      const { data: updatedMember, error } = await memberService.updateMemberDelivery(
        member.id,
        deliveryState,
      );

      if (error && !warning) {
        warning =
          "Approval succeeded, but the delivery status could not be stored.";
      }

      preparedMembers.push(updatedMember || withDeliveryState(member, deliveryState));
    }
  }

  return { members: preparedMembers, warning };
};

/**
 * POST /api/members/register/:projectId - Public registration
 */
const registerMember = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, email, photoUrl, customFields } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required." });

    const { data: project, error: pErr } =
      await projectService.getProjectById(projectId);
    if (pErr || !project) {
      return res.status(404).json({ error: "Project not found." });
    }
    if (project.status !== "active") {
      return res
        .status(400)
        .json({ error: "This project is no longer accepting registrations." });
    }

    if (project.member_limit) {
      const { data: existing } =
        await memberService.getMembersByProject(projectId);
      const activeCount = (existing || []).filter(
        (member) => member.status === "pending" || member.status === "approved",
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
      submittedBy: null,
    });

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ member: data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/members/:projectId - List members (admin)
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
    // req.targetMemberId is set by resolveMemberOrg in the router
    const memberId = req.targetMemberId || req.params.id;
    const { data, error } = await memberService.approveMember(memberId);
    if (error) return res.status(500).json({ error: error.message });

    const { members, warning } = await prepareMembersForDelivery(data ? [data] : []);

    res.json({ member: members[0] || data, warning });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/members/:id/reject
 */
const reject = async (req, res, next) => {
  try {
    const memberId = req.targetMemberId || req.params.id;
    const { data, error } = await memberService.rejectMember(memberId);
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

    const { members, warning } = await prepareMembersForDelivery(data || []);

    res.json({ approved: members, warning });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/members/:id/queue-delivery
 * Re-prepare the approved member for client-side PDF/email delivery.
 */
const queueDelivery = async (req, res, next) => {
  try {
    const { data: member, error } = await memberService.getMemberById(
      req.targetMemberId || req.params.id,
    );

    if (error) return res.status(500).json({ error: error.message });
    if (!member) return res.status(404).json({ error: "Member not found." });
    if (member.status !== "approved") {
      return res.status(400).json({
        error: "Only approved members can be queued for delivery.",
      });
    }

    const { members, warning } = await prepareMembersForDelivery([member]);

    res.json({ member: members[0] || member, warning });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/members/:id/delivery-status
 * Store the last known client-side delivery phase for the admin dashboard.
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { phase } = req.body || {};

    if (
      phase !== undefined &&
      phase !== null &&
      !memberService.DELIVERY_PHASES.has(phase)
    ) {
      return res.status(400).json({ error: "Invalid delivery phase." });
    }

    const { data, error } = await memberService.updateMemberDelivery(
      req.targetMemberId || req.params.id,
      {
        phase,
        error: req.body?.error,
        cardId: req.body?.cardId,
        verificationUrl: req.body?.verificationUrl,
        messageId: req.body?.messageId,
        pdfGeneratedAt: req.body?.pdfGeneratedAt,
        emailSentAt: req.body?.emailSentAt,
        clearError: Boolean(req.body?.clearError),
        incrementAttempt: Boolean(req.body?.incrementAttempt),
      },
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ member: data });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/members/:id
 */
const removeMember = async (req, res, next) => {
  try {
    const memberId = req.targetMemberId || req.params.id;
    const { error } = await memberService.deleteMember(memberId);
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
  queueDelivery,
  updateDeliveryStatus,
  removeMember,
};
