/**
 * ID Controller
 * ─────────────
 * Handles all endpoints related to ID card generation and retrieval.
 *
 * Both routes require authentication (`verifyToken`).
 * The generation route additionally requires approval (`checkApproval`).
 */

const {
  insertGeneratedIds,
  getActiveIds,
  deleteGeneratedId,
} = require("../services/supabaseService");
const { getSignedUrls } = require("../services/storageService");
const { validateBulkPayload } = require("../utils/validators");
const { deductTokens, refundTokens } = require("../services/tokenService");

/**
 * POST /api/ids/generate
 * ──────────────────────
 * Accepts `{ members: [...] }` and inserts metadata rows into
 * `generated_ids`.  The frontend is responsible for rendering
 * the card images and uploading them to Supabase Storage at the
 * returned `file_url` paths.
 *
 * Flow:
 *   1. Validate payload (max 50 members per batch).
 *   2. Insert rows with auto-generated UUID & expiry.
 *   3. Return the inserted rows so the frontend knows the
 *      storage paths to upload to.
 */
const generateIds = async (req, res, next) => {
  try {
    // ── Input validation ─────────────────────────────────────
    const validation = validateBulkPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Validation Error",
        message: validation.message,
      });
    }

    const userId = req.user.id;
    const { members } = req.body;

    // ── Deduct tokens (1 per member) ─────────────────────────
    const tokenCount = members.length;
    const { error: tokenErr } = await deductTokens(
      userId,
      tokenCount,
      `ID generation – ${tokenCount} card(s)`,
    );
    if (tokenErr) {
      const status = tokenErr.code === "INSUFFICIENT_TOKENS" ? 402 : 500;
      return res.status(status).json({
        error:
          tokenErr.code === "INSUFFICIENT_TOKENS"
            ? "Insufficient Tokens"
            : "Token Error",
        message: tokenErr.message,
      });
    }

    // ── Insert metadata ──────────────────────────────────────
    const { data, error, rows } = await insertGeneratedIds(userId, members);

    if (error) {
      console.error("[idController.generateIds] Insert error:", error.message);
      // Auto-refund tokens on DB failure
      await refundTokens(
        userId,
        tokenCount,
        `Refund – generation failed: ${error.message}`,
      );
      return res.status(500).json({
        error: "Database Error",
        message:
          "Failed to insert generated ID records. Tokens have been refunded.",
      });
    }

    return res.status(201).json({
      message: `${data.length} ID(s) metadata created successfully.`,
      count: data.length,
      ids: data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ids/my-ids
 * ───────────────────
 * Returns all non-expired IDs for the authenticated user,
 * each enriched with a signed URL for secure download.
 */
const getMyIds = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // ── Fetch active (non-expired) records ───────────────────
    const { data: ids, error } = await getActiveIds(userId);

    if (error) {
      console.error("[idController.getMyIds] Fetch error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to fetch your IDs.",
      });
    }

    if (!ids || ids.length === 0) {
      return res.status(200).json({ ids: [], count: 0 });
    }

    // ── Generate signed URLs for every active record ─────────
    const filePaths = ids.map((id) => id.file_url);
    const signedResults = await getSignedUrls(filePaths);

    // Merge signed URLs back into the ID objects
    const enrichedIds = ids.map((id, index) => ({
      ...id,
      signed_url: signedResults[index]?.signedUrl || null,
    }));

    return res.status(200).json({
      ids: enrichedIds,
      count: enrichedIds.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/ids/:id
 * ───────────────────
 * Deletes a single generated-ID record and its storage file.
 * Only the owning user can delete their own records.
 */
const deleteId = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing id parameter." });
    }

    const { error } = await deleteGeneratedId(id, userId);

    if (error) {
      const status =
        error.message === "Unauthorized"
          ? 403
          : error.message === "Record not found"
            ? 404
            : 500;
      return res.status(status).json({ error: error.message });
    }

    return res.status(200).json({ message: "ID card deleted successfully." });
  } catch (err) {
    next(err);
  }
};

module.exports = { generateIds, getMyIds, deleteId };
