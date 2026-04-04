/**
 * Project Member Service
 * ──────────────────────
 * CRUD operations for members within projects.
 * Handles public registration, admin approval, and bulk operations.
 */

const { supabase } = require("../config/supabaseClient");

const DELIVERY_PHASES = new Set([
  "queued",
  "generating_pdf",
  "pdf_ready",
  "sending_email",
  "sent",
  "failed_prepare",
  "failed_generate",
  "failed_send",
  "skipped_no_email",
]);

const makeError = (message) => {
  const error = new Error(message);
  error.message = message;
  return error;
};

/**
 * Register a new member to a project (public form submission).
 */
const registerMember = async ({
  projectId,
  orgId,
  name,
  email,
  photoUrl,
  customFields,
  submittedBy,
}) => {
  return supabase
    .from("project_members")
    .insert({
      project_id: projectId,
      org_id: orgId,
      name,
      email: email || null,
      photo_url: photoUrl || "",
      status: "pending",
      custom_fields: customFields || {},
      submitted_by: submittedBy || null,
    })
    .select()
    .single();
};

/**
 * Bulk insert members (for Google Sheets import).
 */
const bulkInsertMembers = async (members) => {
  return supabase.from("project_members").insert(members).select();
};

/**
 * Get members by project with optional status filter.
 */
const getMembersByProject = async (projectId, status = null) => {
  let query = supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  return query;
};

/**
 * Get a single member by ID.
 */
const getMemberById = async (memberId) => {
  return supabase
    .from("project_members")
    .select("*")
    .eq("id", memberId)
    .single();
};

const buildDeliveryPayload = (updates = {}, current = null) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates, "phase")) {
    const { phase } = updates;
    if (phase !== null && phase !== undefined && !DELIVERY_PHASES.has(phase)) {
      return {
        payload: null,
        error: makeError(`Invalid delivery phase: ${phase}`),
      };
    }
    payload.delivery_phase = phase || null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "error")) {
    payload.delivery_error = updates.error || "";
  } else if (updates.clearError) {
    payload.delivery_error = "";
  }

  if (Object.prototype.hasOwnProperty.call(updates, "cardId")) {
    payload.delivery_card_id = updates.cardId || null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "verificationUrl")) {
    payload.delivery_verification_url = updates.verificationUrl || "";
  }

  if (Object.prototype.hasOwnProperty.call(updates, "messageId")) {
    payload.delivery_message_id = updates.messageId || "";
  }

  if (Object.prototype.hasOwnProperty.call(updates, "pdfGeneratedAt")) {
    payload.pdf_generated_at = updates.pdfGeneratedAt || null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "emailSentAt")) {
    payload.email_sent_at = updates.emailSentAt || null;
  }

  if (updates.incrementAttempt) {
    payload.delivery_attempt_count =
      Number(current?.delivery_attempt_count || 0) + 1;
  }

  payload.delivery_updated_at = new Date().toISOString();

  return { payload, error: null };
};

/**
 * Approve a project member.
 */
const approveMember = async (memberId) => {
  return supabase
    .from("project_members")
    .update({ status: "approved" })
    .eq("id", memberId)
    .select()
    .single();
};

/**
 * Reject a project member.
 */
const rejectMember = async (memberId) => {
  return supabase
    .from("project_members")
    .update({ status: "rejected" })
    .eq("id", memberId)
    .select()
    .single();
};

/**
 * Bulk approve members by ID list.
 */
const bulkApproveMembers = async (memberIds) => {
  return supabase
    .from("project_members")
    .update({ status: "approved" })
    .in("id", memberIds)
    .select();
};

/**
 * Update approval-delivery progress for a member.
 */
const updateMemberDelivery = async (memberId, updates = {}) => {
  let current = null;

  if (updates.incrementAttempt) {
    const { data, error } = await getMemberById(memberId);
    if (error) return { data: null, error };
    current = data;
  }

  const { payload, error } = buildDeliveryPayload(updates, current);
  if (error) return { data: null, error };

  return supabase
    .from("project_members")
    .update(payload)
    .eq("id", memberId)
    .select()
    .single();
};

/**
 * Delete a project member.
 */
const deleteMember = async (memberId) => {
  return supabase.from("project_members").delete().eq("id", memberId);
};

module.exports = {
  DELIVERY_PHASES,
  registerMember,
  bulkInsertMembers,
  getMembersByProject,
  getMemberById,
  approveMember,
  rejectMember,
  bulkApproveMembers,
  updateMemberDelivery,
  deleteMember,
};
