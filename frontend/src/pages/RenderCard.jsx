import { useEffect, useMemo, useState, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import IDCard from "../components/IDCard";
import CorporateCard from "../components/CorporateCard";
import EventCard from "../components/EventCard";
import StudentCard from "../components/StudentCard";
import { fixOklabColors } from "../utils/fixOklabColors";

/**
 * RenderCard Page — Headless Card Renderer
 * ═════════════════════════════════════════
 *
 * This page is NOT for end-users. It's visited by Puppeteer on the backend
 * to render ID cards server-side and capture them as screenshots/PDFs.
 *
 * Card data + styling is passed via the URL hash fragment:
 *   /render-card#<encoded JSON payload>
 *
 * Payload shape:
 *   {
 *     data: { name, role, id_number, ... },
 *     template: "custom" | "corporate" | "event" | "student",
 *     orgName, logoUrl, cardStyles, gradientColors,
 *     fieldVisibility, orientation, validityText, watermark
 *   }
 *
 * After rendering, this page:
 *   1. Sets data-render-ready="true" on the root div.
 *   2. Exposes window.__generatePDF() for the backend to call.
 */
export default function RenderCard() {
  const [ready, setReady] = useState(false);
  const frontRef = useRef(null);
  const backRef = useRef(null);

  // Parse payload from URL hash synchronously (not in an effect)
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

    // Give card components a moment to render fully (fonts, images)
    const timer = setTimeout(() => {
      // Expose PDF generation function for Puppeteer to invoke
      window.__generatePDF = async () => {
        try {
          fixOklabColors();

          const frontEl = frontRef.current?.querySelector(
            "[class*='shadow-2xl'], [class*='relative']",
          );
          const backEl = backRef.current?.querySelector(
            "[class*='shadow-2xl'], [class*='relative']",
          );

          if (!frontEl) return null;

          const frontCanvas = await html2canvas(frontEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
          });

          let backCanvas = null;
          if (backEl) {
            backCanvas = await html2canvas(backEl, {
              scale: 2,
              useCORS: true,
              backgroundColor: null,
            });
          }

          // Generate 2-page PDF
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

          // Front page
          pdf.addImage(
            frontCanvas.toDataURL("image/png"),
            "PNG",
            padding,
            padding,
            pageWidth,
            pageHeight,
          );

          // Back page
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

          // Return base64 (strip the data:application/pdf;base64, prefix)
          const pdfOutput = pdf.output("datauristring");
          const base64 = pdfOutput.split(",")[1];
          return base64;
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

  // Choose the right template component
  const templateMap = {
    custom: IDCard,
    corporate: CorporateCard,
    event: EventCard,
    student: StudentCard,
  };
  const CardComponent = templateMap[template] || IDCard;

  return (
    <div
      data-render-ready={ready ? "true" : "false"}
      className="min-h-screen bg-white p-4"
      style={{ fontFamily: "'Public Sans', sans-serif" }}
    >
      {/* FRONT SIDE — captured by Puppeteer via #card-front */}
      <div id="card-front" ref={frontRef}>
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

      {/* BACK SIDE — captured by Puppeteer via #card-back */}
      <div id="card-back" ref={backRef} className="mt-8">
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
