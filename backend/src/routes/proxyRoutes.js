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

/**
 * Convert common Google Drive sharing URLs to direct-download URLs.
 * Supports:
 *   - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   - https://drive.google.com/open?id=FILE_ID
 *   - Already-direct: https://drive.google.com/uc?export=view&id=FILE_ID
 */
function normalizeDriveUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;

    if (host === "drive.google.com" || host === "www.drive.google.com") {
      // /file/d/FILE_ID/...
      const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
      }
      // /open?id=FILE_ID
      const openId = url.searchParams.get("id");
      if (openId) {
        return `https://drive.google.com/uc?export=view&id=${openId}`;
      }
    }

    // lh3.googleusercontent.com links already work directly
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

router.get("/image", apiLimiter, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing 'url' query parameter." });
  }

  // Validate URL and block internal/private addresses (SSRF protection)
  try {
    const parsed = new URL(url);
    if (
      BLOCKED_HOSTS.includes(parsed.hostname) ||
      parsed.hostname.endsWith(".local")
    ) {
      return res.status(403).json({
        error: "Proxying to internal addresses is not allowed.",
      });
    }
    // Block private IP ranges
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) {
      return res.status(403).json({
        error: "Proxying to private IP addresses is not allowed.",
      });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL." });
  }

  try {
    const targetUrl = normalizeDriveUrl(url);

    // Use native fetch (Node 18+)
    const response = await fetch(targetUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000), // 15s timeout
      headers: {
        // Pretend to be a browser so Google Drive serves the file
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Upstream returned ${response.status}`,
      });
    }

    const contentType = response.headers.get("content-type") || "";

    // Only allow image types
    if (!contentType.startsWith("image/")) {
      return res.status(415).json({
        error:
          "URL did not return an image. Make sure the file is publicly shared.",
      });
    }

    // Stream the body, enforcing a size cap
    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10,
    );
    if (contentLength > MAX_IMAGE_SIZE) {
      return res.status(413).json({ error: "Image too large (max 10 MB)." });
    }

    // Set CORS + caching headers
    res.set({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    });

    // Pipe the response body
    const reader = response.body.getReader();
    let totalBytes = 0;

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        totalBytes += value.length;
        if (totalBytes > MAX_IMAGE_SIZE) {
          res.destroy(new Error("Image exceeded size limit."));
          return;
        }
        res.write(value);
      }
    };

    await pump();
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
