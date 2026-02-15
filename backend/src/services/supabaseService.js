/**
 * Supabase Service
 * ────────────────
 * Encapsulates all Supabase DB operations.
 *
 * Why a service layer?
 *   - Controllers stay thin and focused on HTTP concerns.
 *   - Business logic and queries live here and are easily testable.
 *   - If the database provider changes, only this file needs updating.
 */

const { supabase } = require("../config/supabaseClient");
const { getExpiryDate, getNow } = require("../utils/expiryHelper");
const { v4: uuidv4 } = require("uuid");

// ─────────────────────────────────────────────────────────────
//  MEMBER OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Get a member row by `user_id`.
 * @param   {string} userId
 * @returns {Promise<{data, error}>}
 */
const getMemberByUserId = async (userId) => {
  return supabase.from("members").select("*").eq("user_id", userId).single();
};

/**
 * Return all members where `approved` is false.
 * Used by the admin panel.
 * @returns {Promise<{data, error}>}
 */
const getPendingMembers = async () => {
  return supabase
    .from("members")
    .select("*")
    .eq("approved", false)
    .order("created_at", { ascending: true });
};

/**
 * Set `approved = true` for a given `user_id`.
 * @param   {string} userId
 * @returns {Promise<{data, error}>}
 */
const approveMember = async (userId) => {
  return supabase
    .from("members")
    .update({ approved: true })
    .eq("user_id", userId)
    .select()
    .single();
};

// ─────────────────────────────────────────────────────────────
//  GENERATED IDS OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Insert bulk metadata rows into `generated_ids`.
 *
 * Each member in the array gets:
 *   - A UUID primary key
 *   - The authenticated user's `user_id`
 *   - A `file_url` path in Supabase Storage
 *   - An `expires_at` 15 days in the future
 *
 * @param   {string}   userId
 * @param   {object[]} members  – array of { name, role, ... }
 * @returns {Promise<{data, error}>}
 */
const insertGeneratedIds = async (userId, members) => {
  const rows = members.map((m) => {
    const id = uuidv4();
    const safeName = m.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const timestamp = Date.now();
    const filePath = `${userId}/${safeName}_${timestamp}.png`;

    return {
      id,
      user_id: userId,
      file_url: filePath,
      expires_at: getExpiryDate(),
    };
  });

  const { data, error } = await supabase
    .from("generated_ids")
    .insert(rows)
    .select();

  return { data, error, rows };
};

/**
 * Fetch all non-expired `generated_ids` for a user.
 * Filters with `expires_at > now()` so expired cards are excluded.
 *
 * @param   {string} userId
 * @returns {Promise<{data, error}>}
 */
const getActiveIds = async (userId) => {
  return supabase
    .from("generated_ids")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", getNow())
    .order("created_at", { ascending: false });
};

/**
 * Delete all expired rows from `generated_ids`.
 * Optional cleanup — can be called from a cron endpoint or admin action.
 *
 * @returns {Promise<{data, error}>}
 */
const cleanupExpiredIds = async () => {
  return supabase.from("generated_ids").delete().lt("expires_at", getNow());
};

module.exports = {
  getMemberByUserId,
  getPendingMembers,
  approveMember,
  insertGeneratedIds,
  getActiveIds,
  cleanupExpiredIds,
};
