/**
 * Verify Routes
 * ─────────────
 * /api/verify — Public QR verification endpoint
 */

const express = require("express");
const router = express.Router();
const { verifyCard } = require("../controllers/verifyController");

// Public — no auth required
router.get("/:cardId", verifyCard);

module.exports = router;
