/**
 * Generate Routes
 * ───────────────
 * /api/generate — Card generation and management
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkOrgRole = require("../middleware/checkOrgRole");
const projectService = require("../services/projectService");
const { supabase } = require("../config/supabaseClient");
const {
  generateCards,
  regenerateSingle,
  revokeCard,
  listCards,
} = require("../controllers/generateController");

const resolveProjectOrg = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body?.projectId;
    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required." });
    }

    const { data: project } = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    req.params.id = project.org_id;
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

const resolveCardOrg = async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { data: card, error } = await supabase
      .from("generated_cards")
      .select("org_id")
      .eq("id", cardId)
      .single();

    if (error || !card) {
      return res.status(404).json({ error: "Card not found." });
    }

    req.params.id = card.org_id;
    next();
  } catch (err) {
    next(err);
  }
};

// Generate cards for all approved members in a project
router.post(
  "/:projectId",
  verifyToken,
  resolveProjectOrg,
  checkOrgRole("admin"),
  generateCards,
);

// Regenerate card for a single member
router.post(
  "/:memberId/single",
  verifyToken,
  resolveProjectOrg,
  checkOrgRole("admin"),
  regenerateSingle,
);

// Revoke a card
router.patch(
  "/:cardId/revoke",
  verifyToken,
  resolveCardOrg,
  checkOrgRole("admin"),
  revokeCard,
);

// List cards for a project
router.get(
  "/:projectId/cards",
  verifyToken,
  resolveProjectOrg,
  checkOrgRole("member"),
  listCards,
);

module.exports = router;
