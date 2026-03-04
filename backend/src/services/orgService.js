/**
 * Organization Service
 * ────────────────────
 * Encapsulates all Supabase DB operations for the multi-tenant
 * organization layer. Uses service-role client (bypasses RLS).
 */

const { supabase } = require("../config/supabaseClient");

// ─────────────────────────────────────────────────────────────
//  ORGANIZATION CRUD
// ─────────────────────────────────────────────────────────────

/**
 * Create an organization and make the creator the owner.
 * @param {object} params - { name, slug, logoUrl, userId }
 * @returns {Promise<{org, membership, error}>}
 */
const createOrganization = async ({ name, slug, logoUrl = "", userId }) => {
  // 1. Insert the organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      logo_url: logoUrl,
      plan: "free",
      created_by: userId,
    })
    .select()
    .single();

  if (orgError) return { org: null, membership: null, error: orgError };

  // 2. Add the creator as owner in org_members
  const { data: membership, error: memError } = await supabase
    .from("org_members")
    .insert({
      org_id: org.id,
      user_id: userId,
      role: "owner",
    })
    .select()
    .single();

  if (memError) return { org, membership: null, error: memError };

  return { org, membership, error: null };
};

/**
 * Get an organization by slug.
 * @param {string} slug
 * @returns {Promise<{data, error}>}
 */
const getOrgBySlug = async (slug) => {
  return supabase
    .from("organizations")
    .select("*, subscription_plans(*)")
    .eq("slug", slug)
    .single();
};

/**
 * Get an organization by ID.
 * @param {string} id
 * @returns {Promise<{data, error}>}
 */
const getOrgById = async (id) => {
  return supabase
    .from("organizations")
    .select("*, subscription_plans(*)")
    .eq("id", id)
    .single();
};

/**
 * Update organization details.
 * @param {string} orgId
 * @param {object} updates - { name?, logoUrl?, settings? }
 * @returns {Promise<{data, error}>}
 */
const updateOrganization = async (orgId, updates) => {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
  if (updates.settings !== undefined) payload.settings = updates.settings;

  return supabase
    .from("organizations")
    .update(payload)
    .eq("id", orgId)
    .select()
    .single();
};

/**
 * Check if a slug is available.
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
const isSlugAvailable = async (slug) => {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  return !data;
};

// ─────────────────────────────────────────────────────────────
//  ORG MEMBERSHIP
// ─────────────────────────────────────────────────────────────

/**
 * Get user's role in an organization.
 * @param {string} orgId
 * @param {string} userId
 * @returns {Promise<{role: string|null, error}>}
 */
const getUserOrgRole = async (orgId, userId) => {
  const { data, error } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  return { role: data?.role || null, error };
};

/**
 * Get all organizations a user belongs to.
 * @param {string} userId
 * @returns {Promise<{data, error}>}
 */
const getUserOrganizations = async (userId) => {
  const { data, error } = await supabase
    .from("org_members")
    .select("role, joined_at, organizations(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  return { data, error };
};

/**
 * Get all members of an organization.
 * @param {string} orgId
 * @returns {Promise<{data, error}>}
 */
const getOrgMembers = async (orgId) => {
  return supabase
    .from("org_members")
    .select("*")
    .eq("org_id", orgId)
    .order("joined_at", { ascending: true });
};

/**
 * Add a member to an organization.
 * @param {string} orgId
 * @param {string} userId
 * @param {string} role
 * @returns {Promise<{data, error}>}
 */
const addOrgMember = async (orgId, userId, role = "member") => {
  return supabase
    .from("org_members")
    .insert({ org_id: orgId, user_id: userId, role })
    .select()
    .single();
};

/**
 * Remove a member from an organization.
 * @param {string} orgId
 * @param {string} userId
 * @returns {Promise<{data, error}>}
 */
const removeOrgMember = async (orgId, userId) => {
  return supabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
};

// ─────────────────────────────────────────────────────────────
//  ORG STATS
// ─────────────────────────────────────────────────────────────

/**
 * Get aggregate stats for an organization.
 * @param {string} orgId
 * @returns {Promise<object>}
 */
const getOrgStats = async (orgId) => {
  const [projects, members, cards] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("generated_cards")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
  ]);

  const pendingMembers = await supabase
    .from("project_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "pending");

  const activeCards = await supabase
    .from("generated_cards")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());

  return {
    totalProjects: projects.count || 0,
    totalMembers: members.count || 0,
    totalCards: cards.count || 0,
    pendingMembers: pendingMembers.count || 0,
    activeCards: activeCards.count || 0,
  };
};

module.exports = {
  createOrganization,
  getOrgBySlug,
  getOrgById,
  updateOrganization,
  isSlugAvailable,
  getUserOrgRole,
  getUserOrganizations,
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  getOrgStats,
};
