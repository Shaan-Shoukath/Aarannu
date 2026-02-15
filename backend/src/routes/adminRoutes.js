/**
 * Admin Routes
 * ────────────
 * Endpoints restricted to admin users.
 *
 * All routes require authentication via `verifyToken`.
 * Admin role is verified inside each controller method (server-side DB check).
 */

const { Router } = require("express");
const verifyToken = require("../middleware/verifyToken");
const { apiLimiter } = require("../middleware/rateLimiter");
const {
  getPending,
  approve,
  cleanup,
} = require("../controllers/adminController");

const router = Router();

// GET  /api/admin/pending        – List unapproved members
router.get("/pending", apiLimiter, verifyToken, getPending);

// POST /api/admin/approve/:userId – Approve a specific member
router.post("/approve/:userId", apiLimiter, verifyToken, approve);

// POST /api/admin/cleanup         – Remove expired generated_ids rows
router.post("/cleanup", apiLimiter, verifyToken, cleanup);

module.exports = router;
