import { jsPDF } from "jspdf";

/** Convert canvas pixels to millimetres (html2canvas captures at scale:2, screen=96 DPI). */
const pxToMm = (px, scale = 2) => (px / scale) * (25.4 / 96);

/**
 * Create a PDF blob from one or two canvases (front + optional back).
 * Each canvas becomes its own page with padding so the card's rounded
 * corners and box-shadow are visible against the white page.
 */
export function canvasesToPdfBlob(frontCanvas, backCanvas = null) {
  const PAD = 3; // mm padding on each side

  const cw = pxToMm(frontCanvas.width);
  const ch = pxToMm(frontCanvas.height);
  const pw = cw + PAD * 2;
  const ph = ch + PAD * 2;
  const orientation = pw > ph ? "landscape" : "portrait";

  const pdf = new jsPDF({ orientation, unit: "mm", format: [pw, ph] });
  pdf.addImage(frontCanvas.toDataURL("image/png"), "PNG", PAD, PAD, cw, ch);

  if (backCanvas) {
    const bw = pxToMm(backCanvas.width);
    const bh = pxToMm(backCanvas.height);
    const bpw = bw + PAD * 2;
    const bph = bh + PAD * 2;
    pdf.addPage([bpw, bph], bpw > bph ? "landscape" : "portrait");
    pdf.addImage(backCanvas.toDataURL("image/png"), "PNG", PAD, PAD, bw, bh);
  }

  return pdf.output("blob");
}

/** Trigger a browser download for any Blob. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Convert a canvas to a JPEG blob. */
export function canvasToJpegBlob(canvas, quality = 0.95) {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}

/** Convert a canvas to a PNG blob. */
export function canvasToPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));
}

/** Build a safe filename from a member name + index. */
export function safeFileName(name, index, ext = "pdf") {
  const safe = (name || "unnamed")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${String(index + 1).padStart(5, "0")}_${safe}.${ext}`;
}
