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

function lerpHex(hex1, hex2, t) {
  return rgbToHex(lerpColor(hexToRgb(hex1), hexToRgb(hex2), t));
}

// ── Gradient Drawing ─────────────────────────────────
function drawDiagonalGradient(doc, x, y, w, h, startHex, endHex, steps = 60) {
  const c1 = hexToRgb(startHex);
  const c2 = hexToRgb(endHex);
  const stripH = h / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = lerpColor(c1, c2, t);
    doc.save();
    doc.rect(x, y + i * stripH, w, stripH + 0.5).fill(rgbToHex(c));
    doc.restore();
  }
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

// ── Geometric Mesh Grid ──────────────────────────────
function drawMeshGrid(doc, x, y, w, h, colorHex, opacity) {
  const rgb = hexToRgb(colorHex);
  const blended = lerpColor(rgb, [255, 255, 255], 1 - opacity);
  const strokeHex = rgbToHex(blended);

  doc.save();
  doc.strokeColor(strokeHex).lineWidth(0.25);

  const gridSize = 3.5 * MM;
  for (let gx = x; gx <= x + w; gx += gridSize) {
    doc.moveTo(gx, y).lineTo(gx, y + h).stroke();
  }
  for (let gy = y; gy <= y + h; gy += gridSize) {
    doc.moveTo(x, gy).lineTo(x + w, gy).stroke();
  }
  doc.restore();
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

async function loadImages(params) {
  const { data = {}, logoUrl, watermark = {}, signatureUrl } = params;
  const [photo, logo, watermarkImg, signature] = await Promise.all([
    fetchImageAsDataUrl(data.photo_url || null),
    fetchImageAsDataUrl(logoUrl || null),
    fetchImageAsDataUrl(watermark?.imageUrl || null),
    fetchImageAsDataUrl(signatureUrl || null),
  ]);
  const qr = await generateQRDataUrl(data.id_number);
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
function drawFront(doc, params, images) {
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

  const frontFields = (customFields || []).filter((f) => f.side === "front");

  // ── 0. Black page background (shows rounded card edges) ──
  doc.save();
  doc.rect(0, 0, cx + cw + PAD, cy + ch + PAD).fill('#000000');
  doc.restore();

  // ── 1. Background ──
  if (fullGradientBg) {
    // Clip to rounded card shape so gradient doesn't bleed onto black page
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).clip();

    drawDiagonalGradient(doc, cx, cy, cw, ch, gc.start, gc.end);

    // Bottom darkening
    const darkSteps = 20;
    const darkH = ch * 0.4;
    for (let i = 0; i < darkSteps; i++) {
      const t = i / darkSteps;
      const baseC = lerpColor(hexToRgb(gc.start), hexToRgb(gc.end), 0.7 + t * 0.3);
      const darkC = lerpColor(baseC, [0, 0, 0], t * 0.3);
      doc.save();
      doc
        .rect(cx, cy + ch - darkH + i * (darkH / darkSteps), cw, darkH / darkSteps + 0.3)
        .fill(rgbToHex(darkC));
      doc.restore();
    }

    // Mesh grid overlay
    const midC = lerpColor(hexToRgb(gc.start), hexToRgb(gc.end), 0.5);
    drawMeshGrid(doc, cx, cy, cw, ch, rgbToHex(midC), 0.15);

    // Top-right glow (round decorative circle)
    for (let r = 20; r > 0; r -= 3) {
      const t = 1 - r / 20;
      const glowC = lerpColor(hexToRgb(gc.end), [255, 255, 255], t * 0.1);
      doc.save();
      doc.circle(cx + cw - 5 * MM, cy + 5 * MM, r * MM).fill(rgbToHex(glowC));
      doc.restore();
    }

    // Bottom-left glow (round decorative circle)
    for (let r = 14; r > 0; r -= 3) {
      const t = 1 - r / 14;
      const glowC = lerpColor(hexToRgb(gc.start), [255, 255, 255], t * 0.08);
      doc.save();
      doc.circle(cx + 8 * MM, cy + ch - 8 * MM, r * MM).fill(rgbToHex(glowC));
      doc.restore();
    }

    doc.restore(); // end clip

    // Rounded border on gradient card
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).strokeColor('#ffffff33').lineWidth(0.8).stroke();
    doc.restore();
  } else {
    // White card with corner gradient triangles
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, radius).fill("#ffffff");
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

  // ── Color palette based on background ──
  const WHITE = "#ffffff";
  const mainText = fullGradientBg ? WHITE : "#1e1e28";
  const labelText = fullGradientBg ? "#dcdce6" : "#8c8c96";
  const accentText = fullGradientBg ? WHITE : gc.start;
  const subtitleText = fullGradientBg ? "#e6e6f0" : "#9696a0";
  const headerText = fullGradientBg ? WHITE : gc.start;

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
      doc.font("Helvetica-Bold").fontSize(5).fillColor(gc.start);
      doc.text((orgName || "C")[0].toUpperCase(), cx + margin, headerY + 2 * MM, {
        width: 7 * MM,
        align: "center",
        lineBreak: false,
      });
    }

    // Org name
    doc.font("Helvetica-Bold").fontSize(9).fillColor(headerText);
    doc.text((orgName || "Community ID").toUpperCase(), cx + margin + 9 * MM, headerY + 1.5 * MM, {
      lineBreak: false,
    });

    // Subtitle
    doc.font("Helvetica").fontSize(4.5).fillColor(subtitleText);
    doc.text(TEMPLATE_SUBTITLE[template] || "Identity Card", cx + margin + 9 * MM, headerY + 5 * MM, {
      lineBreak: false,
    });

    // Photo (centered)
    const photoW = 22 * MM;
    const photoH = 26 * MM;
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
      doc.font("Helvetica").fontSize(6).fillColor(WHITE);
      doc.text("No Photo", photoX, photoY + photoH / 2 - 3, {
        width: photoW,
        align: "center",
      });
    }

    // Name
    let yPos = photoY + photoH + 4 * MM;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(mainText);
    doc.text(name, cx + margin, yPos, {
      width: cw - margin * 2,
      align: "center",
    });
    yPos = doc.y + 2 * MM;

    // Role
    if (fv.role !== false && template !== "event") {
      doc.font("Helvetica-Bold").fontSize(5).fillColor(labelText);
      doc.text("ROLE: " + role.toUpperCase(), cx + margin, yPos, {
        width: cw - margin * 2,
        align: "center",
        lineBreak: false,
      });
      yPos += 3.5 * MM;
    }

    // Fields
    const fields = [];
    if (fv.dob !== false && dob) fields.push(["DATE OF BIRTH", dob]);
    if (fv.gender !== false && gender) fields.push(["GENDER", gender.toUpperCase()]);
    if (fv.blood_group !== false && blood_group) fields.push(["BLOOD GROUP", blood_group]);
    frontFields.forEach((f) => fields.push([f.label.toUpperCase(), customValues[f.label] || "—"]));

    for (const [label, value] of fields) {
      doc.font("Helvetica").fontSize(4).fillColor(labelText);
      doc.text(label, cx + margin, yPos, {
        width: cw - margin * 2,
        align: "center",
        lineBreak: false,
      });
      yPos += 2.5 * MM;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(mainText);
      doc.text(value, cx + margin, yPos, {
        width: cw - margin * 2,
        align: "center",
        lineBreak: false,
      });
      yPos += 4.5 * MM;
    }

    // Membership ID — centered below fields
    yPos += 2 * MM;
    doc.font("Helvetica").fontSize(4).fillColor(labelText);
    doc.text("MEMBERSHIP ID", cx + margin, yPos, {
      width: cw - margin * 2,
      align: "center",
      lineBreak: false,
    });
    yPos += 2.5 * MM;
    doc.font("Courier-Bold").fontSize(8).fillColor(accentText);
    doc.text(id_number, cx + margin, yPos, {
      width: cw - margin * 2,
      align: "center",
      lineBreak: false,
    });
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
      doc.font("Helvetica-Bold").fontSize(5).fillColor(gc.start);
      doc.text((orgName || "C")[0].toUpperCase(), cx + margin, headerY + 2 * MM, {
        width: 7 * MM,
        align: "center",
        lineBreak: false,
      });
    }

    // Org name
    doc.font("Helvetica-Bold").fontSize(10).fillColor(mainText);
    doc.text((orgName || "Community ID").toUpperCase(), cx + margin + 9 * MM, headerY + 1.5 * MM, {
      lineBreak: false,
    });

    // Subtitle
    doc.font("Helvetica").fontSize(4.5).fillColor(subtitleText);
    doc.text(
      (TEMPLATE_SUBTITLE[template] || "Identity Card").toUpperCase(),
      cx + margin + 9 * MM,
      headerY + 5 * MM,
      { lineBreak: false }
    );

    // Event badge
    if (template === "event" && fv.role !== false) {
      const badgeText = role.toUpperCase();
      doc.font("Helvetica-Bold").fontSize(5);
      const bw = doc.widthOfString(badgeText) + 5 * MM;
      const bx = cx + cw - margin - bw;
      doc.save();
      doc.roundedRect(bx, headerY + 0.5 * MM, bw, 5 * MM, 7).fill(WHITE);
      doc.restore();
      doc.fillColor(gc.start);
      doc.text(badgeText, bx + 2.5 * MM, headerY + 2 * MM, { lineBreak: false });
    }

    // Body: Photo + Details
    const bodyTop = headerY + 10 * MM;
    const photoW = 22 * MM;
    const photoH = 27 * MM;
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
      doc.font("Helvetica").fontSize(6).fillColor(WHITE);
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
    doc.font("Helvetica").fontSize(4).fillColor(labelText);
    doc.text("FULL NAME", detailX, detailY, { lineBreak: false });
    detailY += 2 * MM;

    // Name value
    doc.font("Helvetica-Bold").fontSize(13).fillColor(mainText);
    const nameDisplay = name.length > 20 ? name.substring(0, 20) + "…" : name;
    doc.text(nameDisplay, detailX, detailY, { lineBreak: false });
    detailY += 6 * MM;

    // Role
    if (fv.role !== false && template !== "event") {
      doc.font("Helvetica").fontSize(4).fillColor(labelText);
      doc.text("ROLE", detailX, detailY, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(7).fillColor(mainText);
      doc.text(role, detailX, detailY + 3 * MM, { lineBreak: false });
      detailY += 6 * MM;
    }

    // Two-column fields
    const col2X = detailX + maxW / 2;
    const fieldPairs = [];
    if (fv.dob !== false && dob) fieldPairs.push(["DATE OF BIRTH", dob]);
    if (fv.gender !== false && gender) fieldPairs.push(["GENDER", gender.toUpperCase()]);
    if (fv.blood_group !== false && blood_group) fieldPairs.push(["BLOOD GROUP", blood_group]);
    frontFields.forEach((f) => fieldPairs.push([f.label.toUpperCase(), customValues[f.label] || "—"]));

    for (let i = 0; i < fieldPairs.length; i += 2) {
      // First field
      doc.font("Helvetica").fontSize(4).fillColor(labelText);
      doc.text(fieldPairs[i][0], detailX, detailY, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(7).fillColor(mainText);
      doc.text(fieldPairs[i][1], detailX, detailY + 3 * MM, { lineBreak: false });
      // Second field
      if (fieldPairs[i + 1]) {
        doc.font("Helvetica").fontSize(4).fillColor(labelText);
        doc.text(fieldPairs[i + 1][0], col2X, detailY, { lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(7).fillColor(mainText);
        doc.text(fieldPairs[i + 1][1], col2X, detailY + 3 * MM, { lineBreak: false });
      }
      detailY += 6 * MM;
    }

    // Membership ID
    const idY = Math.max(detailY + 1 * MM, bodyTop + photoH - 5 * MM);
    doc.font("Helvetica").fontSize(4).fillColor(labelText);
    doc.text("MEMBERSHIP ID", detailX, idY, { lineBreak: false });
    doc.font("Courier-Bold").fontSize(9).fillColor(accentText);
    doc.text(id_number, detailX, idY + 4 * MM, { lineBreak: false });
  }

  // Watermark
  drawWatermark(doc, cx, cy, cw, ch, watermark, gc);
}

// ══════════════════════════════════════════════════════
//  BACK PAGE
// ══════════════════════════════════════════════════════
function drawBack(doc, params, images) {
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

  const isVert = orientation === "vertical";
  const card = isVert ? CARD_V : CARD_H;
  const cx = PAD;
  const cy = PAD;
  const cw = card.w;
  const ch = card.h;
  const radius = Math.min((cs.borderRadius || 12) * 0.75, 12);

  const labels = TEMPLATE_BACK_LABELS[template] || TEMPLATE_BACK_LABELS.custom;
  const backFields = (customFields || []).filter((f) => f.side === "back");
  const { address = "", id_number = "0000", dob = "", customValues = {} } = data;

  // ── 0. Black page background ──
  doc.save();
  doc.rect(0, 0, cx + cw + PAD, cy + ch + PAD).fill('#000000');
  doc.restore();

  // ── 1. White background ──
  doc.save();
  doc.roundedRect(cx, cy, cw, ch, radius).fill("#ffffff");
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
      doc.font("Helvetica-Bold").fontSize(6).fillColor(gc.start);
      doc.text(labels.section, contentX, yPos, { lineBreak: false });
      yPos += 3 * MM;
      doc.save();
      doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
      doc.restore();
      yPos += 2 * MM;

      doc.font("Helvetica").fontSize(6.5).fillColor("#50505a");
      doc.text(address || "Address not provided", contentX, yPos, {
        width: cw - margin * 2,
        lineGap: 1,
      });
      yPos = doc.y + 3 * MM;
    }

    // Authority
    doc.font("Helvetica-Bold").fontSize(6).fillColor(gc.start);
    doc.text(labels.authority, contentX, yPos, { lineBreak: false });
    yPos += 3 * MM;
    doc.save();
    doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
    doc.restore();
    yPos += 2 * MM;
    doc.font("Helvetica").fontSize(6.5).fillColor("#50505a");
    doc.text(orgName || "Community ID Platform", contentX, yPos, { lineBreak: false });
    yPos += 5 * MM;

    // Custom back fields
    for (const f of backFields) {
      doc.font("Helvetica-Bold").fontSize(4.5).fillColor("#8c8c96");
      doc.text(f.label.toUpperCase(), contentX, yPos, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#32323c");
      doc.text(customValues[f.label] || "—", contentX, yPos + 3 * MM, { lineBreak: false });
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
    doc.font("Helvetica").fontSize(4).fillColor("#9696a0");
    doc.text("Scan for verification", cx + margin, yPos + qrSize + 2 * MM, {
      width: cw - margin * 2,
      align: "center",
      lineBreak: false,
    });

    // Footer
    const footerY = cy + ch - 4 * MM;
    doc.save();
    doc.moveTo(contentX, footerY - 2 * MM).lineTo(contentRight, footerY - 2 * MM).strokeColor("#e6e6eb").lineWidth(0.5).stroke();
    doc.restore();
    doc.font("Helvetica").fontSize(4).fillColor("#aaaab4");
    doc.text(orgName || "aarannu", contentX, footerY, { lineBreak: false });
    doc.text(validityText, cx + margin, footerY, {
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
      doc.font("Helvetica-Bold").fontSize(6).fillColor(gc.start);
      doc.text(labels.section, contentX, yPos, { lineBreak: false });
      yPos += 3 * MM;
      doc.save();
      doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
      doc.restore();
      yPos += 2 * MM;

      doc.font("Helvetica").fontSize(6.5).fillColor("#50505a");
      doc.text(address || "Address not provided", contentX, yPos, {
        width: cw - margin * 2 - qrColW,
        lineGap: 1,
      });
      yPos = doc.y + 3 * MM;
    }

    // Authority
    doc.font("Helvetica-Bold").fontSize(6).fillColor(gc.start);
    doc.text(labels.authority, contentX, yPos, { lineBreak: false });
    yPos += 3 * MM;
    doc.save();
    doc.moveTo(contentX, yPos).lineTo(contentX + 12 * MM, yPos).strokeColor(gc.start).lineWidth(0.8).stroke();
    doc.restore();
    yPos += 2 * MM;
    doc.font("Helvetica").fontSize(6.5).fillColor("#50505a");
    doc.text(orgName || "Community ID Platform", contentX, yPos, { lineBreak: false });
    yPos += 4 * MM;

    // Custom back fields
    for (const f of backFields) {
      doc.font("Helvetica-Bold").fontSize(4.5).fillColor("#8c8c96");
      doc.text(f.label.toUpperCase(), contentX, yPos, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#32323c");
      doc.text(customValues[f.label] || "—", contentX, yPos + 3 * MM, { lineBreak: false });
      yPos += 6 * MM;
    }

    // Student: DOB + Validity on back
    if (template === "student") {
      if (fv.dob !== false && dob) {
        doc.font("Helvetica-Bold").fontSize(4.5).fillColor("#8c8c96");
        doc.text("DOB", contentX, yPos, { lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#32323c");
        doc.text(dob, contentX, yPos + 3 * MM, { lineBreak: false });
        yPos += 6 * MM;
      }
      doc.font("Helvetica-Bold").fontSize(4.5).fillColor("#8c8c96");
      doc.text("VALID UP TO", contentX, yPos, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#32323c");
      doc.text(validityText, contentX, yPos + 3 * MM, { lineBreak: false });
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
    doc.font("Helvetica").fontSize(4).fillColor("#9696a0");
    doc.text("Scan for verification", qrX - 2 * MM, qrY + qrSize + 2 * MM, {
      width: qrSize + 4 * MM,
      align: "center",
      lineBreak: false,
    });

    // Signature area (student)
    if (template === "student") {
      const sigY = cy + ch - 8 * MM;
      if (images.signature) {
        safeAddImage(doc, images.signature, contentRight - 20 * MM, sigY - 4 * MM, 18 * MM, 5 * MM);
        doc.font("Helvetica").fontSize(4).fillColor("#9696a0");
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
        doc.font("Helvetica").fontSize(4).fillColor("#9696a0");
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
    doc.font("Helvetica").fontSize(4).fillColor("#aaaab4");
    doc.text(orgName || "aarannu", contentX, footerY, { lineBreak: false });
    doc.text(validityText, cx + margin, footerY, {
      width: cw - margin * 2,
      align: "right",
      lineBreak: false,
    });
  }

  // Watermark
  drawWatermark(doc, cx, cy, cw, ch, watermark, gc);
}

// ── Watermark ────────────────────────────────────────
function drawWatermark(doc, cx, cy, cw, ch, watermark, gc) {
  if (!watermark) return;
  if (watermark.text) {
    const midC = lerpColor(hexToRgb(gc.start), hexToRgb(gc.end), 0.5);
    const opacity = watermark.textOpacity || 0.08;
    const blended = lerpColor(midC, [255, 255, 255], 1 - opacity);
    doc.save();
    doc.font("Helvetica-Bold").fontSize(16).fillColor(rgbToHex(blended));
    doc.translate(cx + cw / 2, cy + ch / 2);
    doc.rotate(-30, { origin: [0, 0] });
    doc.text(watermark.text.toUpperCase(), -80, -5, { width: 160, align: "center" });
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
  const images = await loadImages(params);
  const isVert = (params.orientation || "horizontal") === "vertical";
  const card = isVert ? CARD_V : CARD_H;
  const pageW = card.w + PAD * 2;
  const pageH = card.h + PAD * 2;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [pageW, pageH],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
      bufferPages: true,
    });

    const stream = doc.pipe(blobStream());

    // Page 1: Front
    drawFront(doc, params, images);

    // Page 2: Back
    doc.addPage({
      size: [pageW, pageH],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    drawBack(doc, params, images);

    doc.end();

    stream.on("finish", () => {
      try {
        const blob = stream.toBlob("application/pdf");
        resolve(blob);
      } catch (err) {
        reject(err);
      }
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

/** Clear the image cache */
export function clearImageCache() {
  imageCache.clear();
}
