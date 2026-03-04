/**
 * Project Routes
 * ──────────────
 * /api/projects — Project CRUD and stats
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkOrgRole = require("../middleware/checkOrgRole");
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  getProjectStats,
} = require("../controllers/projectController");

// Create project (admin required — orgId from body)
router.post(
  "/",
  verifyToken,
  (req, res, next) => {
    req.params.id = req.body.orgId; // checkOrgRole reads from req.params.id
    next();
  },
  checkOrgRole("admin"),
  createProject,
);

// List projects for an org
router.get("/org/:id", verifyToken, checkOrgRole("member"), listProjects);

// Get single project
router.get("/:projectId", verifyToken, getProject);

// Update project (admin)
router.put("/:projectId", verifyToken, updateProject);

// Get project stats
router.get("/:projectId/stats", verifyToken, getProjectStats);

module.exports = router;
