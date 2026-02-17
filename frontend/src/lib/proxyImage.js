/**
 * proxyImage.js
 * ─────────────
 * Converts photo URLs so they work inside <img> + html2canvas.
 *
 * Google Drive links are rewritten to go through our backend proxy
 * at /api/proxy/image?url=... which strips CORS restrictions.
 *
 * All other URLs are returned as-is.
 */

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Returns true if the URL looks like a Google Drive link.
 */
function isGoogleDriveUrl(url) {
  if (!url) return false;
  return (
    url.includes("drive.google.com") ||
    url.includes("docs.google.com") ||
    url.includes("lh3.googleusercontent.com")
  );
}

/**
 * If the URL is a Google Drive link, route it through the backend
 * image proxy. Otherwise return the original URL unchanged.
 */
export function proxyImageUrl(url) {
  if (!url) return url;
  if (isGoogleDriveUrl(url)) {
    return `${BACKEND}/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
