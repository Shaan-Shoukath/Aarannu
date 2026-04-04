/**
 * Render Routes
 * ─────────────
 * /api/render — Server-side card rendering via Puppeteer.
 *
 * POST /api/render/card
 *   Body: { data, template, orgName, logoUrl, cardStyles, gradientColors,
 *           fieldVisibility, orientation, validityText, watermark,
 *           customFields, signatureUrl, fullGradientBg, gradientOpacity, format }
 *   format: "png" | "jpeg" | "pdf"  (default: "png")
 *   Returns: binary image/pdf with correct Content-Type
 */

const express = require("express");
const { apiLimiter } = require("../middleware/rateLimiter");
const { renderCard } = require("../services/cardRenderer");

const router = express.Router();

/**
 * POST /api/render/card — Render a single card and return as image/PDF.
 *
 * This endpoint is called by the frontend to generate pixel-perfect
 * downloads that match the preview exactly (Puppeteer = real Chromium).
 */
router.post("/card", apiLimiter, async (req, res) => {
  try {
    const {
      data,
      template,
      orgName,
      logoUrl,
      cardStyles,
      gradientColors,
      fieldVisibility,
      orientation,
      validityText,
      watermark,
      customFields,
      signatureUrl,
      fullGradientBg,
      gradientOpacity,
      format = "png",
    } = req.body;

    if (!data || !data.name) {
      return res
        .status(400)
        .json({ error: "Card data with name is required." });
    }

    const result = await renderCard({
      data,
      template: template || "custom",
      orgName: orgName || "",
      logoUrl: logoUrl || "",
      cardStyles: cardStyles || {},
      gradientColors: gradientColors || { start: "#2563EB", end: "#ef4444" },
      fieldVisibility: fieldVisibility || {},
      orientation: orientation || "horizontal",
      validityText: validityText || "Valid as per subscription plan",
      watermark: watermark || {},
      customFields: customFields || [],
      signatureUrl: signatureUrl || "",
      fullGradientBg: Boolean(fullGradientBg),
      gradientOpacity:
        typeof gradientOpacity === "number" ? gradientOpacity : 0.55,
    });

    if (format === "pdf") {
      if (!result.pdfBuffer) {
        return res.status(500).json({ error: "PDF generation failed." });
      }
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="id-card.pdf"`,
        "Cache-Control": "no-cache",
      });
      return res.send(result.pdfBuffer);
    }

    if (format === "jpeg") {
      if (!result.frontJpeg) {
        return res.status(500).json({ error: "JPEG generation failed." });
      }
      res.set({
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="id-card.jpg"`,
        "Cache-Control": "no-cache",
      });
      return res.send(result.frontJpeg);
    }

    // Default: PNG
    if (!result.frontPng) {
      return res.status(500).json({ error: "PNG generation failed." });
    }
    res.set({
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="id-card.png"`,
      "Cache-Control": "no-cache",
    });
    return res.send(result.frontPng);
  } catch (err) {
    console.error("[RenderRoute] Card render error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Card rendering failed.",
        details: err.message,
      });
    }
  }
});

module.exports = router;
