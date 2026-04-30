/**
 * Card Routes
 * ───────────
 * /api/cards — Card upload and management
 *
 * These routes handle card image uploads that were previously done
 * directly from the frontend to Supabase Storage. Routing through
 * the backend ensures all writes pass through authentication,
 * rate limiting, and the middleware pipeline.
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkApproval = require("../middleware/checkApproval");
const { apiLimiter } = require("../middleware/rateLimiter");
const { uploadCard } = require("../controllers/cardController");

// POST /api/cards/upload — Upload a rendered card image + insert metadata
router.post("/upload", apiLimiter, verifyToken, checkApproval, uploadCard);

module.exports = router;
