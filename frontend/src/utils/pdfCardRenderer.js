/* global Buffer */
/**
 * pdfCardRenderer.js — Premium Client-Side PDF Card Generator (PDFKit)
 * =====================================================================
 *
 * Generates high-quality ID card PDFs entirely in the browser using PDFKit.
 * Design inspired by modern geometric gradient card aesthetics.
 *
 * Supports all 4 templates: custom, corporate, event, student.
 */

import PDFDocument from "pdfkit/js/pdfkit.standalone";
import blobStream from "blob-stream";
import QRCode from "qrcode";
import {
  containsMalayalam,
  firstGrapheme,
  normalizeDisplayText,
  uppercaseLatinOnly,
} from "./textSupport";

// ── Font Management ─────────────────────────────────
// PDFKit only ships Helvetica / Courier / Times-Roman.
// For web fonts (Public Sans, Inter) we fetch the TTF from
// Google Fonts at runtime and register them into the doc.
// System fonts map to the closest PDFKit built-in.

/** Google Fonts TTF download URLs (regular + bold weight) */
const GOOGLE_FONT_URLS = {
  "Public Sans": {
    regular:
      "https://fonts.gstatic.com/s/publicsans/v15/ijwGs572Xtc6ZYQws9YVwllKVG8qX1oyOymuFpmJwA0.ttf",
    bold: "https://fonts.gstatic.com/s/publicsans/v15/ijwGs572Xtc6ZYQws9YVwllKVG8qX1oyOymuz5iJwA0.ttf",
  },
  Inter: {
    regular:
      "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.ttf",
    bold: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.ttf",
  },
};

/** Mapping from CSS fontFamily value → PDFKit built-in font names */
const BUILTIN_FONT_MAP = {
  "Arial, sans-serif": { regular: "Helvetica", bold: "Helvetica-Bold" },
  "Georgia, serif": { regular: "Times-Roman", bold: "Times-Bold" },
  "'Times New Roman', serif": { regular: "Times-Roman", bold: "Times-Bold" },
  "'Courier New', monospace": { regular: "Courier", bold: "Courier-Bold" },
  "Verdana, sans-serif": { regular: "Helvetica", bold: "Helvetica-Bold" },
  "'Trebuchet MS', sans-serif": { regular: "Helvetica", bold: "Helvetica-Bold" },
};

/** Cache for fetched font ArrayBuffers so we only download once */
const fontCache = new Map();

/**
 * Extract the font name from a CSS fontFamily string.
 * "'Public Sans', sans-serif" → "Public Sans"
 */
function extractFontName(cssFontFamily) {
  if (!cssFontFamily) return null;
  const first = cssFontFamily.split(",")[0].trim();
  return first.replace(/^['"]|['"]$/g, "");
}

/**
 * Fetch a TTF font file and return it as an ArrayBuffer.
 * Results are cached so repeat calls are free.
 */
async function fetchFontBuffer(url) {
  if (fontCache.has(url)) return fontCache.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    fontCache.set(url, buf);
    return buf;
  } catch {
    return null;
  }
}

/**
 * Pre-download font files so they're in cache before PDF generation.
 * Called in parallel with loadImages() to avoid sequential delays.
 */
async function prefetchFonts(cssFontFamily) {
  if (!cssFontFamily || BUILTIN_FONT_MAP[cssFontFamily]) return;
  const fontName = extractFontName(cssFontFamily);
  const urls = GOOGLE_FONT_URLS[fontName];
  if (!urls) return;
  await Promise.all([fetchFontBuffer(urls.regular), fetchFontBuffer(urls.bold)]);
}

/**
 * Register the user's fontFamily into a PDFDocument and return
 * { regular, bold } names usable with doc.font().
 * Assumes font buffers are already cached via prefetchFonts().
 */
async function resolveFont(doc, cssFontFamily) {
  const fallback = { regular: "Helvetica", bold: "Helvetica-Bold" };
  if (!cssFontFamily) return fallback;

  // Check built-in map first (Arial, Georgia, etc.)
  if (BUILTIN_FONT_MAP[cssFontFamily]) {
    return BUILTIN_FONT_MAP[cssFontFamily];
  }

  // Check if it's a Google Font we can download
  const fontName = extractFontName(cssFontFamily);
  const urls = GOOGLE_FONT_URLS[fontName];
  if (!urls) return fallback;

  const regName = `${fontName}-Regular`;
  const boldName = `${fontName}-Bold`;

  // Fetch from cache (instant if prefetchFonts ran), or download as fallback
  const [regBuf, boldBuf] = await Promise.all([
    fetchFontBuffer(urls.regular),
    fetchFontBuffer(urls.bold),
  ]);

  if (regBuf) {
    doc.registerFont(regName, regBuf);
  }
  if (boldBuf) {
    doc.registerFont(boldName, boldBuf);
  }

  return {
    regular: regBuf ? regName : fallback.regular,
    bold: boldBuf ? boldName : fallback.bold,
  };
}

// ── Unit Conversion ──────────────────────────────────
// PDFKit uses points (72pt = 1 inch, 1mm = 2.83465pt)
const MM = 2.83465;

// ── CR-80 Card Dimensions (points) ───────────────────
const CARD_H = { w: 85.6 * MM, h: 53.98 * MM }; // horizontal
const CARD_V = { w: 53.98 * MM, h: 85.6 * MM }; // vertical
const PAD = 2 * MM;

// ── Image Cache ──────────────────────────────────────
const imageCache = new Map();

// ── Color Utilities ──────────────────────────────────
function hexToRgb(hex) {
  const c = (hex || "#000000").replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16) || 0,
    parseInt(c.substring(2, 4), 16) || 0,
    parseInt(c.substring(4, 6), 16) || 0,
  ];
}

function rgbToHex(r, g, b) {
  if (Array.isArray(r)) [r, g, b] = r;
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

// ── Gradient Drawing ─────────────────────────────────
function drawDiagonalGradient(doc, x, y, w, h, startHex, endHex) {
  if (typeof doc.linearGradient === "function") {
    const gradient = doc.linearGradient(x, y, x + w, y + h);
    gradient.stop(0, startHex).stop(1, endHex);
    doc.rect(x, y, w, h).fill(gradient);
    return;
  }

  drawGradientH(doc, x, y, w, h, startHex, endHex, 120);
}

function drawGradientH(doc, x, y, w, h, startHex, endHex, steps = 40) {
  const c1 = hexToRgb(startHex);
  const c2 = hexToRgb(endHex);
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const c = lerpColor(c1, c2, i / (steps - 1));
    doc.save();
    doc.rect(x + i * sw, y, sw + 0.3, h).fill(rgbToHex(c));
    doc.restore();
  }
}

// ── Image / QR Utilities ─────────────────────────────
function proxyUrl(url) {
  if (!url) return url;
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("/") ||
    url.startsWith(".")
  )
    return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
      return url;
    const backend =
      (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_BACKEND_URL) ||
      "http://localhost:5000";
    return `${backend}/api/proxy/image?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

async function fetchImageAsDataUrl(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  const cacheKey = url;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
  try {
    const res = await fetch(proxyUrl(url), { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const result = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    imageCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

function dataUrlToBuffer(dataUrl) {
  if (!dataUrl) return null;
  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return Buffer.from(bytes.buffer);
  } catch {
    return null;
  }
}

async function generateQRDataUrl(value) {
  try {
    return await QRCode.toDataURL(value || "0000", {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

function getVerificationUrl(params) {
  const data = params?.data || {};
  const id =
    data.card_id ||
    data.cardId ||
    data.delivery_card_id ||
    data.id_number ||
    "unknown";
  const path = `/members/${encodeURIComponent(id)}`;
  if (data.verification_url || data.verificationUrl || data.delivery_verification_url) {
    return data.verification_url || data.verificationUrl || data.delivery_verification_url;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

async function loadImages(params) {
  const { data = {}, logoUrl, watermark = {}, signatureUrl } = params;
  const [photo, logo, watermarkImg, signature] = await Promise.all([
    fetchImageAsDataUrl(data.photo_url || null),
    fetchImageAsDataUrl(logoUrl || null),
    fetchImageAsDataUrl(watermark?.imageUrl || null),
    fetchImageAsDataUrl(signatureUrl || null),
  ]);
  const qr = await generateQRDataUrl(getVerificationUrl(params));
  return {
    photo: dataUrlToBuffer(photo),
    logo: dataUrlToBuffer(logo),
    watermarkImg: dataUrlToBuffer(watermarkImg),
    signature: dataUrlToBuffer(signature),
    qr: dataUrlToBuffer(qr),
  };
}

function safeAddImage(doc, imgBuf, x, y, w, h) {
  if (!imgBuf) return;
  try {
    doc.image(imgBuf, x, y, { width: w, height: h });
  } catch {
    /* skip unreadable images */
  }
}

function safeCoverImage(doc, imgBuf, x, y, w, h) {
  if (!imgBuf) return;
  try {
    doc.image(imgBuf, x, y, {
      cover: [w, h],
      align: "center",
      valign: "center",
    });
  } catch {
    safeAddImage(doc, imgBuf, x, y, w, h);
  }
}

function drawCardShell(doc, cx, cy, cw, ch, radius, gc, opts = {}) {
  const cardBg = opts.bgColor || "#ffffff";
  const useFullGradient = Boolean(opts.fullGradientBg);
  const opacity = Math.max(0.08, Math.min(1, Number(opts.gradientOpacity) || 0.55));
  const gradientStyle = opts.gradientStyle || "diagonal";
  doc.save();
  doc.roundedRect(cx, cy, cw, ch, radius).fill(cardBg);
  doc.restore();
  if (useFullGradient) {
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).clip();
    doc.fillOpacity(opacity);
    if (gradientStyle === "split") {
      doc.rect(cx, cy, cw * 0.42, ch).fill(gc.start);
      doc.rect(cx + cw * 0.42, cy, cw * 0.16, ch).fill("#ffffff");
      doc.rect(cx + cw * 0.58, cy, cw * 0.42, ch).fill(gc.end);
    } else if (gradientStyle === "ribbon") {
      drawGradientH(doc, cx, cy, cw, ch, gc.start, gc.end, 100);
    } else {
      drawDiagonalGradient(doc, cx, cy, cw, ch, gc.start, gc.end);
    }
    doc.restore();
  }
  doc.save();
  doc.fillOpacity(useFullGradient ? 0.34 : 0.5);
  doc
    .moveTo(cx + cw - 36 * MM, cy + 5 * MM)
    .lineTo(cx + cw, cy + 5 * MM)
    .lineTo(cx + cw - 10 * MM, cy + 27 * MM)
    .lineTo(cx + cw - 45 * MM, cy + 27 * MM)
    .closePath()
    .fill("#ffffff");
  doc
    .moveTo(cx - 20 * MM, cy + ch - 18 * MM)
    .lineTo(cx + 35 * MM, cy + ch - 18 * MM)
    .lineTo(cx + 25 * MM, cy + ch + 5 * MM)
    .lineTo(cx - 30 * MM, cy + ch + 5 * MM)
    .closePath()
    .fill("#ffffff");
  doc.roundedRect(cx, cy, cw, ch, radius).strokeColor("#d7deea").lineWidth(0.7).stroke();
  doc.restore();
}

function drawLogoMark(doc, images, x, y, size, text, gc, fonts) {
  doc.save();
  doc.roundedRect(x, y, size, size, 4).fill("#ffffff");
  doc.roundedRect(x, y, size, size, 4).strokeColor("#dbe4f0").lineWidth(0.5).stroke();
  doc.restore();
  if (images.logo) {
    safeAddImage(doc, images.logo, x + 1.2 * MM, y + 1.2 * MM, size - 2.4 * MM, size - 2.4 * MM);
    return;
  }
  doc.font(fonts.bold).fontSize(7).fillColor(gc.start);
  doc.text(text, x, y + size / 2 - 3, { width: size, align: "center", lineBreak: false });
}

function drawProfessionalFront(doc, params, images, fonts) {
  const {
    data = {},
    orgName = "",
    gradientColors: gc = { start: "#2563EB", end: "#ef4444" },
    cardStyles: cs = {},
    orientation = "horizontal",
    fieldVisibility: fv = {},
    customFields = [],
    watermark = {},
    fullGradientBg = false,
    gradientOpacity = 0.55,
  } = params;
  const isVert = orientation === "vertical";
  const card = isVert ? CARD_V : CARD_H;
  const cx = PAD;
  const cy = PAD;
  const cw = card.w;
  const ch = card.h;
  const radius = Math.min((cs.borderRadius || 12) * 0.75, 12);
  const {
    name = "Full Name",
    role = "Member",
    id_number = "0000 0000 0000",
    dob = "",
    gender = "",
    blood_group = "",
    customValues = {},
  } = data;
  const orgDisplayName = uppercaseLatinOnly(orgName || "Community ID");
  const displayName = uppercaseLatinOnly(name);
  const displayRole = uppercaseLatinOnly(role);
  const membershipIdText = normalizeDisplayText(id_number);
  const frontFields = (customFields || []).filter((f) => f.side === "front");
  const getCustomFieldDisplayValue = (label) =>
    uppercaseLatinOnly(customValues[label] || "-");

  const textColor = cs.fontColor || "#0f172a";
  const accentColor = cs.accentColor || gc.start || "#2563EB";
  const mutedColor = textColor === "#ffffff" ? "#e2e8f0" : "#64748b";
  const panelFill = "#ffffff";
  const softFill = fullGradientBg ? "#ffffff" : "#f8fafc";
  const nameScale = (Number(cs.nameFontSize) || 20) / 20;
  const valueScale = (Number(cs.valueFontSize) || 14) / 14;
  const labelScale = (Number(cs.labelFontSize) || 9) / 9;
  const photoScaleF = Math.max(0.65, Math.min(1.25, (Number(cs.photoScale) || 100) / 100));

  drawCardShell(doc, cx, cy, cw, ch, radius, gc, {
    bgColor: cs.bgColor,
    fullGradientBg,
    gradientOpacity,
    gradientStyle: cs.gradientStyle,
  });

  const margin = isVert ? 4 * MM : 5 * MM;
  const logoSize = 9 * MM;
  const logoText = firstGrapheme(orgDisplayName || "A") || "A";
  const headerY = cy + 5 * MM;
  drawLogoMark(doc, images, cx + margin, headerY, logoSize, logoText, gc, fonts);

  doc.font(fonts.bold).fontSize((isVert ? 8 : 10.5) * Math.min(nameScale, 1.15)).fillColor(textColor);
  doc.text(orgDisplayName, cx + margin + logoSize + 2 * MM, headerY + 1.1 * MM, {
    width: cw - margin * 2 - logoSize * 2 - 4 * MM,
    align: "center",
    ellipsis: true,
    lineBreak: false,
  });
  doc.font(fonts.bold).fontSize(4.2 * labelScale).fillColor(mutedColor);
  doc.text("DIGITAL IDENTITY CARD", cx + margin + logoSize + 2 * MM, headerY + 5.4 * MM, {
    width: cw - margin * 2 - logoSize * 2 - 4 * MM,
    align: "center",
    lineBreak: false,
  });

  const bodyTop = headerY + 13 * MM;
  const photoW = (isVert ? 25 * MM : 23 * MM) * photoScaleF;
  const photoH = (isVert ? 29 * MM : 27 * MM) * photoScaleF;
  const photoX = isVert ? cx + (cw - photoW) / 2 : cx + margin;
  const photoY = bodyTop;
  doc.save();
  doc.roundedRect(photoX - 1 * MM, photoY - 1 * MM, photoW + 2 * MM, photoH + 2 * MM, 6).fill("#ffffff");
  doc.roundedRect(photoX - 1 * MM, photoY - 1 * MM, photoW + 2 * MM, photoH + 2 * MM, 6).strokeColor("#cbd5e1").lineWidth(0.6).stroke();
  doc.restore();
  if (images.photo) {
    safeCoverImage(doc, images.photo, photoX, photoY, photoW, photoH);
  } else {
    doc.save();
    doc.roundedRect(photoX, photoY, photoW, photoH, 5).fill("#f1f5f9");
    doc.restore();
    doc.font(fonts.bold).fontSize(6 * valueScale).fillColor(mutedColor);
    doc.text("No Photo", photoX, photoY + photoH / 2 - 3, { width: photoW, align: "center" });
  }

  if (!isVert) {
    doc.save();
    doc.roundedRect(photoX, photoY + photoH + 2.5 * MM, photoW, 6 * MM, 4).fill(panelFill);
    doc.roundedRect(photoX, photoY + photoH + 2.5 * MM, photoW, 6 * MM, 4).strokeColor("#e2e8f0").lineWidth(0.4).stroke();
    doc.restore();
    doc.font(fonts.bold).fontSize(3.5 * labelScale).fillColor(mutedColor);
    doc.text("ROLE", photoX, photoY + photoH + 3.4 * MM, { width: photoW, align: "center", lineBreak: false });
    doc.font(fonts.bold).fontSize(4.8 * valueScale).fillColor(accentColor);
    doc.text(displayRole, photoX + 1 * MM, photoY + photoH + 5.2 * MM, {
      width: photoW - 2 * MM,
      align: "center",
      ellipsis: true,
      lineBreak: false,
    });
  }

  const detailX = isVert ? cx + margin : photoX + photoW + 6 * MM;
  const detailY = isVert ? photoY + photoH + 5 * MM : bodyTop + 1 * MM;
  const detailW = isVert ? cw - margin * 2 : cx + cw - margin - detailX;

  doc.save();
  doc.roundedRect(detailX - 2 * MM, detailY - 2 * MM, detailW + 4 * MM, isVert ? 47 * MM : 33 * MM, 5).fill(panelFill);
  doc.roundedRect(detailX - 2 * MM, detailY - 2 * MM, detailW + 4 * MM, isVert ? 47 * MM : 33 * MM, 5).strokeColor("#e2e8f0").lineWidth(0.4).stroke();
  doc.restore();

  doc.font(fonts.bold).fontSize(4.4 * labelScale).fillColor(accentColor);
  doc.text("FULL NAME", detailX, detailY, { lineBreak: false });
  doc.font(fonts.bold).fontSize((isVert ? 11 : 13) * nameScale).fillColor(textColor);
  doc.text(displayName, detailX, detailY + 3 * MM, {
    width: detailW,
    height: isVert ? 10 * MM : 8 * MM,
    ellipsis: true,
  });

  let y = detailY + (isVert ? 13 * MM : 12 * MM);
  if (fv.role !== false && isVert) {
    doc.save();
    doc.roundedRect(detailX, y, Math.min(detailW, 34 * MM), 6 * MM, 9).fill("#eff6ff");
    doc.restore();
    doc.font(fonts.bold).fontSize(6 * valueScale).fillColor(accentColor);
    doc.text(displayRole, detailX + 2.5 * MM, y + 1.8 * MM, {
      width: Math.min(detailW, 30 * MM),
      ellipsis: true,
      lineBreak: false,
    });
    y += 9 * MM;
  }

  doc.save();
  doc.roundedRect(detailX, y, detailW, 8 * MM, 4).fill(fullGradientBg ? panelFill : "#eff6ff");
  doc.roundedRect(detailX, y, detailW, 8 * MM, 4).strokeColor("#dbeafe").lineWidth(0.35).stroke();
  doc.restore();
  doc.font(fonts.bold).fontSize(4.1 * labelScale).fillColor(accentColor);
  doc.text("MEMBER ID", detailX + 2 * MM, y + 1.2 * MM, { lineBreak: false });
  doc.font(containsMalayalam(membershipIdText) ? fonts.bold : "Courier-Bold").fontSize(10 * valueScale).fillColor(textColor);
  doc.text(membershipIdText, detailX + 2 * MM, y + 4 * MM, { width: detailW - 4 * MM, lineBreak: false });
  y += 9 * MM;

  const fieldPairs = [];
  if (fv.dob !== false && dob) fieldPairs.push(["DOB", uppercaseLatinOnly(dob)]);
  if (fv.gender !== false && gender) fieldPairs.push(["GENDER", uppercaseLatinOnly(gender)]);
  if (fv.blood_group !== false && blood_group) fieldPairs.push(["BLOOD", uppercaseLatinOnly(blood_group)]);
  frontFields.slice(0, 2).forEach((f) => fieldPairs.push([uppercaseLatinOnly(f.label), getCustomFieldDisplayValue(f.label)]));
  const colW = detailW / 2;
  fieldPairs.slice(0, 4).forEach(([label, value], index) => {
    const fx = detailX + (index % 2) * colW;
    const fy = y + Math.floor(index / 2) * 8 * MM;
    doc.save();
    doc.roundedRect(fx, fy, colW - 2 * MM, 6.5 * MM, 3).fill(softFill);
    doc.roundedRect(fx, fy, colW - 2 * MM, 6.5 * MM, 3).strokeColor("#e2e8f0").lineWidth(0.3).stroke();
    doc.restore();
    doc.font(fonts.bold).fontSize(4.2 * labelScale).fillColor(mutedColor);
    doc.text(label, fx + 1.3 * MM, fy + 1 * MM, { width: colW - 4 * MM, lineBreak: false });
    doc.font(fonts.bold).fontSize(6.2 * valueScale).fillColor(textColor);
    doc.text(value, fx + 1.3 * MM, fy + 3.5 * MM, { width: colW - 4 * MM, ellipsis: true, lineBreak: false });
  });

  const footerY = cy + ch - 7 * MM;
  doc.save();
  doc.moveTo(cx + margin, footerY - 2 * MM).lineTo(cx + cw - margin, footerY - 2 * MM).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  doc.restore();
  doc.font(fonts.bold).fontSize(4 * labelScale).fillColor(mutedColor);
  doc.text("VALID AS PER SUBSCRIPTION PLAN", cx + margin, footerY, { lineBreak: false });
  doc.text("VERIFY ON BACK", cx + margin, footerY, { width: cw - margin * 2, align: "right", lineBreak: false });

  drawWatermark(doc, cx, cy, cw, ch, watermark, gc, fonts);
}

function drawProfessionalBack(doc, params, images, fonts) {
  const {
    data = {},
    orgName = "",
    gradientColors: gc = { start: "#2563EB", end: "#ef4444" },
    cardStyles: cs = {},
    orientation = "horizontal",
    fieldVisibility: fv = {},
    customFields = [],
    validityText = "Valid as per subscription plan",
    watermark = {},
    fullGradientBg = false,
    gradientOpacity = 0.55,
  } = params;
  const isVert = orientation === "vertical";
  const card = isVert ? CARD_V : CARD_H;
  const cx = PAD;
  const cy = PAD;
  const cw = card.w;
  const ch = card.h;
  const radius = Math.min((cs.borderRadius || 12) * 0.75, 12);
  const margin = isVert ? 4 * MM : 5 * MM;
  const { address = "", customValues = {} } = data;
  const backFields = (customFields || []).filter((f) => f.side === "back");
  const getBackFieldValue = (label) => uppercaseLatinOnly(customValues[label] || "-");
  const orgDisplayName = uppercaseLatinOnly(orgName || "Community ID");
  const logoText = firstGrapheme(orgDisplayName || "A") || "A";
  const textColor = cs.fontColor || "#0f172a";
  const accentColor = cs.accentColor || gc.start || "#2563EB";
  const mutedColor = textColor === "#ffffff" ? "#e2e8f0" : "#64748b";
  const panelFill = "#ffffff";
  const valueScale = (Number(cs.valueFontSize) || 14) / 14;
  const labelScale = (Number(cs.labelFontSize) || 9) / 9;

  drawCardShell(doc, cx, cy, cw, ch, radius, gc, {
    bgColor: cs.bgColor,
    fullGradientBg,
    gradientOpacity,
    gradientStyle: cs.gradientStyle,
  });
  const headerY = cy + 5 * MM;
  const logoSize = 8 * MM;
  drawLogoMark(doc, images, cx + margin, headerY, logoSize, logoText, gc, fonts);
  doc.font(fonts.bold).fontSize((isVert ? 7.5 : 9) * valueScale).fillColor(textColor);
  doc.text(orgDisplayName, cx + margin + logoSize + 2 * MM, headerY + 1 * MM, {
    width: cw - margin * 2 - logoSize * 2 - 4 * MM,
    align: "center",
    ellipsis: true,
    lineBreak: false,
  });
  doc.font(fonts.bold).fontSize(3.9 * labelScale).fillColor(mutedColor);
  doc.text("VERIFICATION DETAILS", cx + margin + logoSize + 2 * MM, headerY + 4.8 * MM, {
    width: cw - margin * 2 - logoSize * 2 - 4 * MM,
    align: "center",
    lineBreak: false,
  });
  doc.save();
  doc.moveTo(cx + margin, headerY + 11 * MM).lineTo(cx + cw - margin, headerY + 11 * MM).strokeColor("#e2e8f0").lineWidth(0.45).stroke();
  doc.restore();

  const qrSize = isVert ? 22 * MM : 20 * MM;
  const qrX = isVert ? cx + (cw - qrSize) / 2 : cx + cw - margin - qrSize - 2 * MM;
  const qrY = isVert ? cy + ch - margin - qrSize - 9 * MM : headerY + 18 * MM;

  let y = headerY + 16 * MM;
  const textW = isVert ? cw - margin * 2 : qrX - margin - (cx + margin);
  const panelH = isVert ? ch - 42 * MM : 28 * MM;
  doc.save();
  doc.roundedRect(cx + margin, y - 3 * MM, textW, panelH, 5).fill(panelFill);
  doc.roundedRect(cx + margin, y - 3 * MM, textW, panelH, 5).strokeColor("#e2e8f0").lineWidth(0.4).stroke();
  doc.restore();
  const contentX = cx + margin + 3 * MM;
  const contentW = textW - 6 * MM;
  if (fv.address !== false) {
    doc.font(fonts.bold).fontSize(5 * labelScale).fillColor(accentColor);
    doc.text("ADDRESS", contentX, y, { lineBreak: false });
    y += 3.5 * MM;
    doc.font(fonts.regular).fontSize(6.3 * valueScale).fillColor(textColor);
    doc.text(uppercaseLatinOnly(address || "Address not provided"), contentX, y, {
      width: contentW,
      lineGap: 1,
    });
    y = doc.y + 4 * MM;
  }
  doc.font(fonts.bold).fontSize(5 * labelScale).fillColor(accentColor);
  doc.text("ISSUING AUTHORITY", contentX, y, { lineBreak: false });
  y += 3.5 * MM;
  doc.font(fonts.bold).fontSize(7 * valueScale).fillColor(textColor);
  doc.text(orgDisplayName, contentX, y, {
    width: contentW,
    ellipsis: true,
    lineBreak: false,
  });
  y += 7 * MM;
  backFields.slice(0, 3).forEach((f) => {
    doc.font(fonts.bold).fontSize(4.4 * labelScale).fillColor(mutedColor);
    doc.text(uppercaseLatinOnly(f.label), contentX, y, { width: contentW, lineBreak: false });
    doc.font(fonts.bold).fontSize(6 * valueScale).fillColor(textColor);
    doc.text(getBackFieldValue(f.label), contentX, y + 3 * MM, { width: contentW, ellipsis: true, lineBreak: false });
    y += 7 * MM;
  });

  doc.save();
  doc.roundedRect(qrX - 3 * MM, qrY - 5 * MM, qrSize + 6 * MM, qrSize + 14 * MM, 5).fill(fullGradientBg ? panelFill : "#eff6ff");
  doc.roundedRect(qrX - 3 * MM, qrY - 5 * MM, qrSize + 6 * MM, qrSize + 14 * MM, 5).strokeColor("#dbeafe").lineWidth(0.5).stroke();
  doc.roundedRect(qrX - 1.5 * MM, qrY - 1.5 * MM, qrSize + 3 * MM, qrSize + 3 * MM, 4).fill("#ffffff");
  doc.roundedRect(qrX - 1.5 * MM, qrY - 1.5 * MM, qrSize + 3 * MM, qrSize + 3 * MM, 4).strokeColor("#dbe4f0").lineWidth(0.5).stroke();
  doc.restore();
  if (images.qr) safeAddImage(doc, images.qr, qrX, qrY, qrSize, qrSize);
  doc.font(fonts.bold).fontSize(4 * labelScale).fillColor(mutedColor);
  doc.text("SCAN FOR VERIFICATION", qrX - 3 * MM, qrY + qrSize + 3 * MM, {
    width: qrSize + 6 * MM,
    align: "center",
    lineBreak: false,
  });

  const footerY = cy + ch - 7 * MM;
  doc.save();
  doc.moveTo(cx + margin, footerY - 2 * MM).lineTo(cx + cw - margin, footerY - 2 * MM).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  doc.restore();
  doc.font(fonts.bold).fontSize(4 * labelScale).fillColor(mutedColor);
  doc.text(orgDisplayName, cx + margin, footerY, { lineBreak: false });
  doc.text(uppercaseLatinOnly(validityText), cx + margin, footerY, {
    width: cw - margin * 2,
    align: "right",
    lineBreak: false,
  });

  drawWatermark(doc, cx, cy, cw, ch, watermark, gc, fonts);
}

// ── Template Constants ───────────────────────────────
const TEMPLATE_SUBTITLE = {
  custom: "Digital Identity Card",
  corporate: "Employee ID Card",
  event: "Access Pass",
  student: "Student Identity Card",
};

const TEMPLATE_BACK_LABELS = {
  custom: { section: "ADDRESS", authority: "ISSUING AUTHORITY" },
  corporate: { section: "ADDRESS", authority: "ISSUING AUTHORITY" },
  event: { section: "EVENT DETAILS", authority: "ORGANIZED BY" },
  student: { section: "PERSONAL DETAILS", authority: "INSTITUTION" },
};

// ══════════════════════════════════════════════════════
//  FRONT PAGE
// ══════════════════════════════════════════════════════
function drawFront(doc, params, images, fonts) {
  const {
    data = {},
    template = "custom",
    orgName = "",
    gradientColors: gc = { start: "#2563EB", end: "#ef4444" },
    cardStyles: cs = {},
    orientation = "horizontal",
    fieldVisibility: fv = {},
    customFields = [],
    watermark = {},
    fullGradientBg = true,
    gradientOpacity = 0.55,
  } = params;

  if (params?.template !== "__legacy_pdf") {
    drawProfessionalFront(doc, params, images, fonts);
    return;
  }

  const isVert = orientation === "vertical";
  const card = isVert ? CARD_V : CARD_H;
  const cx = PAD;
  const cy = PAD;
  const cw = card.w;
  const ch = card.h;
  const radius = Math.min((cs.borderRadius || 12) * 0.75, 12);

  // ── Style scaling (map user px values → PDFKit pt proportionally) ──
  const nameScale = (cs.nameFontSize || 20) / 20;
  const valueScale = (cs.valueFontSize || 14) / 14;
  const labelScale = (cs.labelFontSize || 9) / 9;
  const photoScaleF = Math.max(0.6, Math.min(1.4, (cs.photoScale || 100) / 100));

  const {
    name = "Full Name",
    role = "Member",
    id_number = "0000 0000 0000",
    dob = "",
    gender = "",
    blood_group = "",
    customValues = {},
  } = data;

  const frontFields = (customFields || []).filter((f) => f.side === "front");
  const orgDisplayName = uppercaseLatinOnly(orgName || "Community ID");
  const logoFallbackText = firstGrapheme(orgDisplayName || "C") || "C";
  const displayName = uppercaseLatinOnly(name);
  const displayRole = uppercaseLatinOnly(role);
  const displayDob = uppercaseLatinOnly(dob);
  const displayGender = uppercaseLatinOnly(gender);
  const displayBloodGroup = uppercaseLatinOnly(blood_group);
  const getCustomFieldDisplayValue = (label) =>
    uppercaseLatinOnly(customValues[label] || "—");
  const membershipIdText = normalizeDisplayText(id_number);

  // ── 0. Black page background (shows rounded card edges) ──
  doc.save();
  doc.rect(0, 0, cx + cw + PAD, cy + ch + PAD).fill('#000000');
  doc.restore();

  // ── 1. Background ──
  if (fullGradientBg) {
    // White base layer (shows through when gradientOpacity < 1)
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).fill("#ffffff");
    doc.restore();

    // Clip to rounded card shape so gradient doesn't bleed onto black page
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).clip();

    // Draw gradient with user-controlled opacity over white
    const gOpacity = Math.max(0, Math.min(1, gradientOpacity));
    doc.save();
    doc.fillOpacity(gOpacity);
    drawDiagonalGradient(doc, cx, cy, cw, ch, gc.start, gc.end);
    doc.restore();

    doc.restore(); // end clip

    // Rounded border on gradient card (semi-transparent white)
    doc.save();
    doc.strokeOpacity(0.2);
    doc.roundedRect(cx, cy, cw, ch, radius).strokeColor('#ffffff').lineWidth(0.8).stroke();
    doc.restore();
  } else {
    // Card with corner gradient triangles — respects custom bgColor
    const cardBg = cs.bgColor || "#ffffff";
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).fill(cardBg);
    doc.restore();

    // Clip triangles to the rounded card shape
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).clip();

    const triSize = (isVert ? 18 : 22) * MM;
    const c1 = hexToRgb(gc.start);
    const c2 = hexToRgb(gc.end);
    const triSteps = 30;

    // Top-right triangle
    for (let i = 0; i < triSteps; i++) {
      const t = i / triSteps;
      const c = lerpColor(c1, c2, t);
      doc.save();
      doc
        .moveTo(cx + cw - triSize + triSize * t, cy)
        .lineTo(cx + cw, cy)
        .lineTo(cx + cw, cy + triSize * (1 - t))
        .closePath()
        .fill(rgbToHex(c));
      doc.restore();
    }
    // Bottom-left triangle
    for (let i = 0; i < triSteps; i++) {
      const t = i / triSteps;
      const c = lerpColor(c1, c2, t);
      doc.save();
      doc
        .moveTo(cx, cy + ch - triSize + triSize * t)
        .lineTo(cx, cy + ch)
        .lineTo(cx + triSize * (1 - t), cy + ch)
        .closePath()
        .fill(rgbToHex(c));
      doc.restore();
    }

    doc.restore(); // end clip

    // Border
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).strokeColor("#dcdce6").lineWidth(0.5).stroke();
    doc.restore();
  }

  // ── Color palette based on background (respects user overrides) ──
  const WHITE = "#ffffff";
  const mainText = "#111111";
  const labelText = "#2f2f2f";
  const accentText = "#111111";
  const subtitleText = "#3f3f46";
  const headerText = "#111111";
  const labelFontSize = 4.8 * labelScale;

  if (isVert) {
    // ══════════ VERTICAL FRONT ══════════
    const margin = 4 * MM;
    const headerY = cy + 4 * MM;

    // Logo
    if (images.logo) {
      doc.save();
      doc.roundedRect(cx + margin, headerY, 7 * MM, 7 * MM, 3).fill(WHITE);
      doc.restore();
      safeAddImage(doc, images.logo, cx + margin + 0.5 * MM, headerY + 0.5 * MM, 6 * MM, 6 * MM);
    } else {
      doc.save();
      doc.roundedRect(cx + margin, headerY, 7 * MM, 7 * MM, 3).fill(WHITE);
      doc.restore();
      doc.font(fonts.bold).fontSize(5).fillColor(gc.start);
      doc.text(logoFallbackText, cx + margin, headerY + 2 * MM, {
        width: 7 * MM,
        align: "center",
        lineBreak: false,
      });
    }

    // Org name
    doc.font(fonts.bold).fontSize(9).fillColor(headerText);
    doc.text(orgDisplayName, cx + margin + 9 * MM, headerY + 1.5 * MM, {
      lineBreak: false,
    });

    // Subtitle
    doc.font(fonts.regular).fontSize(4.5).fillColor(subtitleText);
    doc.text(
      uppercaseLatinOnly(TEMPLATE_SUBTITLE[template] || "Identity Card"),
      cx + margin + 9 * MM,
      headerY + 5 * MM,
      { lineBreak: false }
    );

    // Photo (centered, respects photoScale)
    const photoW = 22 * MM * photoScaleF;
    const photoH = 26 * MM * photoScaleF;
    const photoX = cx + (cw - photoW) / 2;
    const photoY = headerY + 10 * MM;

    doc.save();
    doc.roundedRect(photoX - 1 * MM, photoY - 1 * MM, photoW + 2 * MM, photoH + 2 * MM, 5).fill(WHITE);
    doc.restore();

    if (images.photo) {
      safeAddImage(doc, images.photo, photoX, photoY, photoW, photoH);
    } else {
      const midGrad = lerpColor(hexToRgb(gc.start), hexToRgb(gc.end), 0.5);
      doc.save();
      doc.roundedRect(photoX, photoY, photoW, photoH, 4).fill(rgbToHex(midGrad));
      doc.restore();
      doc.font(fonts.regular).fontSize(6).fillColor(WHITE);
      doc.text("No Photo", photoX, photoY + photoH / 2 - 3, {
        width: photoW,
        align: "center",
      });
    }

    // Name
    let yPos = photoY + photoH + 4 * MM;
    doc.font(fonts.bold).fontSize(12 * nameScale).fillColor(mainText);
    doc.text(displayName, cx + margin, yPos, {
      width: cw - margin * 2,
      align: "center",
    });
    yPos = doc.y + 2 * MM;

    // Role
    if (fv.role !== false && template !== "event") {
      doc.font(fonts.bold).fontSize(5 * labelScale).fillColor(labelText);
      doc.text("ROLE: " + displayRole, cx + margin, yPos, {
        width: cw - margin * 2,
        align: "center",
        lineBreak: false,
      });
      yPos += 3.5 * MM;
    }

    doc.font(fonts.bold).fontSize(labelFontSize).fillColor(labelText);
    doc.text("MEMBERSHIP ID", cx + margin, yPos, {
      width: cw - margin * 2,
      align: "center",
      lineBreak: false,
    });
    yPos += 3 * MM;
    doc
      .font(containsMalayalam(membershipIdText) ? fonts.bold : "Courier-Bold")
      .fontSize(10 * valueScale)
      .fillColor(accentText);
    doc.text(membershipIdText, cx + margin, yPos, {
      width: cw - margin * 2,
      align: "center",
      lineBreak: false,
    });
    yPos += 5.5 * MM;

    // Fields
    const fields = [];
    if (fv.dob !== false && dob) fields.push(["DATE OF BIRTH", displayDob]);
    if (fv.gender !== false && gender) {
      fields.push(["GENDER", displayGender]);
    }
    if (fv.blood_group !== false && blood_group) {
      fields.push(["BLOOD GROUP", displayBloodGroup]);
    }
    frontFields.forEach((f) =>
      fields.push([uppercaseLatinOnly(f.label), getCustomFieldDisplayValue(f.label)]),
    );

    for (const [label, value] of fields) {
      doc.font(fonts.regular).fontSize(labelFontSize).fillColor(labelText);
      doc.text(label, cx + margin, yPos, {
        width: cw - margin * 2,
        align: "center",
        lineBreak: false,
      });
      yPos += 2.5 * MM;
      doc.font(fonts.bold).fontSize(7 * valueScale).fillColor(mainText);
      doc.text(value, cx + margin, yPos, {
        width: cw - margin * 2,
        align: "center",
        lineBreak: false,
      });
      yPos += 4.5 * MM;
    }

  } else {
    // ══════════ HORIZONTAL FRONT ══════════
    const margin = 5 * MM;
    const headerY = cy + 4 * MM;

    // Logo
    if (images.logo) {
      doc.save();
      doc.roundedRect(cx + margin, headerY, 7 * MM, 7 * MM, 3.5).fill(WHITE);
      doc.restore();
      safeAddImage(doc, images.logo, cx + margin + 0.5 * MM, headerY + 0.5 * MM, 6 * MM, 6 * MM);
    } else {
      doc.save();
      doc.roundedRect(cx + margin, headerY, 7 * MM, 7 * MM, 3.5).fill(WHITE);
      doc.restore();
      doc.font(fonts.bold).fontSize(5).fillColor(gc.start);
      doc.text(logoFallbackText, cx + margin, headerY + 2 * MM, {
        width: 7 * MM,
        align: "center",
        lineBreak: false,
      });
    }

    // Org name
    doc.font(fonts.bold).fontSize(10).fillColor(mainText);
    doc.text(orgDisplayName, cx + margin + 9 * MM, headerY + 1.5 * MM, {
      lineBreak: false,
    });

    // Subtitle
    doc.font(fonts.regular).fontSize(4.5).fillColor(subtitleText);
    doc.text(
      uppercaseLatinOnly(TEMPLATE_SUBTITLE[template] || "Identity Card"),
      cx + margin + 9 * MM,
      headerY + 5 * MM,
      { lineBreak: false }
    );

    // Event badge
    if (template === "event" && fv.role !== false) {
      const badgeText = uppercaseLatinOnly(role);
      doc.font(fonts.bold).fontSize(5);
      const bw = doc.widthOfString(badgeText) + 5 * MM;
      const bx = cx + cw - margin - bw;
      doc.save();
      doc.roundedRect(bx, headerY + 0.5 * MM, bw, 5 * MM, 7).fill(WHITE);
      doc.restore();
      doc.fillColor(gc.start);
      doc.text(badgeText, bx + 2.5 * MM, headerY + 2 * MM, { lineBreak: false });
    }

    // Body: Photo + Details (respects photoScale)
    const bodyTop = headerY + 10 * MM;
    const photoW = 22 * MM * photoScaleF;
    const photoH = 27 * MM * photoScaleF;
    const photoX = cx + margin;
    const photoY = bodyTop;

    // Photo border
    doc.save();
    doc
      .roundedRect(photoX - 0.8 * MM, photoY - 0.8 * MM, photoW + 1.6 * MM, photoH + 1.6 * MM, 5)
      .fill(WHITE);
    doc.restore();

    if (images.photo) {
      safeAddImage(doc, images.photo, photoX, photoY, photoW, photoH);
    } else {
      const midGrad = lerpColor(hexToRgb(gc.start), hexToRgb(gc.end), 0.5);
      doc.save();
      doc.roundedRect(photoX, photoY, photoW, photoH, 4).fill(rgbToHex(midGrad));
      doc.restore();
      doc.font(fonts.regular).fontSize(6).fillColor(WHITE);
      doc.text("No Photo", photoX, photoY + photoH / 2 - 3, {
        width: photoW,
        align: "center",
      });
    }

    // Details (right of photo)
    const detailX = photoX + photoW + 4 * MM;
    const maxW = cx + cw - detailX - margin;
    let detailY = bodyTop + 1 * MM;

    // Full Name label
    doc.font(fonts.regular).fontSize(labelFontSize).fillColor(labelText);
    doc.text("FULL NAME", detailX, detailY, { lineBreak: false });
    detailY += 2 * MM;

    // Name value
    doc.font(fonts.bold).fontSize(13 * nameScale).fillColor(mainText);
    const nameDisplay =
      displayName.length > 20 ? displayName.substring(0, 20) + "..." : displayName;
    doc.text(nameDisplay, detailX, detailY, { lineBreak: false });
    detailY += 6 * MM;

    // Role
    if (fv.role !== false && template !== "event") {
      doc.font(fonts.regular).fontSize(labelFontSize).fillColor(labelText);
      doc.text("ROLE", detailX, detailY, { lineBreak: false });
      doc.font(fonts.bold).fontSize(7 * valueScale).fillColor(mainText);
      doc.text(displayRole, detailX, detailY + 3 * MM, { lineBreak: false });
      detailY += 6 * MM;
    }

    doc.font(fonts.bold).fontSize(labelFontSize).fillColor(labelText);
    doc.text("MEMBERSHIP ID", detailX, detailY, {
      width: maxW,
      align: "center",
      lineBreak: false,
    });
    doc
      .font(containsMalayalam(membershipIdText) ? fonts.bold : "Courier-Bold")
      .fontSize(11 * valueScale)
      .fillColor(accentText);
    doc.text(membershipIdText, detailX, detailY + 3.5 * MM, {
      width: maxW,
      align: "center",
      lineBreak: false,
    });
    detailY += 8.5 * MM;

    // Two-column fields
    const col2X = detailX + maxW / 2;
    const fieldPairs = [];
    if (fv.dob !== false && dob) fieldPairs.push(["DATE OF BIRTH", displayDob]);
    if (fv.gender !== false && gender) {
      fieldPairs.push(["GENDER", displayGender]);
    }
    if (fv.blood_group !== false && blood_group) {
      fieldPairs.push(["BLOOD GROUP", displayBloodGroup]);
    }
    frontFields.forEach((f) =>
      fieldPairs.push([uppercaseLatinOnly(f.label), getCustomFieldDisplayValue(f.label)]),
    );

    for (let i = 0; i < fieldPairs.length; i += 2) {
      // First field
      doc.font(fonts.regular).fontSize(labelFontSize).fillColor(labelText);
      doc.text(uppercaseLatinOnly(fieldPairs[i][0]), detailX, detailY, {
        lineBreak: false,
      });
      doc.font(fonts.bold).fontSize(7 * valueScale).fillColor(mainText);
      doc.text(fieldPairs[i][1], detailX, detailY + 3 * MM, { lineBreak: false });
      // Second field
      if (fieldPairs[i + 1]) {
        doc.font(fonts.regular).fontSize(labelFontSize).fillColor(labelText);
        doc.text(uppercaseLatinOnly(fieldPairs[i + 1][0]), col2X, detailY, {
          lineBreak: false,
        });
        doc.font(fonts.bold).fontSize(7 * valueScale).fillColor(mainText);
        doc.text(fieldPairs[i + 1][1], col2X, detailY + 3 * MM, { lineBreak: false });
      }
      detailY += 6 * MM;
    }

  }

  // Watermark
  drawWatermark(doc, cx, cy, cw, ch, watermark, gc, fonts);
}

// ══════════════════════════════════════════════════════
//  BACK PAGE
// ══════════════════════════════════════════════════════
function drawBack(doc, params, images, fonts) {
  const {
    data = {},
    template = "custom",
    orgName = "",
    gradientColors: gc = { start: "#2563EB", end: "#ef4444" },
    cardStyles: cs = {},
    orientation = "horizontal",
    fieldVisibility: fv = {},
    customFields = [],
    validityText = "Valid as per subscription plan",
    watermark = {},
  } = params;

  if (params?.template !== "__legacy_pdf") {
    drawProfessionalBack(doc, params, images, fonts);
    return;
  }

  const isVert = orientation === "vertical";
  const card = isVert ? CARD_V : CARD_H;
  const cx = PAD;
  const cy = PAD;
  const cw = card.w;
  const ch = card.h;
  const radius = Math.min((cs.borderRadius || 12) * 0.75, 12);

  // ── Style scaling (same factors as front) ──
  const valueScale = (cs.valueFontSize || 14) / 14;
  const labelScale = (cs.labelFontSize || 9) / 9;

  // ── Back-page color palette (respects user overrides) ──
  const backBg = cs.bgColor || "#ffffff";
  const backBody = "#1a1a1a";
  const backLabel = "#2f2f2f";
  const backValue = "#111111";

  const labels = TEMPLATE_BACK_LABELS[template] || TEMPLATE_BACK_LABELS.custom;
  const backFields = (customFields || []).filter((f) => f.side === "back");
  const { address = "", dob = "", customValues = {} } = data;
  const displayAddress = uppercaseLatinOnly(address || "Address not provided");
  const displayOrgName = uppercaseLatinOnly(orgName || "Community ID Platform");
  const displayValidityText = uppercaseLatinOnly(validityText);
  const displayFooterOrg = uppercaseLatinOnly(orgName || "aarannu");
  const displayDob = uppercaseLatinOnly(dob);
  const getBackFieldValue = (label) => uppercaseLatinOnly(customValues[label] || "—");

  // ── 0. Black page background ──
  doc.save();
  doc.rect(0, 0, cx + cw + PAD, cy + ch + PAD).fill('#000000');
  doc.restore();

  // ── 1. Background (respects bgColor) ──
  doc.save();
  doc.roundedRect(cx, cy, cw, ch, radius).fill(backBg);
  doc.restore();

  // ── 2. Gradient accent bar at top ──
  drawGradientH(doc, cx, cy, cw, 2 * MM, gc.start, gc.end);

  // ── 3. Border ──
  doc.save();
  doc.roundedRect(cx, cy, cw, ch, radius).strokeColor("#dcdceb").lineWidth(0.5).stroke();
  doc.restore();

  const margin = 5 * MM;
  const contentX = cx + margin;
  const contentRight = cx + cw - margin;

  if (isVert) {
    // ══════ VERTICAL BACK ══════
    let yPos = cy + 6 * MM;

    // Address
    if (fv.address !== false) {
      doc.font(fonts.bold).fontSize(6 * valueScale).fillColor(gc.start);
      doc.text(labels.section, contentX, yPos, { lineBreak: false });
      yPos += 3 * MM;
      doc.save();
      doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
      doc.restore();
      yPos += 2 * MM;

      doc.font(fonts.regular).fontSize(6.5 * valueScale).fillColor(backBody);
      doc.text(displayAddress, contentX, yPos, {
        width: cw - margin * 2,
        lineGap: 1,
      });
      yPos = doc.y + 3 * MM;
    }

    // Authority
    doc.font(fonts.bold).fontSize(6 * valueScale).fillColor(gc.start);
    doc.text(labels.authority, contentX, yPos, { lineBreak: false });
    yPos += 3 * MM;
    doc.save();
    doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
    doc.restore();
    yPos += 2 * MM;
    doc.font(fonts.regular).fontSize(6.5 * valueScale).fillColor(backBody);
    doc.text(displayOrgName, contentX, yPos, {
      lineBreak: false,
    });
    yPos += 5 * MM;

    // Custom back fields
    for (const f of backFields) {
      doc.font(fonts.bold).fontSize(4.5 * labelScale).fillColor(backLabel);
      doc.text(uppercaseLatinOnly(f.label), contentX, yPos, {
        lineBreak: false,
      });
      doc.font(fonts.bold).fontSize(6.5 * valueScale).fillColor(backValue);
      doc.text(getBackFieldValue(f.label), contentX, yPos + 3 * MM, { lineBreak: false });
      yPos += 6 * MM;
    }

    // QR Code (centered)
    const qrSize = 16 * MM;
    const qrX = cx + (cw - qrSize) / 2;
    if (images.qr) {
      doc.save();
      doc.roundedRect(qrX - 1.5 * MM, yPos - 1.5 * MM, qrSize + 3 * MM, qrSize + 3 * MM, 4).fill("#fafafc");
      doc.restore();
      doc.save();
      doc
        .roundedRect(qrX - 1.5 * MM, yPos - 1.5 * MM, qrSize + 3 * MM, qrSize + 3 * MM, 4)
        .strokeColor("#e6e6eb")
        .lineWidth(0.5)
        .stroke();
      doc.restore();
      safeAddImage(doc, images.qr, qrX, yPos, qrSize, qrSize);
    }
    doc.font(fonts.regular).fontSize(4 * labelScale).fillColor(backLabel);
    doc.text("SCAN FOR VERIFICATION", cx + margin, yPos + qrSize + 2 * MM, {
      width: cw - margin * 2,
      align: "center",
      lineBreak: false,
    });

    // Footer
    const footerY = cy + ch - 4 * MM;
    doc.save();
    doc.moveTo(contentX, footerY - 2 * MM).lineTo(contentRight, footerY - 2 * MM).strokeColor("#e6e6eb").lineWidth(0.5).stroke();
    doc.restore();
    doc.font(fonts.regular).fontSize(4 * labelScale).fillColor(backLabel);
    doc.text(displayFooterOrg, contentX, footerY, {
      lineBreak: false,
    });
    doc.text(displayValidityText, cx + margin, footerY, {
      width: cw - margin * 2,
      align: "right",
      lineBreak: false,
    });
  } else {
    // ══════ HORIZONTAL BACK ══════
    const qrColW = 22 * MM;
    let yPos = cy + 6 * MM;

    // Address
    if (fv.address !== false) {
      doc.font(fonts.bold).fontSize(6 * valueScale).fillColor(gc.start);
      doc.text(labels.section, contentX, yPos, { lineBreak: false });
      yPos += 3 * MM;
      doc.save();
      doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
      doc.restore();
      yPos += 2 * MM;

      doc.font(fonts.regular).fontSize(6.5 * valueScale).fillColor(backBody);
      doc.text(displayAddress, contentX, yPos, {
        width: cw - margin * 2 - qrColW,
        lineGap: 1,
      });
      yPos = doc.y + 3 * MM;
    }

    // Authority
    doc.font(fonts.bold).fontSize(6 * valueScale).fillColor(gc.start);
    doc.text(labels.authority, contentX, yPos, { lineBreak: false });
    yPos += 3 * MM;
    doc.save();
    doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
    doc.restore();
    yPos += 2 * MM;
    doc.font(fonts.regular).fontSize(6.5 * valueScale).fillColor(backBody);
    doc.text(displayOrgName, contentX, yPos, {
      lineBreak: false,
    });
    yPos += 4 * MM;

    // Custom back fields
    for (const f of backFields) {
      doc.font(fonts.bold).fontSize(4.5 * labelScale).fillColor(backLabel);
      doc.text(uppercaseLatinOnly(f.label), contentX, yPos, {
        lineBreak: false,
      });
      doc.font(fonts.bold).fontSize(6.5 * valueScale).fillColor(backValue);
      doc.text(getBackFieldValue(f.label), contentX, yPos + 3 * MM, { lineBreak: false });
      yPos += 6 * MM;
    }

    // Student: DOB + Validity on back
    if (template === "student") {
      if (fv.dob !== false && dob) {
        doc.font(fonts.bold).fontSize(4.5 * labelScale).fillColor(backLabel);
        doc.text("DOB", contentX, yPos, { lineBreak: false });
        doc.font(fonts.bold).fontSize(6.5 * valueScale).fillColor(backValue);
        doc.text(displayDob, contentX, yPos + 3 * MM, { lineBreak: false });
        yPos += 6 * MM;
      }
      doc.font(fonts.bold).fontSize(4.5 * labelScale).fillColor(backLabel);
      doc.text("VALID UP TO", contentX, yPos, { lineBreak: false });
      doc.font(fonts.bold).fontSize(6.5 * valueScale).fillColor(backValue);
      doc.text(displayValidityText, contentX, yPos + 3 * MM, { lineBreak: false });
    }

    // QR Code (right side)
    const qrSize = 16 * MM;
    const qrX = contentRight - qrSize;
    const qrY = cy + (ch - qrSize) / 2 - 2 * MM;
    if (images.qr) {
      doc.save();
      doc.roundedRect(qrX - 1.5 * MM, qrY - 1.5 * MM, qrSize + 3 * MM, qrSize + 3 * MM, 4).fill("#fafafc");
      doc.restore();
      doc.save();
      doc
        .roundedRect(qrX - 1.5 * MM, qrY - 1.5 * MM, qrSize + 3 * MM, qrSize + 3 * MM, 4)
        .strokeColor("#e6e6eb")
        .lineWidth(0.5)
        .stroke();
      doc.restore();
      safeAddImage(doc, images.qr, qrX, qrY, qrSize, qrSize);
    }
    doc.font(fonts.regular).fontSize(4 * labelScale).fillColor(backLabel);
    doc.text("SCAN FOR VERIFICATION", qrX - 2 * MM, qrY + qrSize + 2 * MM, {
      width: qrSize + 4 * MM,
      align: "center",
      lineBreak: false,
    });

    // Signature area (student)
    if (template === "student") {
      const sigY = cy + ch - 8 * MM;
      if (images.signature) {
        safeAddImage(doc, images.signature, contentRight - 20 * MM, sigY - 4 * MM, 18 * MM, 5 * MM);
        doc.font(fonts.regular).fontSize(4).fillColor("#9696a0");
        doc.text("Registrar", contentRight - 22 * MM, sigY + 2 * MM, {
          width: 20 * MM,
          align: "center",
          lineBreak: false,
        });
      } else {
        doc.save();
        doc
          .moveTo(contentRight - 22 * MM, sigY)
          .lineTo(contentRight - 4 * MM, sigY)
          .strokeColor("#c8c8d2")
          .lineWidth(0.5)
          .stroke();
        doc.restore();
        doc.font(fonts.regular).fontSize(4).fillColor("#9696a0");
        doc.text("Signature of the Student", contentRight - 24 * MM, sigY + 2 * MM, {
          width: 24 * MM,
          align: "center",
          lineBreak: false,
        });
      }
    }

    // Footer
    const footerY = cy + ch - 4 * MM;
    doc.save();
    doc
      .moveTo(contentX, footerY - 2 * MM)
      .lineTo(contentRight, footerY - 2 * MM)
      .strokeColor("#e6e6eb")
      .lineWidth(0.5)
      .stroke();
    doc.restore();
    doc.font(fonts.regular).fontSize(4 * labelScale).fillColor(backLabel);
    doc.text(displayFooterOrg, contentX, footerY, {
      lineBreak: false,
    });
    doc.text(displayValidityText, cx + margin, footerY, {
      width: cw - margin * 2,
      align: "right",
      lineBreak: false,
    });
  }

  // Watermark
  drawWatermark(doc, cx, cy, cw, ch, watermark, gc, fonts);
}

// ── Watermark ────────────────────────────────────────
function drawWatermark(doc, cx, cy, cw, ch, watermark, gc, fonts) {
  if (!watermark) return;
  if (watermark.text) {
    const midC = lerpColor(hexToRgb(gc.start), hexToRgb(gc.end), 0.5);
    const opacity = watermark.textOpacity || 0.08;
    const blended = lerpColor(midC, [255, 255, 255], 1 - opacity);
    doc.save();
    doc.font(fonts.bold).fontSize(16).fillColor(rgbToHex(blended));
    doc.translate(cx + cw / 2, cy + ch / 2);
    doc.rotate(-30, { origin: [0, 0] });
    doc.text(uppercaseLatinOnly(watermark.text), -80, -5, {
      width: 160,
      align: "center",
    });
    doc.restore();
  }
}

// ══════════════════════════════════════════════════════
//  MAIN ENTRY POINT
// ══════════════════════════════════════════════════════
/**
 * Generate a 2-page PDF (front + back) for a card.
 * @param {object} params
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateCardPdf(params) {
  // Download fonts and images in parallel (fonts are cached after first call)
  const [images] = await Promise.all([
    loadImages(params),
    prefetchFonts(params.cardStyles?.fontFamily),
  ]);

  const isVert = (params.orientation || "horizontal") === "vertical";
  const card = isVert ? CARD_V : CARD_H;
  const pageW = card.w + PAD * 2;
  const pageH = card.h + PAD * 2;

  const doc = new PDFDocument({
    size: [pageW, pageH],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    autoFirstPage: true,
    bufferPages: true,
  });

  const stream = doc.pipe(blobStream());

  // Register fonts from cache (instant — buffers already downloaded)
  const fonts = await resolveFont(doc, params.cardStyles?.fontFamily);

  // Page 1: Front
  drawFront(doc, params, images, fonts);

  // Page 2: Back
  doc.addPage({
    size: [pageW, pageH],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  drawBack(doc, params, images, fonts);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => {
      try {
        resolve(stream.toBlob("application/pdf"));
      } catch (err) {
        reject(err);
      }
    });
    stream.on("error", reject);
  });
}

/** Clear the image cache */
export function clearImageCache() {
  imageCache.clear();
}
