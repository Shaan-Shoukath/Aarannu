/**
 * Webhook Routes — Incoming Form Submissions
 * ═══════════════════════════════════════════
 *
 * POST /api/webhook/:webhookId
 *   → Processes a Google Form submission and generates an ID card.
 *
 * Authentication: Via X-Webhook-Secret header (not JWT).
 * Rate limited to 60 requests per 15-minute window per IP.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const { handleFormSubmission } = require("../controllers/webhookController");

const router = express.Router();

// Rate limiter for webhook submissions
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 submissions per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Webhook rate limit exceeded. Please wait before sending more.",
  },
});

// POST /api/webhook/:webhookId — Handle a form submission
router.post("/:webhookId", webhookLimiter, handleFormSubmission);

module.exports = router;
