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
const {
  getExpiryDate,
  getNow,
  DEFAULT_EXPIRY_DAYS,
} = require("../utils/expiryHelper");
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
 *   - An `expires_at` based on the subscription / project setting
 *
 * @param   {string}   userId
 * @param   {object[]} members  – array of { name, role, ... }
 * @param   {number}   [expiryDays=DEFAULT_EXPIRY_DAYS] – days until card expiry
 * @returns {Promise<{data, error}>}
 */
const insertGeneratedIds = async (userId, members, expiryDays) => {
  const days = expiryDays || DEFAULT_EXPIRY_DAYS;
  const batchTimestamp = Date.now();
  const rows = members.map((m, index) => {
    const id = uuidv4();
    const safeName =
      m.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "member";
    const filePath = `${userId}/${safeName}_${batchTimestamp}_${index}_${id.slice(0, 8)}.png`;

    return {
      id,
      user_id: userId,
      file_url: filePath,
      expires_at: getExpiryDate(days),
    };
  });

  const { data, error } = await supabase
    .from("generated_ids")
    .insert(rows)
    .select();

  return { data, error, rows };
};

/**
 * Fetch all `generated_ids` for a user.
 * Returns ALL cards sorted newest-first.
 * Expiry is tracked but deletion is admin-controlled.
 *
 * @param   {string}  userId
 * @param   {boolean} [activeOnly=false] – if true, only return non-expired
 * @returns {Promise<{data, error}>}
 */
const getActiveIds = async (userId, activeOnly = false) => {
  let query = supabase
    .from("generated_ids")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.gt("expires_at", getNow());
  }

  return query;
};

/**
 * Admin-controlled cleanup: delete expired rows from `generated_ids`
 * AND their associated PNG files from the `id-cards` storage bucket.
 *
 * Only runs when explicitly invoked by an admin — NO automatic deletion.
 *
 * @param   {string} [beforeDate] – optional ISO date; only delete rows expired before this date
 * @returns {Promise<{data, error, deletedFiles: number}>}
 */
const cleanupExpiredIds = async (beforeDate) => {
  const cutoff = beforeDate || getNow();

  // Step 1 — Fetch expired rows
  const { data: expired, error: fetchError } = await supabase
    .from("generated_ids")
    .select("id, file_url")
    .lt("expires_at", cutoff);

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
    .lt("expires_at", cutoff);

  return { data, error, deletedFiles };
};

/**
 * Admin: update the expiry date for specific generated_ids rows.
 *
 * @param   {string[]} ids       – array of generated_ids UUIDs
 * @param   {string}   expiresAt – new ISO-8601 expiry timestamp
 * @returns {Promise<{data, error}>}
 */
const updateExpiry = async (ids, expiresAt) => {
  return supabase
    .from("generated_ids")
    .update({ expires_at: expiresAt })
    .in("id", ids)
    .select();
};

/**
 * Delete a single generated-ID row AND its storage file.
 * Only deletes if the row belongs to the given userId (ownership check).
 *
 * @param   {string} id      – UUID of the generated_ids row
 * @param   {string} userId  – authenticated user's id (ownership guard)
 * @returns {Promise<{data, error}>}
 */
const deleteGeneratedId = async (id, userId) => {
  // 1. Fetch the row to get file_url and verify ownership
  const { data: row, error: fetchError } = await supabase
    .from("generated_ids")
    .select("id, file_url, user_id")
    .eq("id", id)
    .single();

  if (fetchError) return { data: null, error: fetchError };
  if (!row) return { data: null, error: { message: "Record not found" } };
  if (row.user_id !== userId)
    return { data: null, error: { message: "Unauthorized" } };

  // 2. Delete the storage file (best-effort)
  if (row.file_url) {
    try {
      await deleteFile(row.file_url);
    } catch (err) {
      console.warn(
        `[deleteGeneratedId] Could not delete file ${row.file_url}:`,
        err.message,
      );
    }
  }

  // 3. Delete the DB row
  const { data, error } = await supabase
    .from("generated_ids")
    .delete()
    .eq("id", id);

  return { data, error };
};

module.exports = {
  getMemberByUserId,
  getPendingMembers,
  approveMember,
  insertGeneratedIds,
  getActiveIds,
  cleanupExpiredIds,
  updateExpiry,
  deleteGeneratedId,
};
