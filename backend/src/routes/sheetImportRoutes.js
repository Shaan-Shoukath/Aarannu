/**
 * Sheet Import Routes
 * ───────────────────
 * /api/sheets — Google Sheets fetching and import
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { fetchSheet, importSheet } = require("../controllers/sheetImportController");

// Fetch and preview a Google Sheet (returns headers + sample rows)
router.post("/fetch", verifyToken, fetchSheet);

// Import from Google Sheet with column mapping
router.post("/import/:projectId", verifyToken, importSheet);

module.exports = router;
