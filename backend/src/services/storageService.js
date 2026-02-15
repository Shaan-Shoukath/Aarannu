/**
 * Storage Service
 * ───────────────
 * Handles all Supabase Storage operations for the private
 * `id-cards` bucket.
 *
 * Key design decisions:
 *   - The bucket is PRIVATE.  No public URLs exist.
 *   - Access is granted via signed URLs with a 1-hour TTL.
 *   - This avoids permanent links leaking sensitive ID card images.
 */

const { supabase } = require("../config/supabaseClient");

const BUCKET = "id-cards";
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour in seconds

/**
 * Generate a signed URL for a file in the private bucket.
 *
 * @param   {string} filePath  – e.g. "userId/john_doe_1707960000.png"
 * @returns {Promise<{signedUrl: string|null, error: object|null}>}
 */
const getSignedUrl = async (filePath) => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

  if (error) {
    console.error("[storageService] Signed URL error:", error.message);
    return { signedUrl: null, error };
  }

  return { signedUrl: data.signedUrl, error: null };
};

/**
 * Generate signed URLs for multiple files in one pass.
 *
 * @param   {string[]} filePaths
 * @returns {Promise<object[]>}  – [ { path, signedUrl, error } ]
 */
const getSignedUrls = async (filePaths) => {
  const results = await Promise.allSettled(
    filePaths.map(async (path) => {
      const { signedUrl, error } = await getSignedUrl(path);
      return { path, signedUrl, error: error?.message || null };
    }),
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { path: null, signedUrl: null, error: r.reason?.message },
  );
};

/**
 * Delete a file from the private bucket.
 *
 * @param   {string} filePath
 * @returns {Promise<{data, error}>}
 */
const deleteFile = async (filePath) => {
  return supabase.storage.from(BUCKET).remove([filePath]);
};

module.exports = { getSignedUrl, getSignedUrls, deleteFile, BUCKET };
