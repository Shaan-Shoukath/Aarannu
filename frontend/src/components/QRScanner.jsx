import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

/**
 * Extracts a card UUID from scanned QR text.
 * Handles both raw UUIDs and full verify URLs.
 */
function extractCardId(text) {
  const urlMatch = text.match(
    /\/verify\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (urlMatch) return urlMatch[1];

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(text.trim())) return text.trim();

  return null;
}

/**
 * QRScanner — camera-based QR code reader.
 *
 * Props:
 *   onScan(cardId)   — called with the extracted UUID on a valid scan
 *   onError(msg)     — called when QR text is not a valid Aarannu card
 *   active           — mount/unmount the scanner
 */
export default function QRScanner({ onScan, onError, active }) {
  const scannerRef = useRef(null);
  const lastScannedRef = useRef({ id: null, at: 0 });

  useEffect(() => {
    if (!active) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        const cardId = extractCardId(decodedText);
        if (!cardId) {
          onError?.("Invalid QR code — not an Aarannu card.");
          return;
        }
        // Debounce: suppress same card within 3 seconds
        const now = Date.now();
        if (
          lastScannedRef.current.id === cardId &&
          now - lastScannedRef.current.at < 3000
        ) {
          return;
        }
        lastScannedRef.current = { id: cardId, at: now };
        onScan(cardId);
      },
      () => {
        // Per-frame decode failures are expected — ignore silently
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [active, onScan, onError]);

  if (!active) return null;

  return (
    <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
      <div id="qr-reader" className="w-full" />
      <p className="text-xs text-center text-slate-400 py-2">
        Point the camera at a member&apos;s ID card QR code
      </p>
    </div>
  );
}
