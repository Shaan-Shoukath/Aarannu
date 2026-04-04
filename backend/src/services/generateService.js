/**
 * Generate Service
 * ────────────────
 * Card generation pipeline for the multi-tenant platform.
 * Handles async batch generation, storage upload, and DB records.
 */

const { supabase } = require("../config/supabaseClient");
const { v4: uuidv4 } = require("uuid");

const BATCH_SIZE = 50; // Process 50 members per batch to prevent memory overload

/**
 * Generate cards for approved members in a project.
 * Returns the card metadata records (actual rendering is done client-side).
 *
 * @param {string} orgId
 * @param {string} projectId
 * @param {number} expiryDays
 * @returns {Promise<{cards, error}>}
 */
const createCardRecords = async (
  orgId,
  projectId,
  expiryDays = 365,
  memberIds = null,
) => {
  const hasTargetMembers = Array.isArray(memberIds);
  const targetMemberIds = hasTargetMembers ? memberIds.filter(Boolean) : null;

  if (hasTargetMembers && targetMemberIds.length === 0) {
    return { cards: [], error: null };
  }

  // 1. Fetch approved members who don't yet have active cards
  let membersQuery = supabase
    .from("project_members")
    .select("id, name, email")
    .eq("project_id", projectId)
    .eq("status", "approved");

  if (targetMemberIds) {
    membersQuery = membersQuery.in("id", targetMemberIds);
  }

  const { data: members, error: mErr } = await membersQuery;

  if (mErr) return { cards: null, error: mErr };
  if (!members || members.length === 0) return { cards: [], error: null };

  // 2. Check which members already have active cards
  let existingCardsQuery = supabase
    .from("generated_cards")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("status", "active");

  if (targetMemberIds) {
    existingCardsQuery = existingCardsQuery.in("member_id", targetMemberIds);
  }

  const { data: existingCards } = await existingCardsQuery;

  const existingMemberIds = new Set(
    (existingCards || []).map((c) => c.member_id),
  );
  const needsGeneration = members.filter((m) => !existingMemberIds.has(m.id));

  if (needsGeneration.length === 0) return { cards: [], error: null };

  // 3. Create card records in batches
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  const allCards = [];

  for (let i = 0; i < needsGeneration.length; i += BATCH_SIZE) {
    const batch = needsGeneration.slice(i, i + BATCH_SIZE);
    const rows = batch.map((m) => {
      const cardId = uuidv4();
      const safeName =
        m.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "member";
      return {
        id: cardId,
        org_id: orgId,
        project_id: projectId,
        member_id: m.id,
        file_path: `${orgId}/${projectId}/${safeName}_${cardId.slice(0, 8)}.png`,
        qr_data: cardId, // QR encodes the card ID for verification
        status: "active",
        expires_at: expiresAt.toISOString(),
      };
    });

    const { data, error } = await supabase
      .from("generated_cards")
      .insert(rows)
      .select();

    if (error) return { cards: allCards, error };
    allCards.push(...(data || []));
  }

  return { cards: allCards, error: null };
};

/**
 * Get active cards for a specific list of members in a project.
 */
const getActiveCardsForMembers = async (projectId, memberIds = []) => {
  const targetMemberIds = Array.isArray(memberIds)
    ? memberIds.filter(Boolean)
    : [];

  if (targetMemberIds.length === 0) {
    return { cards: [], error: null };
  }

  const { data, error } = await supabase
    .from("generated_cards")
    .select("id, member_id, project_id, status, expires_at, created_at")
    .eq("project_id", projectId)
    .eq("status", "active")
    .in("member_id", targetMemberIds);

  return { cards: data || [], error };
};

/**
 * Revoke a single card.
 */
const revokeCard = async (cardId) => {
  return supabase
    .from("generated_cards")
    .update({ status: "revoked" })
    .eq("id", cardId)
    .select()
    .single();
};

/**
 * Get card with full member and org details (for verification).
 */
const getCardForVerification = async (cardId) => {
  const { data, error } = await supabase
    .from("generated_cards")
    .select(
      `
      *,
      project_members (name, email, photo_url, custom_fields),
      projects (name, type),
      organizations (name, logo_url, slug)
    `,
    )
    .eq("id", cardId)
    .single();

  return { data, error };
};

/**
 * Get all cards for a project.
 */
const getCardsByProject = async (projectId) => {
  return supabase
    .from("generated_cards")
    .select("*, project_members(name, email)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
};

/**
 * Cleanup expired cards for multi-tenant.
 */
const cleanupExpiredCards = async () => {
  const now = new Date().toISOString();
  return supabase
    .from("generated_cards")
    .update({ status: "expired" })
    .lt("expires_at", now)
    .eq("status", "active");
};

module.exports = {
  createCardRecords,
  revokeCard,
  getCardForVerification,
  getCardsByProject,
  getActiveCardsForMembers,
  cleanupExpiredCards,
  BATCH_SIZE,
};
