/**
 * proxyImage.js
 * ─────────────
 * Converts photo URLs so they work inside <img> + html2canvas.
 *
 * ALL external image URLs are routed through our backend proxy
 * at /api/proxy/image?url=... so CORS headers are always present.
 * This prevents the "tainted canvas" error in html2canvas and
 * ensures images display correctly with crossOrigin="anonymous".
 *
 * Local / data-URI / blob URLs are returned as-is.
 */

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Returns true when the URL points to an external resource that
 * needs to be proxied for CORS compatibility.
 */
function needsProxy(url) {
  if (!url) return false;
  // Data URIs, blobs, and relative paths don't need proxying
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("/") ||
    url.startsWith(".")
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    // Skip localhost / 127.0.0.1 — those are local dev resources
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Route external image URLs through the backend proxy so
 * crossOrigin="anonymous" works for any domain.
 */
export function proxyImageUrl(url) {
  if (!url) return url;
  if (needsProxy(url)) {
    return `${BACKEND}/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
