import { useState, useRef, useEffect, useCallback } from "react";
import { generateCardPdf } from "../utils/pdfCardRenderer";

/**
 * usePdfPreview — Custom Hook
 * ───────────────────────────
 * Manages PDF preview generation, blob URL lifecycle, and cleanup.
 *
 * Handles:
 *   - Generating PDF from card payload
 *   - Creating and revoking blob URLs (no memory leaks)
 *   - Debounced auto-refresh when style settings change
 *
 * Extracted from Generate.jsx to reduce the God Component.
 */
export default function usePdfPreview() {
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const prevBlobUrlRef = useRef(null);

  /**
   * Generate the PDF preview for the given payload.
   */
  const regeneratePreview = useCallback(async (payload) => {
    if (!payload) return;
    setPdfGenerating(true);
    try {
      const blob = await generateCardPdf(payload);
      // Revoke old URL
      if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
      const url = URL.createObjectURL(blob);
      prevBlobUrlRef.current = url;
      setPdfBlobUrl(url);
      setPdfBlob(blob);
    } catch (err) {
      console.error("PDF preview generation failed:", err);
    } finally {
      setPdfGenerating(false);
    }
  }, []);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
    };
  }, []);

  return {
    pdfBlobUrl,
    pdfBlob,
    pdfGenerating,
    regeneratePreview,
  };
}
