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
const { isAdmin } = require("../utils/adminHelper");
const {
  getBalance,
  getTransactions,
  getAnalytics,
  addTokensManual,
} = require("../controllers/tokenController");

const router = Router();

/**
 * Platform-admin gate (Layer 1).
 * Only users listed in ADMIN_USER_IDS env var may call the manual-add endpoint.
 */
const requirePlatformAdmin = (req, res, next) => {
  if (!isAdmin(req.user?.id)) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Platform admin access required.",
    });
  }
  next();
};

// Authenticated
router.get("/balance", verifyToken, getBalance);
router.get("/transactions", verifyToken, getTransactions);
router.get("/analytics", verifyToken, getAnalytics);

// Platform-admin only — manually credit tokens to a user
router.post("/add", verifyToken, requirePlatformAdmin, addTokensManual);

module.exports = router;
