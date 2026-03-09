import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import IDCard from "../components/IDCard";
import CorporateCard from "../components/CorporateCard";
import EventCard from "../components/EventCard";
import StudentCard from "../components/StudentCard";

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
 *   6. For PDF, Puppeteer calls window.__generatePDF() which uses jsPDF
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

    // Give card components time to render (fonts, images, SVGs)
    const timer = setTimeout(() => {
      // Expose __generatePDF for the backend cardRenderer to call via Puppeteer
      // This creates a 2-page PDF from screenshots of #card-front and #card-back
      window.__generatePDF = async () => {
        try {
          const frontEl = document.querySelector("#card-front");
          const backEl = document.querySelector("#card-back");
          if (!frontEl) return null;

          const isVertical = payload.orientation === "vertical";
          const pageWidth = isVertical ? 63.5 : 85.6;
          const pageHeight = isVertical ? 88.9 : 53.98;
          const padding = 2;
          const pdfOrientation = isVertical ? "portrait" : "landscape";

          const pdf = new jsPDF({
            orientation: pdfOrientation,
            unit: "mm",
            format: [pageWidth + padding * 2, pageHeight + padding * 2],
          });

          // Use canvas from the DOM elements (Puppeteer runs in real Chromium)
          const frontCanvas = await domToCanvas(frontEl);
          if (frontCanvas) {
            pdf.addImage(
              frontCanvas.toDataURL("image/png"),
              "PNG",
              padding,
              padding,
              pageWidth,
              pageHeight,
            );
          }

          if (backEl) {
            const backCanvas = await domToCanvas(backEl);
            if (backCanvas) {
              pdf.addPage(
                [pageWidth + padding * 2, pageHeight + padding * 2],
                pdfOrientation,
              );
              pdf.addImage(
                backCanvas.toDataURL("image/png"),
                "PNG",
                padding,
                padding,
                pageWidth,
                pageHeight,
              );
            }
          }

          const pdfOutput = pdf.output("datauristring");
          return pdfOutput.split(",")[1]; // base64 only
        } catch (err) {
          console.error("[RenderCard] PDF generation error:", err);
          return null;
        }
      };

      setReady(true);
    }, 1500);

    return () => clearTimeout(timer);
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
  } = payload;

  const templateMap = {
    custom: IDCard,
    corporate: CorporateCard,
    event: EventCard,
    student: StudentCard,
  };
  const CardComponent = templateMap[template] || IDCard;

  // Compute contrasting background: white for dark cards, dark for light cards
  const contrastBg = (() => {
    const bg = cardStyles.bgColor || "#ffffff";
    // Parse hex to RGB
    const hex = bg.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    // Relative luminance (sRGB)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#1a1a2e" : "#ffffff";
  })();

  return (
    <div
      data-render-ready={ready ? "true" : "false"}
      className="min-h-screen"
      style={{ fontFamily: "'Public Sans', sans-serif" }}
    >
      {/* FRONT — Puppeteer screenshots this element directly */}
      <div
        id="card-front"
        style={{
          display: "inline-block",
          background: contrastBg,
          padding: "12px",
          borderRadius: "4px",
        }}
      >
        <CardComponent
          data={data}
          showBack={false}
          renderSide="front"
          orgName={orgName}
          logoUrl={logoUrl}
          customFields={customFields}
          signatureUrl={signatureUrl}
          watermark={watermark}
          gradientColors={gradientColors}
          cardStyles={cardStyles}
          orientation={orientation}
          validityText={validityText}
          fieldVisibility={fieldVisibility}
        />
      </div>

      {/* BACK — Puppeteer screenshots this element directly */}
      <div
        id="card-back"
        style={{
          display: "inline-block",
          marginTop: "32px",
          background: contrastBg,
          padding: "12px",
          borderRadius: "4px",
        }}
      >
        <CardComponent
          data={data}
          showBack={true}
          renderSide="back"
          orgName={orgName}
          logoUrl={logoUrl}
          customFields={customFields}
          signatureUrl={signatureUrl}
          watermark={watermark}
          gradientColors={gradientColors}
          cardStyles={cardStyles}
          orientation={orientation}
          validityText={validityText}
          fieldVisibility={fieldVisibility}
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
