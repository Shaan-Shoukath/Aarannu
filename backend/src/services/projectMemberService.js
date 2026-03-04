/**
 * Project Member Service
 * ──────────────────────
 * CRUD operations for members within projects.
 * Handles public registration, admin approval, and bulk operations.
 */

const { supabase } = require("../config/supabaseClient");

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
 * Delete a project member.
 */
const deleteMember = async (memberId) => {
  return supabase.from("project_members").delete().eq("id", memberId);
};

module.exports = {
  registerMember,
  bulkInsertMembers,
  getMembersByProject,
  getMemberById,
  approveMember,
  rejectMember,
  bulkApproveMembers,
  deleteMember,
};
