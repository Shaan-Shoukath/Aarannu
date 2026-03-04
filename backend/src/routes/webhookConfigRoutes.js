/**
 * Webhook Config Routes — CRUD for Webhook Configurations
 * ═══════════════════════════════════════════════════════
 *
 * All routes require JWT authentication (verifyToken).
 *
 * POST   /                    → Create new webhook config
 * GET    /                    → List all user's webhook configs
 * GET    /:id                 → Get single webhook config
 * PUT    /:id                 → Update webhook config
 * DELETE /:id                 → Delete webhook config
 * POST   /:id/regenerate-secret → Regenerate the webhook secret
 */

const { Router } = require("express");
const verifyToken = require("../middleware/verifyToken");
const { apiLimiter } = require("../middleware/rateLimiter");
const {
  create,
  list,
  getOne,
  update,
  remove,
  rotateSecret,
} = require("../controllers/webhookConfigController");

const router = Router();

// All webhook config routes require authentication
router.post("/", apiLimiter, verifyToken, create);
router.get("/", apiLimiter, verifyToken, list);
router.get("/:id", apiLimiter, verifyToken, getOne);
router.put("/:id", apiLimiter, verifyToken, update);
router.delete("/:id", apiLimiter, verifyToken, remove);
router.post("/:id/regenerate-secret", apiLimiter, verifyToken, rotateSecret);

module.exports = router;
