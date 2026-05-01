import { useEffect, useMemo, useState } from "react";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import blobStream from "blob-stream";
import IDCard from "../components/IDCard";
import {
  DEFAULT_CARD_FONT_FAMILY,
  withMalayalamFontFallback,
} from "../utils/textSupport";

/**
 * RenderCard Page — Headless Card Renderer
 * ═════════════════════════════════════════
 *
 * This page is NOT for end-users. It's visited by Puppeteer on the backend
 * to render ID cards server-side and capture them as screenshots/PDFs.
 *
 * Flow:
 *   1. Backend encodes card payload as JSON in the URL hash.
 *   2. Puppeteer navigates here: /render-card#<encoded JSON>
 *   3. This page renders the card using the SAME React components
 *      used in the preview (IDCard, CorporateCard, etc.).
 *   4. Sets data-render-ready="true" once rendered.
 *   5. Puppeteer screenshots #card-front / #card-back elements directly.
 *   6. For PDF, Puppeteer calls window.__generatePDF() which uses PDFKit
 *      to combine front+back screenshots into a multi-page PDF.
 *
 * IMPORTANT: #card-front and #card-back use display:inline-block so they
 * shrink-wrap around the card. This ensures Puppeteer screenshots match
 * the exact card dimensions (not the full viewport width).
 */
export default function RenderCard() {
  const [ready, setReady] = useState(false);

  // Parse payload from URL hash synchronously
  const payload = useMemo(() => {
    try {
      const hash = window.location.hash.slice(1);
      if (hash) {
        return JSON.parse(decodeURIComponent(hash));
      }
    } catch (err) {
      console.error("[RenderCard] Failed to parse payload:", err);
    }
    return null;
  }, []);

  // After card components render, set ready flag + expose PDF generator
  useEffect(() => {
    if (!payload) return;

    let cancelled = false;
    let timerId = null;

    const markReady = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Ignore font readiness errors and continue with a timed fallback.
      }

      timerId = window.setTimeout(() => {
        if (cancelled) return;

        // Expose __generatePDF for the backend cardRenderer to call via Puppeteer
        // This creates a 2-page PDF from screenshots of #card-front and #card-back
        window.__generatePDF = async () => {
          try {
            const frontEl = document.querySelector("#card-front");
            const backEl = document.querySelector("#card-back");
            if (!frontEl) return null;

            const isVertical = payload.orientation === "vertical";
            const MM = 2.83465;
            const pageWidth = isVertical ? 63.5 * MM : 85.6 * MM;
            const pageHeight = isVertical ? 88.9 * MM : 53.98 * MM;
            const padding = 2 * MM;

            // eslint-disable-next-line no-async-promise-executor
            return new Promise(async (resolveOuter) => {
              try {
                const doc = new PDFDocument({
                  size: [pageWidth + padding * 2, pageHeight + padding * 2],
                  margins: { top: 0, bottom: 0, left: 0, right: 0 },
                  autoFirstPage: true,
                });

                const stream = doc.pipe(blobStream());

                // Use canvas from the DOM elements (Puppeteer runs in real Chromium)
                const frontCanvas = await domToCanvas(frontEl);
                if (frontCanvas) {
                  const frontPng = frontCanvas.toDataURL("image/png");
                  doc.image(frontPng, padding, padding, {
                    width: pageWidth,
                    height: pageHeight,
                  });
                }

                if (backEl) {
                  const backCanvas = await domToCanvas(backEl);
                  if (backCanvas) {
                    doc.addPage({
                      size: [pageWidth + padding * 2, pageHeight + padding * 2],
                      margins: { top: 0, bottom: 0, left: 0, right: 0 },
                    });
                    const backPng = backCanvas.toDataURL("image/png");
                    doc.image(backPng, padding, padding, {
                      width: pageWidth,
                      height: pageHeight,
                    });
                  }
                }

                doc.end();

                stream.on("finish", () => {
                  try {
                    const blob = stream.toBlob("application/pdf");
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = reader.result.split(",")[1];
                      resolveOuter(base64);
                    };
                    reader.readAsDataURL(blob);
                  } catch {
                    resolveOuter(null);
                  }
                });
                stream.on("error", () => resolveOuter(null));
              } catch {
                resolveOuter(null);
              }
            });
          } catch (err) {
            console.error("[RenderCard] PDF generation error:", err);
            return null;
          }
        };

        setReady(true);
      }, 350);
    };

    markReady();

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [payload]);

  if (!payload) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-500">Waiting for card data...</p>
      </div>
    );
  }

  const {
    data = {},
    template = "custom",
    orgName = "",
    logoUrl = "",
    cardStyles = {},
    gradientColors = {},
    fieldVisibility = {},
    orientation = "horizontal",
    validityText = "",
    watermark = {},
    customFields = [],
    signatureUrl = "",
    fullGradientBg = false,
    gradientOpacity = 0.55,
  } = payload;

  const resolvedCardStyles = {
    ...cardStyles,
    fontFamily: withMalayalamFontFallback(
      cardStyles.fontFamily || DEFAULT_CARD_FONT_FAMILY,
    ),
  };

  const templateMap = {
    custom: IDCard,
    corporate: IDCard,
    event: IDCard,
    student: IDCard,
  };
  const CardComponent = templateMap[template] || IDCard;

  return (
    <div
      data-render-ready={ready ? "true" : "false"}
      className="min-h-screen bg-white p-0"
      style={{ fontFamily: resolvedCardStyles.fontFamily }}
    >
      {/* FRONT — Puppeteer screenshots this element directly */}
      <div
        id="card-front"
        style={{
          display: "inline-block",
          background: "transparent",
          padding: 0,
        }}
      >
        <CardComponent
          data={data}
          template={template}
          showBack={false}
          renderSide="front"
          orgName={orgName}
          logoUrl={logoUrl}
          customFields={customFields}
          signatureUrl={signatureUrl}
          watermark={watermark}
          gradientColors={gradientColors}
          cardStyles={resolvedCardStyles}
          orientation={orientation}
          validityText={validityText}
          fieldVisibility={fieldVisibility}
          fullGradientBg={fullGradientBg}
          gradientOpacity={gradientOpacity}
        />
      </div>

      {/* BACK — Puppeteer screenshots this element directly */}
      <div
        id="card-back"
        style={{
          display: "inline-block",
          marginTop: "24px",
          background: "transparent",
          padding: 0,
        }}
      >
        <CardComponent
          data={data}
          template={template}
          showBack={true}
          renderSide="back"
          orgName={orgName}
          logoUrl={logoUrl}
          customFields={customFields}
          signatureUrl={signatureUrl}
          watermark={watermark}
          gradientColors={gradientColors}
          cardStyles={resolvedCardStyles}
          orientation={orientation}
          validityText={validityText}
          fieldVisibility={fieldVisibility}
          fullGradientBg={fullGradientBg}
          gradientOpacity={gradientOpacity}
        />
      </div>
    </div>
  );
}

/**
 * Convert a DOM element to a canvas using SVG foreignObject serialization.
 * Works in Puppeteer's real Chromium (no html2canvas needed).
 */
async function domToCanvas(el) {
  try {
    const rect = el.getBoundingClientRect();
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;

    const serialized = new XMLSerializer().serializeToString(el);
    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg"
           width="${rect.width * scale}" height="${rect.height * scale}">
        <foreignObject width="${rect.width}" height="${rect.height}"
                       style="transform: scale(${scale}); transform-origin: 0 0;">
          <body xmlns="http://www.w3.org/1999/xhtml"
                style="margin:0; padding:0;">
            ${serialized}
          </body>
        </foreignObject>
      </svg>
    `;

    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}
