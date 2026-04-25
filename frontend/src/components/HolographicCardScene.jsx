import { useEffect, useRef } from "react";
import * as THREE from "three";

function drawShield(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 120, size / 120);
  ctx.beginPath();
  ctx.moveTo(60, 6);
  ctx.lineTo(14, 26);
  ctx.lineTo(14, 56);
  ctx.bezierCurveTo(14, 86, 34, 110, 60, 118);
  ctx.bezierCurveTo(86, 110, 106, 86, 106, 56);
  ctx.lineTo(106, 26);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(39, 63);
  ctx.lineTo(54, 78);
  ctx.lineTo(84, 43);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function makeVerticalCardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1100;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.48, "#111827");
  bg.addColorStop(1, "#030712");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blueGlow = ctx.createRadialGradient(10, 20, 20, 40, 60, 470);
  blueGlow.addColorStop(0, "rgba(37,99,235,0.82)");
  blueGlow.addColorStop(1, "rgba(37,99,235,0)");
  ctx.fillStyle = blueGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const redGlow = ctx.createRadialGradient(720, 1080, 20, 680, 1040, 440);
  redGlow.addColorStop(0, "rgba(239,68,68,0.66)");
  redGlow.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = redGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.09)";
  for (let x = 24; x < canvas.width; x += 30) {
    for (let y = 24; y < canvas.height; y += 30) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(0, 0, canvas.width, 150);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 44px 'Public Sans', Arial, sans-serif";
  ctx.letterSpacing = "8px";
  ctx.fillText("AARANNU", 58, 88);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = "700 22px 'Public Sans', Arial, sans-serif";
  ctx.fillText("DIGITAL ID TRIAL", 60, 124);

  drawShield(ctx, 248, 220, 224);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 54px 'Public Sans', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Try Aarannu", canvas.width / 2, 548);
  ctx.fillText("Instantly", canvas.width / 2, 612);

  ctx.fillStyle = "rgba(226,232,240,0.88)";
  ctx.font = "600 26px 'Public Sans', Arial, sans-serif";
  ctx.fillText("50 free starter tokens", canvas.width / 2, 682);
  ctx.fillText("for your first card batch", canvas.width / 2, 720);

  const chipGradient = ctx.createLinearGradient(90, 0, 610, 0);
  chipGradient.addColorStop(0, "rgba(255,255,255,0.20)");
  chipGradient.addColorStop(1, "rgba(255,255,255,0.07)");
  ctx.fillStyle = chipGradient;
  ctx.fillRect(76, 802, 568, 86);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.strokeRect(76, 802, 568, 86);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 24px 'Public Sans', Arial, sans-serif";
  ctx.fillText("SECURE / VERIFIED / PRODUCTION-GRADE", 104, 855);

  ctx.fillStyle = "#60a5fa";
  ctx.font = "800 26px 'Courier New', monospace";
  ctx.fillText("ACCESS-READY-2026", 76, 996);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createRoundedCardGeometry(width, height, radius, depth) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 10,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  }).center();
}

export default function HolographicCardScene() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#000000");

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.1, 8.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Animated vertical ID card");
    renderer.domElement.className = "h-full w-full";
    host.appendChild(renderer.domElement);

    const geometry = createRoundedCardGeometry(2.7, 4.15, 0.18, 0.1);
    const cardMaterial = new THREE.MeshPhysicalMaterial({
      map: makeVerticalCardTexture(),
      color: "#ffffff",
      metalness: 0.18,
      roughness: 0.24,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      side: THREE.DoubleSide,
    });

    const card = new THREE.Mesh(geometry, cardMaterial);
    card.rotation.set(-0.08, -0.32, 0.04);
    scene.add(card);

    const shadowGeometry = createRoundedCardGeometry(2.74, 4.19, 0.18, 0.03);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: "#111827",
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const shadowCard = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadowCard.position.set(0.18, -0.16, -0.22);
    shadowCard.rotation.set(-0.08, -0.32, 0.04);
    scene.add(shadowCard);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 90;
    const positions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 8;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[index * 3 + 2] = -3 - Math.random() * 6;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: "#cbd5e1",
        size: 0.018,
        transparent: true,
        opacity: 0.5,
      }),
    );
    scene.add(stars);

    const keyLight = new THREE.DirectionalLight("#ffffff", 2.2);
    keyLight.position.set(2.5, 4, 5);
    scene.add(keyLight);

    const blueLight = new THREE.PointLight("#3b82f6", 5, 10);
    blueLight.position.set(-3, 2, 3);
    scene.add(blueLight);

    const redLight = new THREE.PointLight("#ef4444", 4, 9);
    redLight.position.set(3, -2.2, 3);
    scene.add(redLight);

    scene.add(new THREE.AmbientLight("#ffffff", 0.44));

    let pointerX = 0;
    let pointerY = 0;
    const handlePointerMove = (event) => {
      const rect = host.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const scale = width < 420 ? 0.82 : width < 900 ? 0.92 : 1.08;
      card.scale.setScalar(scale);
      shadowCard.scale.setScalar(scale);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const time = clock.getElapsedTime();
      const drift = reduceMotion.matches ? 0 : Math.sin(time * 0.7) * 0.06;

      card.rotation.y = -0.32 + pointerX * 0.08 + drift;
      card.rotation.x = -0.08 - pointerY * 0.04;
      card.position.y = reduceMotion.matches ? 0 : Math.sin(time * 0.9) * 0.08;

      shadowCard.rotation.copy(card.rotation);
      shadowCard.position.y = card.position.y - 0.16;
      stars.rotation.z = time * 0.01;

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    host.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", handlePointerMove);
      geometry.dispose();
      shadowGeometry.dispose();
      starGeometry.dispose();
      cardMaterial.map?.dispose();
      cardMaterial.dispose();
      shadowMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0" />;
}
