/**
 * Generate Controller
 * HTTP handlers for card generation and management.
 */

const generateService = require("../services/generateService");
const projectService = require("../services/projectService");
const { deductTokens, refundTokens } = require("../services/tokenService");
const { supabase } = require("../config/supabaseClient");

/**
 * POST /api/generate/:projectId
 * Generate cards for all approved members who do not already have one.
 */
const generateCards = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const { projectId } = req.params;
    const { data: project, error: projectError } =
      await projectService.getProjectById(projectId);

    if (projectError || !project) {
      return res.status(404).json({ error: "Project not found." });
    }

    const { data: members } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("status", "approved");

    const { data: existingCards } = await supabase
      .from("generated_cards")
      .select("member_id")
      .eq("project_id", projectId)
      .eq("status", "active");

    const existingSet = new Set((existingCards || []).map((card) => card.member_id));
    const needsCount = (members || []).filter(
      (member) => !existingSet.has(member.id),
    ).length;

    if (needsCount === 0) {
      return res.json({
        generated: 0,
        cards: [],
        message: "No new cards to generate.",
      });
    }

    const { error: tokenError } = await deductTokens(
      userId,
      needsCount,
      `Card generation - project ${projectId} (${needsCount} cards)`,
      `project_${projectId}`,
    );

    if (tokenError) {
      const status = tokenError.code === "INSUFFICIENT_TOKENS" ? 402 : 500;
      return res.status(status).json({ error: tokenError.message });
    }

    const { cards, error } = await generateService.createCardRecords(
      project.org_id,
      projectId,
      project.expiry_days || 365,
    );

    if (error) {
      await refundTokens(
        userId,
        needsCount,
        `Refund - generation failed: ${error.message}`,
        `project_${projectId}`,
      );
      return res.status(500).json({ error: error.message });
    }

    const actualGenerated = (cards || []).length;

    if (actualGenerated < needsCount) {
      const difference = needsCount - actualGenerated;
      await refundTokens(
        userId,
        difference,
        `Refund - only ${actualGenerated} of ${needsCount} cards generated`,
        `project_${projectId}`,
      );
    }

    res.json({ generated: actualGenerated, cards });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/generate/:memberId/single
 * Regenerate a card for a single member without charging tokens.
 */
const regenerateSingle = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { projectId, orgId, expiryDays } = req.body;

    if (!projectId || !orgId) {
      return res
        .status(400)
        .json({ error: "projectId and orgId are required." });
    }

    const { cards, error } = await generateService.createCardRecords(
      orgId,
      projectId,
      expiryDays || 365,
    );

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const card = cards?.find((entry) => entry.member_id === memberId) || null;
    res.json({ card });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/generate/:cardId/revoke
 * Revoke a card.
 */
const revokeCard = async (req, res, next) => {
  try {
    const { data, error } = await generateService.revokeCard(req.params.cardId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ card: data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/generate/:projectId/cards
 * List all cards for a project.
 */
const listCards = async (req, res, next) => {
  try {
    const { data, error } = await generateService.getCardsByProject(
      req.params.projectId,
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ cards: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { generateCards, regenerateSingle, revokeCard, listCards };
