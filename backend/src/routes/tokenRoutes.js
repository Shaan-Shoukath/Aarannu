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
  getPackages,
  purchaseTokens,
  addTokensManual,
} = require("../controllers/tokenController");

const router = Router();

// Public
router.get("/packages", getPackages);

// Authenticated
router.get("/balance", verifyToken, getBalance);
router.get("/transactions", verifyToken, getTransactions);
router.get("/analytics", verifyToken, getAnalytics);
router.post("/purchase", verifyToken, purchaseTokens);

// Admin (verifyToken + future admin check)
router.post("/add", verifyToken, addTokensManual);

module.exports = router;
