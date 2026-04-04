/**
 * Bulk Routes
 * ───────────
 * /api/bulk — Bulk generation operations (import, generate, download)
 *
 * All business logic is in bulkController.js — this file only defines
 * route → middleware → controller mappings (matching the pattern of
 * every other route file in the project).
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  importMembers,
  generateCards,
  getStatus,
} = require("../controllers/bulkController");

// POST /api/bulk/import/:projectId — Import members from array (Google Sheets data)
router.post("/import/:projectId", verifyToken, importMembers);

// POST /api/bulk/generate/:projectId — Generate all cards for bulk project
router.post("/generate/:projectId", verifyToken, generateCards);

// GET /api/bulk/status/:projectId — Get bulk generation status
router.get("/status/:projectId", verifyToken, getStatus);

module.exports = router;
