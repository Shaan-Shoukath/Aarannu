/**
 * Auth Routes
 * ───────────
 * Endpoints for authentication-related operations.
 *
 * All routes are protected by `verifyToken` middleware.
 * Rate-limited with the stricter `authLimiter`.
 */

const { Router } = require("express");
const verifyToken = require("../middleware/verifyToken");
const { authLimiter } = require("../middleware/rateLimiter");
const { getMe } = require("../controllers/authController");

const router = Router();

// GET /api/auth/me – Return current authenticated user + member info
router.get("/me", authLimiter, verifyToken, getMe);

module.exports = router;
