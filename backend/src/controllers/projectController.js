/**
 * Project Controller
 * ──────────────────
 * HTTP handlers for project CRUD + stats.
 */

const projectService = require("../services/projectService");

const createProject = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const {
      type,
      name,
      template,
      memberLimit,
      expiryDays,
      formSchema,
      cardConfig,
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: "Type and name are required." });
    }
    if (!["service", "bulk"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Type must be 'service' or 'bulk'." });
    }

    const { data, error } = await projectService.createProject({
      orgId,
      type,
      name,
      template,
      memberLimit,
      expiryDays,
      formSchema,
      cardConfig,
    });

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ project: data });
  } catch (err) {
    next(err);
  }
};

const listProjects = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { data, error } = await projectService.getProjectsByOrg(orgId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ projects: data });
  } catch (err) {
    next(err);
  }
};

const getProject = async (req, res, next) => {
  try {
    const { data, error } = await projectService.getProjectById(
      req.params.projectId,
    );
    if (error || !data)
      return res.status(404).json({ error: "Project not found." });
    res.json({ project: data });
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const { data, error } = await projectService.updateProject(
      req.params.projectId,
      req.body,
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ project: data });
  } catch (err) {
    next(err);
  }
};

const getProjectStats = async (req, res, next) => {
  try {
    const stats = await projectService.getProjectStats(req.params.projectId);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  getProjectStats,
};
