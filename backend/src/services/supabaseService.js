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
const { deleteFile } = require("./storageService");
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
 * Delete all expired rows from `generated_ids` AND their
 * associated PNG files from the `id-cards` storage bucket.
 *
 * Flow:
 *   1. Fetch expired rows to get their `file_url` paths.
 *   2. Delete the storage files (best-effort — errors logged, not thrown).
 *   3. Delete the expired DB rows.
 *
 * @returns {Promise<{data, error, deletedFiles: number}>}
 */
const cleanupExpiredIds = async () => {
  // Step 1 — Fetch expired rows
  const { data: expired, error: fetchError } = await supabase
    .from("generated_ids")
    .select("id, file_url")
    .lt("expires_at", getNow());

  if (fetchError) return { data: null, error: fetchError, deletedFiles: 0 };
  if (!expired || expired.length === 0)
    return { data: [], error: null, deletedFiles: 0 };

  // Step 2 — Delete storage files (best-effort)
  let deletedFiles = 0;
  for (const row of expired) {
    if (row.file_url) {
      try {
        await deleteFile(row.file_url);
        deletedFiles++;
      } catch (err) {
        console.warn(
          `[cleanup] Could not delete file ${row.file_url}:`,
          err.message,
        );
      }
    }
  }

  // Step 3 — Delete DB rows
  const { data, error } = await supabase
    .from("generated_ids")
    .delete()
    .lt("expires_at", getNow());

  return { data, error, deletedFiles };
};

module.exports = {
  getMemberByUserId,
  getPendingMembers,
  approveMember,
  insertGeneratedIds,
  getActiveIds,
  cleanupExpiredIds,
};
