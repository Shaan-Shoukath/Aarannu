/**
 * Bulk Routes
 * ───────────
 * /api/bulk — Bulk generation operations (import, generate, download)
 *
 * All business logic is in bulkController.js — this file only defines
 * route → middleware → controller mappings (matching the pattern of
 * every other route file in the project).
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkOrgRole = require("../middleware/checkOrgRole");
const projectService = require("../services/projectService");
const {
  importMembers,
  generateCards,
  getStatus,
} = require("../controllers/bulkController");

/**
 * Inline helper — resolves projectId → org_id and injects into req.params.id
 * so that checkOrgRole can find it. Used by routes that only have a projectId
 * in the URL rather than an orgId.
 */
const resolveProjectOrg = async (req, res, next) => {
  try {
    const { data: project } = await projectService.getProjectById(
      req.params.projectId,
    );
    if (!project)
      return res.status(404).json({ error: "Project not found." });
    req.params.id = project.org_id; // checkOrgRole reads req.params.id
    next();
  } catch (err) {
    next(err);
  }
};

// POST /api/bulk/import/:projectId — Import members from array (Google Sheets data)
// Requires admin role in the project's org.
router.post(
  "/import/:projectId",
  verifyToken,
  resolveProjectOrg,
  checkOrgRole("admin"),
  importMembers,
);

// POST /api/bulk/generate/:projectId — Generate all cards for bulk project
// Requires admin role in the project's org.
router.post(
  "/generate/:projectId",
  verifyToken,
  resolveProjectOrg,
  checkOrgRole("admin"),
  generateCards,
);

// GET /api/bulk/status/:projectId — Get bulk generation status
// Requires at least member role in the project's org.
router.get(
  "/status/:projectId",
  verifyToken,
  resolveProjectOrg,
  checkOrgRole("member"),
  getStatus,
);

module.exports = router;
