/**
 * Organization Routes
 * ───────────────────
 * /api/org — CRUD for organizations + membership
 *
 * All routes require authentication (verifyToken) except slug check.
 * Admin/owner routes also require checkOrgRole middleware.
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkOrgRole = require("../middleware/checkOrgRole");
const {
  createOrg,
  getMyOrgs,
  getOrgBySlug,
  getOrgById,
  updateOrg,
  getOrgStats,
  getOrgMembersHandler,
  checkSlug,
} = require("../controllers/orgController");

// ── Public ──────────────────────────────────────────────────
// Check if a slug is available (no auth needed)
router.get("/check-slug/:slug", checkSlug);

// ── Authenticated ───────────────────────────────────────────
// Create a new organization
router.post("/", verifyToken, createOrg);

// List organizations the current user belongs to
router.get("/my", verifyToken, getMyOrgs);

// Get org by slug (user must be a member)
router.get("/slug/:slug", verifyToken, getOrgBySlug);

// Get org by ID (user must be a member)
router.get("/:id", verifyToken, getOrgById);

// ── Admin / Owner ───────────────────────────────────────────
// Update organization details
router.put("/:id", verifyToken, checkOrgRole("admin"), updateOrg);

// Get org statistics
router.get("/:id/stats", verifyToken, checkOrgRole("admin"), getOrgStats);

// List org members (admins can see all members)
router.get(
  "/:id/members",
  verifyToken,
  checkOrgRole("admin"),
  getOrgMembersHandler,
);

module.exports = router;
