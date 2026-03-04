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
  getPublicProjectInfo,
  exportMembersCsv,
} = require("../controllers/projectController");
const projectService = require("../services/projectService");
const { supabase } = require("../config/supabaseClient");
const orgService = require("../services/orgService");

// ── Public (no auth) ──────────────────────────────────────
// Public project info for registration form rendering
router.get("/:projectId/public", getPublicProjectInfo);

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

// Export members as CSV (auth + org membership check)
router.get(
  "/:projectId/export-csv",
  verifyToken,
  async (req, res, next) => {
    try {
      const { data: project } = await projectService.getProjectById(
        req.params.projectId,
      );
      if (!project)
        return res.status(404).json({ error: "Project not found." });
      const { role } = await orgService.getUserOrgRole(
        project.org_id,
        req.user.id,
      );
      if (!role)
        return res
          .status(403)
          .json({ error: "Not a member of this organization." });
      next();
    } catch (err) {
      next(err);
    }
  },
  exportMembersCsv,
);

// ── Renewal: continue or reset project members ─────────────
// POST /api/projects/:projectId/renew
// Body: { mode: "continue" | "reset" }
router.post("/:projectId/renew", verifyToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { mode } = req.body; // "continue" or "reset"

    if (!["continue", "reset"].includes(mode)) {
      return res
        .status(400)
        .json({ error: 'mode must be "continue" or "reset".' });
    }

    const { data: project, error: pErr } =
      await projectService.getProjectById(projectId);
    if (pErr || !project)
      return res.status(404).json({ error: "Project not found." });

    // Verify the user belongs to this project's org
    const { role } = await orgService.getUserOrgRole(
      project.org_id,
      req.user.id,
    );
    if (!role || !["admin", "owner"].includes(role)) {
      return res.status(403).json({ error: "Admin or owner access required." });
    }

    if (mode === "reset") {
      // Delete all existing members → fresh start
      await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId);
    }

    // Re-activate the project
    const { data, error } = await projectService.updateProject(projectId, {
      status: "active",
    });
    if (error) return res.status(500).json({ error: error.message });

    res.json({
      project: data,
      mode,
      message:
        mode === "continue"
          ? "Project renewed. Existing members kept — new registrations open."
          : "Project reset. All previous members cleared — fresh start.",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
