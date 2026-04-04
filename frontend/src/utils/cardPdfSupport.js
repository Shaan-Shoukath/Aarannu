import { generateCardPdf } from "./pdfCardRenderer";

const BACKEND =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000";

const MALAYALAM_REGEX = /[\u0D00-\u0D7F]/u;

function hasMalayalamText(value) {
  if (!value) return false;

  if (typeof value === "string") {
    return MALAYALAM_REGEX.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMalayalamText(item));
  }

  if (typeof value === "object") {
    return Object.values(value).some((item) => hasMalayalamText(item));
  }

  return false;
}

function isSvgAsset(value) {
  if (typeof value !== "string" || !value) return false;

  return (
    value.startsWith("data:image/svg+xml") || /\.svg(?:[?#].*)?$/i.test(value)
  );
}

export function needsBrowserRenderedPdf(payload) {
  return (
    hasMalayalamText(payload?.orgName) ||
    hasMalayalamText(payload?.data) ||
    hasMalayalamText(payload?.watermark?.text) ||
    hasMalayalamText(payload?.validityText) ||
    isSvgAsset(payload?.logoUrl) ||
    isSvgAsset(payload?.watermark?.imageUrl) ||
    isSvgAsset(payload?.signatureUrl)
  );
}

async function renderPdfViaBackend(payload) {
  const res = await fetch(`${BACKEND}/api/render/card`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      format: "pdf",
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.details || body?.error || "Backend PDF rendering failed.");
  }

  return res.blob();
}

export async function renderCardPdfWithBestSupport(payload) {
  if (!needsBrowserRenderedPdf(payload)) {
    return generateCardPdf(payload);
  }

  return renderPdfViaBackend(payload);
}
