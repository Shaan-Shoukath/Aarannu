/**
 * Email Routes — Brevo Transactional Email
 * ═════════════════════════════════════════
 *
 * POST /api/email/send-card
 *   → Sends a generated ID card PDF to a recipient via Brevo.
 *
 * Rate limited to 30 emails per 15-minute window per IP to prevent abuse.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const { sendCard } = require("../controllers/emailController");

const router = express.Router();

// Stricter rate limit for email sending
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 emails per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message:
      "Email rate limit exceeded. Please wait before sending more emails.",
  },
});

router.post("/send-card", emailLimiter, sendCard);

module.exports = router;
