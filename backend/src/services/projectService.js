/**
 * Project Service
 * ───────────────
 * CRUD operations for projects (Service + Bulk types).
 */

const { supabase } = require("../config/supabaseClient");

/**
 * Create a project within an organization.
 */
const createProject = async ({
  orgId,
  type,
  name,
  template,
  memberLimit,
  expiryDays,
  formSchema,
  cardConfig,
}) => {
  return supabase
    .from("projects")
    .insert({
      org_id: orgId,
      type,
      name,
      template: template || "default",
      member_limit: memberLimit || null,
      expiry_days: expiryDays || 365,
      form_schema: formSchema || [],
      card_config: cardConfig || {},
    })
    .select()
    .single();
};

/**
 * List all projects for an organization.
 */
const getProjectsByOrg = async (orgId) => {
  return supabase
    .from("projects")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
};

/**
 * Get a single project by ID.
 */
const getProjectById = async (projectId) => {
  return supabase.from("projects").select("*").eq("id", projectId).single();
};

/**
 * Update a project.
 */
const updateProject = async (projectId, updates) => {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.template !== undefined) payload.template = updates.template;
  if (updates.memberLimit !== undefined)
    payload.member_limit = updates.memberLimit;
  if (updates.expiryDays !== undefined)
    payload.expiry_days = updates.expiryDays;
  if (updates.formSchema !== undefined)
    payload.form_schema = updates.formSchema;
  if (updates.cardConfig !== undefined)
    payload.card_config = updates.cardConfig;
  if (updates.status !== undefined) payload.status = updates.status;

  return supabase
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .select()
    .single();
};

/**
 * Get project statistics.
 */
const getProjectStats = async (projectId) => {
  const [total, pending, approved, rejected, cards] = await Promise.all([
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "pending"),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "approved"),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "rejected"),
    supabase
      .from("generated_cards")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  return {
    totalMembers: total.count || 0,
    pending: pending.count || 0,
    approved: approved.count || 0,
    rejected: rejected.count || 0,
    cardsGenerated: cards.count || 0,
  };
};

module.exports = {
  createProject,
  getProjectsByOrg,
  getProjectById,
  updateProject,
  getProjectStats,
};
