/**
 * Bulk Routes
 * ───────────
 * /api/bulk — Bulk generation operations (import, generate, download)
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const memberService = require("../services/projectMemberService");
const projectService = require("../services/projectService");
const generateService = require("../services/generateService");
const { deductTokens, refundTokens } = require("../services/tokenService");
const { supabase } = require("../config/supabaseClient");

/**
 * POST /api/bulk/import/:projectId — Import members from array (Google Sheets data)
 */
router.post("/import/:projectId", verifyToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: "Members array is required." });
    }

    const { data: project } = await projectService.getProjectById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found." });

    // Check member limit
    if (project.member_limit) {
      const { data: existing } =
        await memberService.getMembersByProject(projectId);
      const remaining = project.member_limit - (existing?.length || 0);
      if (members.length > remaining) {
        return res.status(400).json({
          error: `Cannot import ${members.length} members. Only ${remaining} slots available.`,
        });
      }
    }

    // Map to DB format
    const rows = members.map((m) => ({
      project_id: projectId,
      org_id: project.org_id,
      name: m.name || "Unknown",
      email: m.email || null,
      photo_url: m.photo_url || "",
      status: "approved", // Bulk imports are auto-approved
      custom_fields: m.custom_fields || {},
    }));

    const { data, error } = await memberService.bulkInsertMembers(rows);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ imported: data?.length || 0, members: data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/bulk/generate/:projectId — Generate all cards for bulk project
 */
router.post("/generate/:projectId", verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const { projectId } = req.params;
    const { data: project } = await projectService.getProjectById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found." });

    // ── Pre-count members needing cards ─────────────────────
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

    // ── Deduct tokens ───────────────────────────────────────
    const { error: tokenErr } = await deductTokens(
      userId,
      needsCount,
      `Bulk generation – project ${projectId} (${needsCount} cards)`,
      `bulk_${projectId}`,
    );
    if (tokenErr) {
      const status = tokenErr.code === "INSUFFICIENT_TOKENS" ? 402 : 500;
      return res.status(status).json({ error: tokenErr.message });
    }

    const { cards, error } = await generateService.createCardRecords(
      project.org_id,
      projectId,
      project.expiry_days || 30,
    );

    if (error) {
      await refundTokens(userId, needsCount, `Refund – bulk generation failed: ${error.message}`, `bulk_${projectId}`);
      return res.status(500).json({ error: error.message });
    }

    // Refund over-deducted tokens
    const actualGenerated = cards?.length || 0;
    if (actualGenerated < needsCount) {
      const diff = needsCount - actualGenerated;
      await refundTokens(userId, diff, `Refund – only ${actualGenerated} of ${needsCount} cards generated`, `bulk_${projectId}`);
    }

    res.json({ generated: actualGenerated, cards });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bulk/status/:projectId — Get bulk generation status
 */
router.get("/status/:projectId", verifyToken, async (req, res, next) => {
  try {
    const stats = await projectService.getProjectStats(req.params.projectId);
    const { data: cards } = await generateService.getCardsByProject(
      req.params.projectId,
    );

    const failedCount = 0; // TODO: track rendering failures
    res.json({
      ...stats,
      cardsGenerated: cards?.length || 0,
      failedEntries: failedCount,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
