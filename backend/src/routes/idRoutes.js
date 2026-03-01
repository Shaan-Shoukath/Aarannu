/**
 * ID Routes
 * ─────────
 * Endpoints for generating and retrieving digital ID cards.
 *
 * POST /generate  → requires auth + approval
 * GET  /my-ids    → requires auth only
 */

const { Router } = require("express");
const verifyToken = require("../middleware/verifyToken");
const checkApproval = require("../middleware/checkApproval");
const { apiLimiter } = require("../middleware/rateLimiter");
const {
  generateIds,
  getMyIds,
  deleteId,
} = require("../controllers/idController");

const router = Router();

// POST /api/ids/generate – Bulk-create ID metadata (requires approval)
router.post("/generate", apiLimiter, verifyToken, checkApproval, generateIds);

// GET /api/ids/my-ids – Fetch user's active (non-expired) IDs with signed URLs
router.get("/my-ids", apiLimiter, verifyToken, getMyIds);

// DELETE /api/ids/:id – Delete a single generated ID + its storage file
router.delete("/:id", apiLimiter, verifyToken, deleteId);

module.exports = router;
