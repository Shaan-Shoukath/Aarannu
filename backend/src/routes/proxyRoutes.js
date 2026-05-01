/**
 * Image Proxy Routes
 * ──────────────────
 * Proxies external image URLs (especially Google Drive) so the
 * frontend can load them without CORS issues.
 *
 * GET /api/proxy/image?url=<encoded-url>
 *
 * Security:
 *  - Only allows image content-types to pass through.
 *  - Limits response size to 10 MB.
 *  - Rate-limited to prevent abuse.
 */

const express = require("express");
const { apiLimiter } = require("../middleware/rateLimiter");
const router = express.Router();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

// Blocked domains to prevent SSRF against internal services
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
];

function getDriveFileId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;

    if (host === "drive.google.com" || host === "www.drive.google.com") {
      const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) return fileMatch[1];
      return url.searchParams.get("id");
    }

    return null;
  } catch {
    return null;
  }
}

function validateProxyUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (
      BLOCKED_HOSTS.includes(parsed.hostname) ||
      parsed.hostname.endsWith(".local")
    ) {
      return "Proxying to internal addresses is not allowed.";
    }
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) {
      return "Proxying to private IP addresses is not allowed.";
    }
    return null;
  } catch {
    return "Invalid URL.";
  }
}

function buildImageCandidates(rawUrl) {
  const driveId = getDriveFileId(rawUrl);
  if (!driveId) return [rawUrl];

  return [
    `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
    `https://drive.usercontent.google.com/download?id=${driveId}&export=view&authuser=0`,
    `https://drive.google.com/uc?export=view&id=${driveId}`,
    `https://drive.google.com/uc?export=download&id=${driveId}`,
    rawUrl,
  ];
}

function detectImageContentType(buffer, fallback = "") {
  if (fallback.startsWith("image/")) return fallback;
  if (!buffer || buffer.length < 12) return "";

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return "";
}

async function fetchImageCandidate(targetUrl) {
  const response = await fetch(targetUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const contentLength = parseInt(
    response.headers.get("content-length") || "0",
    10,
  );
  if (contentLength > MAX_IMAGE_SIZE) {
    return { ok: false, status: 413 };
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length > MAX_IMAGE_SIZE) {
    return { ok: false, status: 413 };
  }

  const contentType = detectImageContentType(
    buffer,
    response.headers.get("content-type") || "",
  );
  if (!contentType) {
    return { ok: false, status: 415 };
  }

  return { ok: true, buffer, contentType };
}

router.get("/image", apiLimiter, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing 'url' query parameter." });
  }

  const validationError = validateProxyUrl(url);
  if (validationError) {
    const status = validationError === "Invalid URL." ? 400 : 403;
    return res.status(status).json({ error: validationError });
  }

  try {
    let lastStatus = 502;
    for (const targetUrl of buildImageCandidates(url)) {
      const result = await fetchImageCandidate(targetUrl);
      if (!result.ok) {
        lastStatus = result.status || lastStatus;
        continue;
      }

      res.set({
        "Content-Type": result.contentType,
        "Content-Length": String(result.buffer.length),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(result.buffer);
    }

    return res.status(lastStatus === 413 ? 413 : 415).json({
      error:
        "URL did not return a public image. For Google Drive, set sharing to 'Anyone with the link' and use the file share URL.",
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to proxy image.",
        details: err.message,
      });
    }
  }
});

module.exports = router;
