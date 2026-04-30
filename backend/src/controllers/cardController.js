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
const { deductTokens, refundTokens } = require("../services/tokenService");

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

    const { image, memberName, expiryDays, requestId } = req.body;

    if (!image || typeof image !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'image' field (base64 PNG string)." });
    }

    const dataUrlMatch = image.match(/^data:([^;]+);base64,(.*)$/);
    const contentType = dataUrlMatch?.[1] || "image/png";
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(contentType)) {
      return res.status(400).json({
        error: "Unsupported card file type. Use PNG, JPEG, WebP, or PDF.",
      });
    }

    // Decode base64 to buffer
    const base64Data = dataUrlMatch ? dataUrlMatch[2] : image;
    const buffer = Buffer.from(base64Data, "base64");

    // Enforce size limit (10 MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return res
        .status(413)
        .json({ error: "Image too large. Maximum size is 10 MB." });
    }

    const tokenReference =
      requestId ||
      `card_upload_${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const { error: tokenErr } = await deductTokens(
      userId,
      1,
      `Card upload - ${memberName || "card"}`,
      tokenReference,
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

    // Build storage path: {userId}/{safeName}_{timestamp}.{ext}
    const safeName = (memberName || "card").replace(/[^a-zA-Z0-9]/g, "_");
    const ext =
      contentType === "application/pdf"
        ? "pdf"
        : contentType === "image/jpeg"
          ? "jpg"
          : contentType === "image/webp"
            ? "webp"
            : "png";
    const filePath = `${userId}/${safeName}_${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("id-cards")
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[cardController] Upload failed:", uploadErr);
      await refundTokens(
        userId,
        1,
        `Refund - card upload failed: ${uploadErr.message}`,
        tokenReference,
      );
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
      await refundTokens(
        userId,
        1,
        `Refund - card metadata failed: ${insertErr.message}`,
        tokenReference,
      );
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
