/**
 * Generate Controller
 * ───────────────────
 * HTTP handlers for card generation and management.
 */

const generateService = require("../services/generateService");
const projectService = require("../services/projectService");
const { deductTokens, refundTokens } = require("../services/tokenService");
const { supabase } = require("../config/supabaseClient");

/**
 * POST /api/generate/:projectId — Generate cards for all approved members
 */
const generateCards = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const { projectId } = req.params;
    const { data: project, error: pErr } =
      await projectService.getProjectById(projectId);
    if (pErr || !project)
      return res.status(404).json({ error: "Project not found." });

    // ── Pre-count how many members need cards ────────────────
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

    const existingSet = new Set((existingCards || []).map((c) => c.member_id));
    const needsCount = (members || []).filter((m) => !existingSet.has(m.id)).length;

    if (needsCount === 0) {
      return res.json({ generated: 0, cards: [], message: "No new cards to generate." });
    }

    // ── Deduct tokens ────────────────────────────────────────
    const { error: tokenErr } = await deductTokens(
      userId,
      needsCount,
      `Card generation – project ${projectId} (${needsCount} cards)`,
      `project_${projectId}`,
    );
    if (tokenErr) {
      const status = tokenErr.code === "INSUFFICIENT_TOKENS" ? 402 : 500;
      return res.status(status).json({ error: tokenErr.message });
    }

    const { cards, error } = await generateService.createCardRecords(
      project.org_id,
      projectId,
      project.expiry_days || 365,
    );

    if (error) {
      // Refund tokens on failure
      await refundTokens(userId, needsCount, `Refund – generation failed: ${error.message}`, `project_${projectId}`);
      return res.status(500).json({ error: error.message });
    }

    // Refund any over-deducted tokens (edge case: some members got cards between count & generation)
    const actualGenerated = (cards || []).length;
    if (actualGenerated < needsCount) {
      const diff = needsCount - actualGenerated;
      await refundTokens(userId, diff, `Refund – only ${actualGenerated} of ${needsCount} cards generated`, `project_${projectId}`);
    }

    res.json({ generated: actualGenerated, cards });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/generate/:memberId/single — Regenerate card for single member
 */
const regenerateSingle = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const { memberId } = req.params;
    const { projectId, orgId, expiryDays } = req.body;

    if (!projectId || !orgId) {
      return res
        .status(400)
        .json({ error: "projectId and orgId are required." });
    }

    // ── Deduct 1 token for single regeneration ──────────────
    const { error: tokenErr } = await deductTokens(
      userId,
      1,
      `Single card regeneration – member ${memberId}`,
      `regen_${memberId}`,
    );
    if (tokenErr) {
      const status = tokenErr.code === "INSUFFICIENT_TOKENS" ? 402 : 500;
      return res.status(status).json({ error: tokenErr.message });
    }

    const { cards, error } = await generateService.createCardRecords(
      orgId,
      projectId,
      expiryDays || 365,
    );
    // Filter to just the requested member
    const card = cards?.find((c) => c.member_id === memberId);

    if (error) {
      await refundTokens(userId, 1, `Refund – regen failed: ${error.message}`, `regen_${memberId}`);
      return res.status(500).json({ error: error.message });
    }

    if (!card) {
      // No card was generated for this member (maybe they already have one)
      await refundTokens(userId, 1, `Refund – member ${memberId} did not need regeneration`, `regen_${memberId}`);
    }

    res.json({ card: card || null });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/generate/:cardId/revoke — Revoke a card
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
 * GET /api/generate/:projectId/cards — List all cards for a project
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
