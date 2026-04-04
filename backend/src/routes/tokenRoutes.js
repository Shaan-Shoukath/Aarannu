/**
 * Token Routes
 * ────────────
 * /api/tokens/*
 *
 * All routes require authentication (verifyToken) except GET /packages
 * which is public so unauthenticated visitors can see pricing.
 */

const { Router } = require("express");
const verifyToken = require("../middleware/verifyToken");
const {
  getBalance,
  getTransactions,
  getAnalytics,
  addTokensManual,
} = require("../controllers/tokenController");

const router = Router();

// Authenticated
router.get("/balance", verifyToken, getBalance);
router.get("/transactions", verifyToken, getTransactions);
router.get("/analytics", verifyToken, getAnalytics);

// Admin (verifyToken + future admin check)
router.post("/add", verifyToken, addTokensManual);

module.exports = router;
