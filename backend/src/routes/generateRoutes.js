/**
 * Generate Routes
 * ───────────────
 * /api/generate — Card generation and management
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  generateCards,
  regenerateSingle,
  revokeCard,
  listCards,
} = require("../controllers/generateController");

// Generate cards for all approved members in a project
router.post("/:projectId", verifyToken, generateCards);

// Regenerate card for a single member
router.post("/:memberId/single", verifyToken, regenerateSingle);

// Revoke a card
router.patch("/:cardId/revoke", verifyToken, revokeCard);

// List cards for a project
router.get("/:projectId/cards", verifyToken, listCards);

module.exports = router;
