/**
 * Card Controller
 * ───────────────
 * Handles card image uploads and metadata insertion.
 *
 * This controller exists to route frontend card uploads through the
 * backend API, so they pass through authentication, rate limiting,
 * and token enforcement — instead of the frontend calling Supabase
 * Storage and the generated_ids table directly.
 */

const { supabase } = require("../config/supabaseClient");
const { getExpiryDate } = require("../utils/expiryHelper");

/**
 * POST /api/cards/upload
 * Accept a rendered card image + metadata. Handles:
 *   1. Upload to Supabase Storage (id-cards bucket)
 *   2. Insert metadata into generated_ids table
 *
 * Body (multipart or JSON with base64):
 *   - image: base64-encoded PNG string
 *   - memberName: string (used for filename)
 *   - expiryDays: number (optional, default 365)
 */
const uploadCard = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { image, memberName, expiryDays } = req.body;

    if (!image || typeof image !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'image' field (base64 PNG string)." });
    }

    // Decode base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Enforce size limit (10 MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return res
        .status(413)
        .json({ error: "Image too large. Maximum size is 10 MB." });
    }

    // Build storage path: {userId}/{safeName}_{timestamp}.png
    const safeName = (memberName || "card").replace(/[^a-zA-Z0-9]/g, "_");
    const filePath = `${userId}/${safeName}_${Date.now()}.png`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("id-cards")
      .upload(filePath, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[cardController] Upload failed:", uploadErr);
      return res
        .status(502)
        .json({ error: "Failed to upload card to storage." });
    }

    // Insert metadata row
    const days = Number(expiryDays) || 365;
    const expiresAt = getExpiryDate(days);

    const { data: record, error: insertErr } = await supabase
      .from("generated_ids")
      .insert({
        user_id: userId,
        file_url: filePath,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[cardController] DB insert failed:", insertErr);
      // Attempt to clean up the orphaned storage file
      await supabase.storage.from("id-cards").remove([filePath]);
      return res
        .status(500)
        .json({ error: "Failed to save card metadata." });
    }

    res.status(201).json({
      message: "Card uploaded successfully.",
      card: record,
      file_url: filePath,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadCard };
