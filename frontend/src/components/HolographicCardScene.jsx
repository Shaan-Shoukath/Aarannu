import { useEffect, useRef } from "react";
import * as THREE from "three";
import QRCode from "qrcode";

const RICKROLL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const CW = 720, CH = 1100;

// ── canvas helpers ─────────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function barcode(ctx, x, y, w, h, color = "#fff") {
  let s = 17;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  ctx.fillStyle = color;
  const bars = 54, bw = w / bars;
  for (let i = 0; i < bars; i++) ctx.fillRect(x + i * bw, y, bw * (rng() > 0.4 ? 0.55 : 0.28), h);
}

// ── FRONT CANVAS ──────────────────────────────────────────────────────────────
function makeFront(theme = "dark") {
  const light = theme === "light";
  const c = document.createElement("canvas"); c.width = CW; c.height = CH;
  const x = c.getContext("2d");

  // bg
  const bg = x.createLinearGradient(0, 0, CW, CH);
  if (light) {
    bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.52, "#f7fdff"); bg.addColorStop(1, "#eef7fb");
  } else {
    bg.addColorStop(0, "#0b1120"); bg.addColorStop(0.5, "#0f1f3d"); bg.addColorStop(1, "#06101a");
  }
  x.fillStyle = bg; x.fillRect(0, 0, CW, CH);
  const g1 = x.createRadialGradient(0, 0, 0, 160, 200, 560);
  g1.addColorStop(0, light ? "rgba(37,99,235,.18)" : "rgba(37,99,235,.72)");
  g1.addColorStop(1, "rgba(37,99,235,0)");
  x.fillStyle = g1; x.fillRect(0, 0, CW, CH);
  const g2 = x.createRadialGradient(CW, CH, 0, CW - 130, CH - 160, 460);
  g2.addColorStop(0, light ? "rgba(244,63,94,.16)" : "rgba(220,38,38,.6)");
  g2.addColorStop(1, "rgba(220,38,38,0)");
  x.fillStyle = g2; x.fillRect(0, 0, CW, CH);

  // dot grid
  x.fillStyle = light ? "rgba(37,99,235,.1)" : "rgba(255,255,255,.06)";
  for (let px = 20; px < CW; px += 28) for (let py = 20; py < CH; py += 28) x.fillRect(px, py, 2, 2);

  // border
  x.strokeStyle = light ? "rgba(37,99,235,.26)" : "rgba(255,255,255,.25)"; x.lineWidth = 3;
  rr(x, 26, 26, CW - 52, CH - 52, 24); x.stroke();

  // header strip
  x.save(); rr(x, 26, 26, CW - 52, 148, 24); x.clip();
  const hdr = x.createLinearGradient(0, 0, CW, 0);
  hdr.addColorStop(0, light ? "rgba(37,99,235,.95)" : "rgba(37,99,235,.65)");
  hdr.addColorStop(1, light ? "rgba(239,68,68,.86)" : "rgba(220,38,38,.4)");
  x.fillStyle = hdr; x.fillRect(26, 26, CW - 52, 148); x.restore();

  x.fillStyle = "#fff"; x.font = "900 52px Arial, sans-serif"; x.textAlign = "left";
  x.fillText("AARANNU", 58, 108);
  x.fillStyle = light ? "rgba(255,255,255,.82)" : "rgba(200,220,255,.75)"; x.font = "600 22px Arial, sans-serif";
  x.fillText("DIGITAL IDENTITY CARD", 60, 150);

  // photo
  const px = CW / 2, py = 368, pr = 118;
  const ring = x.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
  ring.addColorStop(0, "#3b82f6"); ring.addColorStop(1, "#ef4444");
  x.strokeStyle = ring; x.lineWidth = 6;
  x.beginPath(); x.arc(px, py, pr + 8, 0, Math.PI * 2); x.stroke();
  x.fillStyle = light ? "#e0f2fe" : "#1e3a5f"; x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.fill();
  // person silhouette
  x.fillStyle = light ? "rgba(37,99,235,.34)" : "rgba(147,197,253,.55)";
  x.beginPath(); x.arc(px, py - 30, 46, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(px, py + 88, 74, 52, 0, Math.PI, 0); x.fill();

  // name
  x.fillStyle = light ? "#18181b" : "#fff"; x.font = "900 52px Arial, sans-serif"; x.textAlign = "center";
  x.fillText("SHAAN SHOUKATH", CW / 2, 562);

  // role badge
  const badge = x.createLinearGradient(162, 0, 558, 0);
  badge.addColorStop(0, light ? "rgba(37,99,235,.12)" : "rgba(37,99,235,.4)");
  badge.addColorStop(1, light ? "rgba(239,68,68,.1)" : "rgba(220,38,38,.3)");
  x.fillStyle = badge; rr(x, 162, 578, 396, 58, 14); x.fill();
  x.strokeStyle = light ? "rgba(37,99,235,.28)" : "rgba(147,197,253,.42)"; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = light ? "#1d4ed8" : "#93c5fd"; x.font = "700 26px Arial, sans-serif";
  x.fillText("INVENTORY MANAGER", CW / 2, 618);

  // divider
  x.strokeStyle = light ? "rgba(24,24,27,.12)" : "rgba(255,255,255,.14)"; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(60, 672); x.lineTo(CW - 60, 672); x.stroke();

  // info rows
  x.textAlign = "left";
  [["ID NO.", "ANN-2026-0047"], ["DEPT.", "OPERATIONS"], ["VALID", "2026 – 2027"]].forEach(([l, v], i) => {
    const ry = 718 + i * 76;
    x.fillStyle = light ? "rgba(82,82,91,.78)" : "rgba(148,163,184,.72)"; x.font = "600 20px Arial, sans-serif"; x.fillText(l, 70, ry);
    x.fillStyle = light ? "#18181b" : "#fff"; x.font = "700 30px Arial, sans-serif"; x.fillText(v, 70, ry + 36);
  });

  // EMV chip
  const chipX = CW / 2 - 46, chipY = 716;
  const cg = x.createLinearGradient(chipX, chipY, chipX + 90, chipY + 66);
  cg.addColorStop(0, "#d4a843"); cg.addColorStop(0.5, "#f0cc6a"); cg.addColorStop(1, "#b8892a");
  x.fillStyle = cg; rr(x, chipX, chipY, 92, 66, 8); x.fill();
  x.strokeStyle = "rgba(0,0,0,.22)"; x.lineWidth = 1;
  for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(chipX + 12, chipY + 14 + i * 13); x.lineTo(chipX + 80, chipY + 14 + i * 13); x.stroke(); }
  x.beginPath(); x.moveTo(chipX + 46, chipY + 10); x.lineTo(chipX + 46, chipY + 56); x.stroke();

  // barcode
  x.fillStyle = light ? "rgba(24,24,27,.045)" : "rgba(255,255,255,.05)"; x.fillRect(60, 982, CW - 120, 68);
  barcode(x, 70, 992, CW - 140, 46, light ? "#18181b" : "#fff");
  x.fillStyle = light ? "rgba(82,82,91,.72)" : "rgba(148,163,184,.55)"; x.font = "500 18px 'Courier New',monospace";
  x.textAlign = "center"; x.fillText("4 8 1 0  0 0 4 7  2 0 2 6  9 9 3 1", CW / 2, 1072);
  return c;
}

// ── BACK CANVAS ───────────────────────────────────────────────────────────────
async function makeBack(theme = "dark") {
  const light = theme === "light";
  const c = document.createElement("canvas"); c.width = CW; c.height = CH;
  const x = c.getContext("2d");

  const bg = x.createLinearGradient(CW, CH, 0, 0);
  if (light) {
    bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.5, "#f8fdff"); bg.addColorStop(1, "#eef8fb");
  } else {
    bg.addColorStop(0, "#0b1120"); bg.addColorStop(0.5, "#0f1f3d"); bg.addColorStop(1, "#06101a");
  }
  x.fillStyle = bg; x.fillRect(0, 0, CW, CH);
  const g1 = x.createRadialGradient(CW, 0, 0, CW - 130, 130, 420);
  g1.addColorStop(0, light ? "rgba(239,68,68,.16)" : "rgba(220,38,38,.6)"); g1.addColorStop(1, "rgba(220,38,38,0)");
  x.fillStyle = g1; x.fillRect(0, 0, CW, CH);
  const g2 = x.createRadialGradient(0, CH, 0, 130, CH - 130, 380);
  g2.addColorStop(0, light ? "rgba(37,99,235,.18)" : "rgba(37,99,235,.52)"); g2.addColorStop(1, "rgba(37,99,235,0)");
  x.fillStyle = g2; x.fillRect(0, 0, CW, CH);

  x.fillStyle = light ? "rgba(37,99,235,.1)" : "rgba(255,255,255,.06)";
  for (let px = 20; px < CW; px += 28) for (let py = 20; py < CH; py += 28) x.fillRect(px, py, 2, 2);
  x.strokeStyle = light ? "rgba(37,99,235,.26)" : "rgba(255,255,255,.22)"; x.lineWidth = 3;
  rr(x, 26, 26, CW - 52, CH - 52, 24); x.stroke();

  // magnetic stripe
  x.fillStyle = light ? "#2563eb" : "#111827"; x.fillRect(0, 66, CW, 74);
  x.fillStyle = light ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.03)"; x.fillRect(0, 66, CW, 74);

  x.fillStyle = light ? "rgba(24,24,27,.72)" : "rgba(148,163,184,.72)"; x.font = "700 22px Arial, sans-serif";
  x.textAlign = "center"; x.fillText("SCAN TO VERIFY IDENTITY", CW / 2, 218);

  // QR code
  const qrSize = 300, qrC = document.createElement("canvas");
  await QRCode.toCanvas(qrC, RICKROLL, {
    width: qrSize,
    margin: 2,
    color: light
      ? { dark: "#18181b", light: "#ffffff" }
      : { dark: "#ffffff", light: "#071428" },
    errorCorrectionLevel: "H"
  });
  const qrX = (CW - qrSize) / 2, qrY = 258;
  const glow = x.createRadialGradient(CW / 2, qrY + qrSize / 2, 10, CW / 2, qrY + qrSize / 2, 230);
  glow.addColorStop(0, light ? "rgba(37,99,235,.16)" : "rgba(37,99,235,.32)"); glow.addColorStop(1, "rgba(37,99,235,0)");
  x.fillStyle = glow; x.fillRect(0, qrY - 40, CW, qrSize + 80);
  x.strokeStyle = light ? "rgba(37,99,235,.3)" : "rgba(147,197,253,.45)"; x.lineWidth = 2;
  rr(x, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 16); x.stroke();
  x.drawImage(qrC, qrX, qrY, qrSize, qrSize);

  x.fillStyle = light ? "rgba(29,78,216,.82)" : "rgba(147,197,253,.75)"; x.font = "600 20px Arial, sans-serif";
  x.fillText("⬆  Scan with your phone  ⬆", CW / 2, 614);

  x.strokeStyle = light ? "rgba(24,24,27,.12)" : "rgba(255,255,255,.12)"; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(60, 648); x.lineTo(CW - 60, 648); x.stroke();

  // address block
  x.fillStyle = light ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.07)"; rr(x, 56, 670, CW - 112, 228, 16); x.fill();
  x.strokeStyle = light ? "rgba(37,99,235,.18)" : "rgba(255,255,255,.1)"; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = light ? "#18181b" : "#fff"; x.font = "800 28px Arial, sans-serif"; x.textAlign = "left";
  x.fillText("AARANNU SYSTEMS PVT. LTD.", 86, 720);
  x.fillStyle = light ? "rgba(82,82,91,.86)" : "rgba(148,163,184,.85)"; x.font = "500 22px Arial, sans-serif";
  ["Plot 14, Tech Park, Sector 5", "Kochi, Kerala – 682 030, India", "+91 484 000 0047  ·  id@aarannu.io"].forEach((l, i) => x.fillText(l, 86, 764 + i * 42));

  // barcode
  x.fillStyle = light ? "rgba(24,24,27,.045)" : "rgba(255,255,255,.05)"; x.fillRect(60, 932, CW - 120, 62);
  barcode(x, 70, 942, CW - 140, 42, light ? "#18181b" : "#fff");
  x.fillStyle = light ? "rgba(82,82,91,.72)" : "rgba(100,116,139,.75)"; x.font = "500 18px 'Courier New',monospace";
  x.textAlign = "center"; x.fillText("ISSUED BY AARANNU  ·  NOT TRANSFERABLE", CW / 2, 1026);
  x.fillStyle = light ? "rgba(82,82,91,.68)" : "rgba(71,85,105,.6)"; x.font = "500 16px Arial, sans-serif";
  x.fillText("If found, please return to the address above", CW / 2, 1064);
  return c;
}

function mkTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function makeAlphaMap(w, h, r) {
  // Canvas alpha mask: white inside rounded rect, black outside
  const size = 512;
  const c = document.createElement("canvas"); c.width = size; c.height = Math.round(size * h / w);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);
  const rx = Math.round(r / w * c.width);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(rx, 0); ctx.lineTo(c.width - rx, 0);
  ctx.quadraticCurveTo(c.width, 0, c.width, rx);
  ctx.lineTo(c.width, c.height - rx);
  ctx.quadraticCurveTo(c.width, c.height, c.width - rx, c.height);
  ctx.lineTo(rx, c.height);
  ctx.quadraticCurveTo(0, c.height, 0, c.height - rx);
  ctx.lineTo(0, rx);
  ctx.quadraticCurveTo(0, 0, rx, 0);
  ctx.closePath(); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

function makeCardGroup(frontTex, backTex, theme = "dark") {
  const light = theme === "light";
  const group = new THREE.Group();
  const W = 2.7, H = 4.15, D = 0.09, R = 0.22;
  const alpha = makeAlphaMap(W, H, R);
  const matProps = {
    metalness: light ? 0.05 : 0.15,
    roughness: light ? 0.34 : 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: light ? 0.18 : 0.12
  };

  // Front face
  const frontGeo = new THREE.PlaneGeometry(W, H);
  const frontMat = new THREE.MeshPhysicalMaterial({ map: frontTex, alphaMap: alpha, alphaTest: 0.5, ...matProps });
  const frontMesh = new THREE.Mesh(frontGeo, frontMat);
  frontMesh.position.z = D / 2;
  group.add(frontMesh);

  // Back face
  const backGeo = new THREE.PlaneGeometry(W, H);
  const backMat = new THREE.MeshPhysicalMaterial({ map: backTex, alphaMap: alpha, alphaTest: 0.5, ...matProps });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.rotation.y = Math.PI;
  backMesh.position.z = -D / 2;
  group.add(backMesh);

  return { group, frontMat, backMat };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function HolographicCardScene({ theme = "dark" }) {
  const hostRef = useRef(null);
  const isLightTheme = theme === "light";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.1, 7.4);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "h-full w-full";
    renderer.domElement.setAttribute("aria-label", "3D ID card – click to flip");
    host.appendChild(renderer.domElement);

    // Front texture (sync)
    const frontTex = mkTex(makeFront(theme));

    // Back texture (async placeholder → real)
    const bpC = document.createElement("canvas"); bpC.width = CW; bpC.height = CH;
    const bpCtx = bpC.getContext("2d"); bpCtx.fillStyle = isLightTheme ? "#ffffff" : "#0b1120"; bpCtx.fillRect(0, 0, CW, CH);
    const backTex = mkTex(bpC);
    let disposed = false;
    makeBack(theme).then(bc => { if (disposed) return; bpCtx.clearRect(0, 0, CW, CH); bpCtx.drawImage(bc, 0, 0); backTex.needsUpdate = true; });

    const { group: card, frontMat, backMat } = makeCardGroup(frontTex, backTex, theme);
    card.rotation.set(-0.06, -0.28, 0.03);
    scene.add(card);

    // Drop shadow (also rounded)
    const shadowGeo = new THREE.ShapeGeometry(roundedRectShape(2.8, 4.3, 0.24), 8);
    const shadowMat = new THREE.MeshBasicMaterial({ color: isLightTheme ? "#64748b" : "#0a0f1e", transparent: true, opacity: isLightTheme ? 0.18 : 0.6 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(0.22, -0.2, -0.28); shadowMesh.rotation.copy(card.rotation);
    scene.add(shadowMesh);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) { pos[i * 3] = (Math.random() - .5) * 9; pos[i * 3 + 1] = (Math.random() - .5) * 7; pos[i * 3 + 2] = -4 - Math.random() * 5; }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: isLightTheme ? "#2563eb" : "#cbd5e1", size: isLightTheme ? 0.015 : 0.018, transparent: true, opacity: isLightTheme ? 0.2 : 0.45 }));
    scene.add(stars);

    // Lights
    const key = new THREE.DirectionalLight("#ffffff", isLightTheme ? 2.05 : 2.6); key.position.set(2.5, 4, 5); scene.add(key);
    const blue = new THREE.PointLight(isLightTheme ? "#2563eb" : "#3b82f6", isLightTheme ? 2.2 : 5.5, 11); blue.position.set(-3, 2, 3.5); scene.add(blue);
    const red = new THREE.PointLight(isLightTheme ? "#ef4444" : "#ef4444", isLightTheme ? 1.55 : 4.5, 10); red.position.set(3.5, -2.5, 3); scene.add(red);
    scene.add(new THREE.AmbientLight("#ffffff", isLightTheme ? 0.88 : 0.5));

    // State
    let ptrX = 0, ptrY = 0;
    let flipped = false, targetY = -0.28, currentY = -0.28;

    const onPtr = (e) => { const r = host.getBoundingClientRect(); ptrX = ((e.clientX - r.left) / r.width - 0.5) * 2; ptrY = ((e.clientY - r.top) / r.height - 0.5) * 2; };
    const onClick = () => { flipped = !flipped; targetY = flipped ? Math.PI + 0.28 : -0.28; };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
      const sc = width < 360 ? 0.62 : width < 420 ? 0.72 : width < 600 ? 0.82 : width < 900 ? 0.92 : 1.05;
      card.scale.setScalar(sc); shadowMesh.scale.setScalar(sc);
    };

    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clock = new THREE.Clock(); let raf = 0;
    const animate = () => {
      const t = clock.getElapsedTime();
      const drift = rm.matches ? 0 : Math.sin(t * 0.7) * 0.05;
      currentY += (targetY - currentY) * 0.055;
      card.rotation.y = currentY + ptrX * 0.07 + drift;
      card.rotation.x = -0.06 - ptrY * 0.035;
      card.position.y = rm.matches ? 0 : Math.sin(t * 0.85) * 0.09;
      shadowMesh.rotation.copy(card.rotation);
      shadowMesh.position.y = card.position.y - 0.2;
      stars.rotation.z = t * 0.009;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    resize(); animate();
    window.addEventListener("resize", resize);
    host.addEventListener("pointermove", onPtr);
    host.addEventListener("click", onClick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onPtr);
      host.removeEventListener("click", onClick);
      [frontTex, backTex].forEach(t => t.dispose());
      [frontMat, backMat, shadowMat].forEach(m => m.dispose());
      [starGeo, shadowGeo].forEach(g => g.dispose());
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [isLightTheme, theme]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0, cursor: "pointer" }} />
      <p style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", color: isLightTheme ? "rgba(29,78,216,.82)" : "rgba(147,197,253,.65)", fontSize: 12, fontWeight: 600, letterSpacing: "2.5px", pointerEvents: "none", whiteSpace: "nowrap", userSelect: "none" }}>
        ↩ CLICK TO FLIP
      </p>
    </div>
  );
}
