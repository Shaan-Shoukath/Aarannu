/**
 * Upload Routes
 * ─────────────
 * /api/uploads — File and photo upload endpoints
 *
 * Handles member photo uploads and file uploads for registration forms.
 * Files are stored in the 'member-uploads' Supabase Storage bucket (private).
 */

const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");

const BUCKET = "member-uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

/**
 * POST /api/uploads/photo/:projectId — Upload a photo (public, no auth)
 * Used by the registration form for photo_upload fields.
 *
 * Expects multipart/form-data with a field named "file".
 * Since we're not using multer, we handle raw body.
 * The frontend should send the file as base64 in JSON body:
 *   { fileName, fileData (base64), mimeType, fieldKey }
 */
router.post("/photo/:projectId", async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { fileName, fileData, mimeType, fieldKey } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: "fileName and fileData are required." });
    }

    // Validate mime type
    if (mimeType && !ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: `Invalid image type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
      });
    }

    // Decode base64
    const buffer = Buffer.from(fileData, "base64");

    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      });
    }

    // Generate unique file path
    const ext = fileName.split(".").pop() || "jpg";
    const safeName = fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()
      .slice(0, 50);
    const timestamp = Date.now();
    const filePath = `${projectId}/${fieldKey || "photo"}/${safeName}_${timestamp}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
    }

    // Track upload in member_uploads table
    await supabase.from("member_uploads").insert({
      project_id: projectId,
      field_key: fieldKey || "photo",
      file_name: fileName,
      file_path: filePath,
      file_size: buffer.length,
      mime_type: mimeType || "image/jpeg",
      uploaded_by: "public",
    });

    // Generate signed URL for immediate display
    const { data: urlData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60); // 1 hour

    res.json({
      filePath,
      signedUrl: urlData?.signedUrl || null,
      fileName,
      fileSize: buffer.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/uploads/file/:projectId — Upload any allowed file (public, no auth)
 * Same as photo but allows PDF, Word docs, etc.
 */
router.post("/file/:projectId", async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { fileName, fileData, mimeType, fieldKey } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: "fileName and fileData are required." });
    }

    if (mimeType && !ALLOWED_FILE_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_FILE_TYPES.join(", ")}`,
      });
    }

    const buffer = Buffer.from(fileData, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      });
    }

    const ext = fileName.split(".").pop() || "bin";
    const safeName = fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()
      .slice(0, 50);
    const timestamp = Date.now();
    const filePath = `${projectId}/${fieldKey || "file"}/${safeName}_${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
    }

    await supabase.from("member_uploads").insert({
      project_id: projectId,
      field_key: fieldKey || "file",
      file_name: fileName,
      file_path: filePath,
      file_size: buffer.length,
      mime_type: mimeType || "application/octet-stream",
      uploaded_by: "public",
    });

    const { data: urlData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60);

    res.json({
      filePath,
      signedUrl: urlData?.signedUrl || null,
      fileName,
      fileSize: buffer.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/uploads/signed-url — Get a signed URL for an uploaded file
 * Query: ?path=...
 */
router.get("/signed-url", async (req, res, next) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: "path query parameter is required." });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
