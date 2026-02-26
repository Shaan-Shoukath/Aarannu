import { jsPDF } from "jspdf";

/** Convert canvas pixels to millimetres (html2canvas captures at scale:2, screen=96 DPI). */
const pxToMm = (px, scale = 2) => (px / scale) * (25.4 / 96);

/**
 * Create a PDF blob from one or two canvases (front + optional back).
 * Each canvas becomes its own page, sized exactly to the card.
 */
export function canvasesToPdfBlob(frontCanvas, backCanvas = null) {
  const w = pxToMm(frontCanvas.width);
  const h = pxToMm(frontCanvas.height);
  const orientation = w > h ? "landscape" : "portrait";

  const pdf = new jsPDF({ orientation, unit: "mm", format: [w, h] });
  pdf.addImage(frontCanvas.toDataURL("image/png"), "PNG", 0, 0, w, h);

  if (backCanvas) {
    const bw = pxToMm(backCanvas.width);
    const bh = pxToMm(backCanvas.height);
    pdf.addPage([bw, bh], bw > bh ? "landscape" : "portrait");
    pdf.addImage(backCanvas.toDataURL("image/png"), "PNG", 0, 0, bw, bh);
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
