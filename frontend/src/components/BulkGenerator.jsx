import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "../lib/supabaseClient";
import { fixOklabColors } from "../utils/fixOklabColors";
import {
  canvasesToPdfBlob,
  canvasToPngBlob,
  safeFileName,
} from "../utils/downloadHelpers";
import IDCard from "./IDCard";
import CorporateCard from "./CorporateCard";
import EventCard from "./EventCard";
import StudentCard from "./StudentCard";

/** Build a unique storage path – extracted to avoid React compiler purity check */
function buildFilePath(userId, memberName) {
  const timestamp = Date.now();
  const safeName = (memberName || "unnamed").replace(/[^a-zA-Z0-9]/g, "_");
  return `${userId}/${safeName}_${timestamp}.png`;
}

/** Daily upload limit per user (configurable via env) */
const DAILY_LIMIT = parseInt(import.meta.env.VITE_BULK_DAILY_LIMIT, 10) || 200;

/** Max members allowed in a single generation queue */
const MAX_QUEUE_SIZE = parseInt(import.meta.env.VITE_BULK_MAX_QUEUE, 10) || 500;

/** Batch size - yield to UI after this many cards to stay responsive */
const BATCH_SIZE = 50;

/**
 * BulkGenerator Component
 * --------------------------------------------------
 * For each member:
 *   1. Renders FRONT + BACK off-screen via html2canvas
 *   2. Uploads front PNG to Supabase Storage (for Dashboard / signed URLs)
 *   3. Builds a 2-page PDF (front + back) via jsPDF
 * After all members are processed the PDFs are bundled into a
 * single ZIP (JSZip + file-saver) and auto-downloaded.
 * Capped at DAILY_LIMIT uploads per user per day.
 */
export default function BulkGenerator({
  members = [],
  userId,
  onComplete,
  templateId = "custom",
  orgName = "",
  logoUrl = "",
  customFields = [],
  watermark = {},
  gradientColors = { start: "#1152d4", end: "#ef4444" },
  cardStyles = {
    bgColor: "#ffffff",
    fontColor: "#1e293b",
    fontFamily: "'Public Sans', sans-serif",
    accentColor: "#64748b",
    borderRadius: 12,
  },
  orientation = "horizontal",
  validityText = "Valid for 15 days from issue",
}) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    phase: "", // "Generating" | "Compressing ZIP" | "Done"
    step: "", // "capture" | "upload" | "pdf" | "zip"
    zipPercent: null,
    startedAt: null, // Date.now() when generation began
  });
  const [liveLog, setLiveLog] = useState([]); // [{name, status, time}]
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const [currentMember, setCurrentMember] = useState(null);
  const cancelRef = useRef(false);

  /** Format seconds to mm:ss */
  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  /** Resolve the correct card component for the selected template */
  const CardComponent = (() => {
    switch (templateId) {
      case "corporate":
        return CorporateCard;
      case "event":
        return EventCard;
      case "student":
        return StudentCard;
      default:
        return IDCard;
    }
  })();

  /** Capture a ref element as an html2canvas Canvas */
  const captureRef = async (ref) => {
    await new Promise((r) => setTimeout(r, 600));
    if (!ref.current) throw new Error("Card element not available for capture");

    // Wait for all images inside the card to finish loading
    const imgs = ref.current.querySelectorAll("img");
    await Promise.all(
      [...imgs].map(
        (img) =>
          new Promise((res) => {
            if (img.complete) return res();
            img.onload = res;
            img.onerror = res;
          }),
      ),
    );

    // Fix Tailwind v4 oklab() colors that html2canvas can't parse
    const restoreColors = fixOklabColors(ref.current);
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      return canvas;
    } finally {
      restoreColors();
    }
  };

  /** Check how many cards this user uploaded today */
  const checkDailyUsage = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error: countErr } = await supabase
      .from("generated_ids")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString());

    if (countErr) return { used: 0, err: countErr.message };
    return { used: count || 0, err: null };
  };

  /** Generate cards -> upload PNGs to Supabase + build ZIP of PDFs */
  const handleGenerate = useCallback(async () => {
    try {
      // ── 0. Queue size check ──
      if (members.length > MAX_QUEUE_SIZE) {
        setError(
          `Queue too large (${members.length}). Maximum ${MAX_QUEUE_SIZE} members per session.`,
        );
        return;
      }

      // ── 1. Check daily limit (non-fatal – default to allowing if check fails) ──
      let remaining = members.length;
      try {
        const { used, err: usageErr } = await checkDailyUsage();
        if (usageErr) {
          console.warn("Daily usage check failed:", usageErr);
          // Continue anyway – don't block generation for a usage-check failure
        } else {
          remaining = DAILY_LIMIT - (used || 0);
        }
      } catch (usageCheckErr) {
        console.warn("Daily usage check threw:", usageCheckErr);
        // Continue anyway
      }

      if (remaining <= 0) {
        setError(
          `Daily limit reached (${DAILY_LIMIT} cards/day). Please try again tomorrow.`,
        );
        return;
      }
      const toProcess = Math.min(members.length, remaining);
      if (toProcess < members.length) {
        setError(
          `Only ${remaining} of ${members.length} cards will be processed (daily limit: ${DAILY_LIMIT}).`,
        );
      }

      setGenerating(true);
      setResults([]);
      setLiveLog([]);
      setError("");
      cancelRef.current = false;
      const startTime = Date.now();
      setProgress({
        current: 0,
        total: toProcess,
        phase: "Generating",
        step: "",
        zipPercent: null,
        startedAt: startTime,
      });

      const newResults = [];
      const zip = new JSZip();
      const pdfFolder = zip.folder("id-cards");

      // ── 2. Render, upload & collect PDFs ──
      for (let i = 0; i < toProcess; i++) {
        if (cancelRef.current) {
          newResults.push({ name: "—", success: false, error: "Cancelled" });
          setLiveLog((prev) => [
            ...prev,
            {
              name: "—",
              status: "cancelled",
              time: ((Date.now() - startTime) / 1000).toFixed(1),
            },
          ]);
          break;
        }

        const member = members[i];
        setCurrentMember(member);
        setProgress((prev) => ({ ...prev, current: i + 1, step: "capture" }));

        const cardStart = Date.now();

        try {
          // Capture front + back canvases
          setProgress((prev) => ({ ...prev, step: "capture" }));
          const frontCanvas = await captureRef(frontRef);
          const backCanvas = await captureRef(backRef);

          // Upload front PNG to Supabase (for Dashboard signed-URL access)
          setProgress((prev) => ({ ...prev, step: "upload" }));
          const pngBlob = await canvasToPngBlob(frontCanvas);
          const filePath = buildFilePath(userId, member.name);

          // Build 2-page PDF (front + back) and add to ZIP FIRST
          // so local download always works even if cloud upload fails
          setProgress((prev) => ({ ...prev, step: "pdf" }));
          const pdfBlob = canvasesToPdfBlob(frontCanvas, backCanvas);
          pdfFolder.file(safeFileName(member.name, i, "pdf"), pdfBlob);

          // Attempt cloud upload (non-blocking for local download)
          let cloudWarning = "";
          try {
            setProgress((prev) => ({ ...prev, step: "upload" }));
            const { error: uploadError } = await supabase.storage
              .from("id-cards")
              .upload(filePath, pngBlob, {
                contentType: "image/png",
                upsert: false,
              });

            if (uploadError) {
              cloudWarning = `Upload: ${uploadError.message}`;
              console.warn(
                `Cloud upload failed for ${member.name}:`,
                uploadError.message,
              );
            } else {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 15);

              const { error: insertError } = await supabase
                .from("generated_ids")
                .insert({
                  user_id: userId,
                  file_url: filePath,
                  expires_at: expiresAt.toISOString(),
                });

              if (insertError) {
                cloudWarning = `DB: ${insertError.message}`;
                console.warn(
                  `DB insert failed for ${member.name}:`,
                  insertError.message,
                );
              }
            }
          } catch (cloudErr) {
            cloudWarning = `Cloud: ${cloudErr.message}`;
            console.warn(
              `Cloud save failed for ${member.name}:`,
              cloudErr.message,
            );
          }

          const cardTime = ((Date.now() - cardStart) / 1000).toFixed(1);
          newResults.push({ name: member.name, success: true, cloudWarning });
          setLiveLog((prev) => [
            ...prev,
            {
              name: member.name,
              status: cloudWarning ? "warn" : "ok",
              detail: cloudWarning || undefined,
              time: cardTime,
            },
          ]);
        } catch (err) {
          newResults.push({
            name: member.name,
            success: false,
            error: err.message,
          });
          setLiveLog((prev) => [
            ...prev,
            {
              name: member.name,
              status: "failed",
              detail: err.message,
              time: ((Date.now() - startTime) / 1000).toFixed(1),
            },
          ]);
        }

        // Yield to UI every batch
        if ((i + 1) % BATCH_SIZE === 0) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      // ── 3. Compress & download ZIP of PDFs ──
      const okCount = newResults.filter((r) => r.success).length;
      if (okCount > 0 && !cancelRef.current) {
        setProgress((prev) => ({
          ...prev,
          phase: "Compressing ZIP",
          step: "zip",
        }));
        try {
          const zipBlob = await zip.generateAsync(
            {
              type: "blob",
              compression: "DEFLATE",
              compressionOptions: { level: 6 },
            },
            (meta) =>
              setProgress((prev) => ({
                ...prev,
                zipPercent: Math.round(meta.percent),
              })),
          );
          saveAs(zipBlob, `id-cards-${templateId}-${Date.now()}.zip`);
          setProgress((prev) => ({ ...prev, phase: "Done", step: "done" }));
        } catch (zipErr) {
          setError(`ZIP creation failed: ${zipErr.message}`);
        }
      } else {
        setProgress((prev) => ({ ...prev, phase: "Done", step: "done" }));
      }

      setResults(newResults);
      setGenerating(false);
      setCurrentMember(null);
      if (onComplete) onComplete(newResults);
    } catch (fatalErr) {
      console.error("Fatal generation error:", fatalErr);
      setError(`Generation failed: ${fatalErr.message}`);
      setGenerating(false);
      setCurrentMember(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, userId, templateId, orgName, logoUrl, customFields, watermark]);

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);

  return (
    <div className="space-y-6">
      {/* ─── Header + Action Bar ─── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Bulk ID Generator
          </h3>
          <p className="text-sm text-slate-500">
            {members.length.toLocaleString()} member
            {members.length !== 1 ? "s" : ""} ready
            {" · "}Limited to {DAILY_LIMIT} cards/day · Max {MAX_QUEUE_SIZE} per
            queue
          </p>
        </div>

        <div className="flex items-center gap-3">
          {generating ? (
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={members.length === 0}
              className="px-6 py-2.5 bg-[#1152d4] hover:bg-[#1152d4]/90 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-[#1152d4]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Generate &amp; Download
            </button>
          )}
        </div>
      </div>

      {/* Info badge */}
      <div className="text-xs px-3 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700">
        Each card is uploaded to cloud storage (15-day expiry, signed URLs)
        <strong> and </strong> bundled as a 2-page PDF (front + back) in a ZIP
        that downloads automatically. Limited to {DAILY_LIMIT} cards/day, max{" "}
        {MAX_QUEUE_SIZE} per queue.
      </div>

      {/* ─── Enhanced Progress Panel ─── */}
      {(generating || progress.phase === "Done") && progress.total > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Phase Steps */}
          <div className="flex border-b border-slate-100">
            {[
              {
                key: "capture",
                label: "Capture",
                icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z",
              },
              {
                key: "upload",
                label: "Upload",
                icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
              },
              {
                key: "pdf",
                label: "PDF",
                icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
              },
              {
                key: "zip",
                label: "ZIP",
                icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
              },
            ].map((s, idx) => {
              const steps = ["capture", "upload", "pdf", "zip", "done"];
              const currentIdx = steps.indexOf(progress.step);
              const thisIdx = idx;
              const isActive = progress.step === s.key;
              const isDone = currentIdx > thisIdx || progress.step === "done";
              return (
                <div
                  key={s.key}
                  className={`flex-1 flex flex-col items-center py-3 gap-1 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "bg-[#1152d4]/5 text-[#1152d4]"
                      : isDone
                        ? "text-green-600"
                        : "text-slate-300"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    {isDone && !isActive ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={s.icon}
                      />
                    )}
                  </svg>
                  {s.label}
                </div>
              );
            })}
          </div>

          {/* Progress bar + stats */}
          <div className="px-4 pt-3 pb-2 space-y-2">
            {/* Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              {progress.phase === "Compressing ZIP" ? (
                <div
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.zipPercent ?? 0}%` }}
                />
              ) : (
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    progress.phase === "Done" ? "bg-green-500" : "bg-[#1152d4]"
                  }`}
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">
                {progress.phase === "Compressing ZIP" ? (
                  <>Compressing ZIP… {progress.zipPercent ?? 0}%</>
                ) : progress.phase === "Done" ? (
                  <span className="text-green-600">Generation complete</span>
                ) : (
                  <>
                    {progress.current}/{progress.total}
                    {" · "}
                    <span className="text-[#1152d4] font-semibold">
                      {currentMember?.name || "…"}
                    </span>
                  </>
                )}
              </span>
              <span className="tabular-nums">
                {(() => {
                  if (!progress.startedAt) return "";
                  const elapsed = (Date.now() - progress.startedAt) / 1000;
                  if (progress.phase === "Done")
                    return `Total: ${fmtTime(elapsed)}`;
                  const perCard =
                    progress.current > 0 ? elapsed / progress.current : 0;
                  const remaining =
                    perCard * (progress.total - progress.current);
                  return `${fmtTime(elapsed)} elapsed${progress.current > 1 ? ` · ~${fmtTime(remaining)} left` : ""}`;
                })()}
              </span>
            </div>

            {/* Large batch hint */}
            {members.length > 50 && progress.phase === "Generating" && (
              <p className="text-[10px] text-slate-400 text-center">
                Large batch — keep this tab active.
              </p>
            )}
          </div>

          {/* Live log */}
          {liveLog.length > 0 && (
            <div className="border-t border-slate-100 max-h-40 overflow-y-auto">
              <div className="divide-y divide-slate-50">
                {liveLog.slice(-50).map((entry, i) => (
                  <div
                    key={i}
                    className="px-4 py-1.5 flex items-center justify-between text-[11px]"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {entry.status === "ok" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      ) : entry.status === "warn" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      ) : entry.status === "failed" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      )}
                      <span
                        className={
                          entry.status === "failed"
                            ? "text-red-600"
                            : "text-slate-600"
                        }
                      >
                        {entry.name}
                      </span>
                      {entry.detail && (
                        <span className="text-red-400 truncate ml-1">
                          — {entry.detail}
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400 tabular-nums shrink-0 ml-2">
                      {entry.time}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Results ─── */}
      {results.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Generation Results
            </span>
            <div className="flex gap-3 text-xs">
              <span className="text-green-600 font-semibold">
                {successCount.toLocaleString()} uploaded + zipped
              </span>
              {failedResults.length > 0 && (
                <span className="text-red-600 font-semibold">
                  {failedResults.length.toLocaleString()} failed
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {results.slice(0, 200).map((r, i) => (
              <div
                key={i}
                className="px-4 py-2.5 flex items-center justify-between text-sm"
              >
                <span className="text-slate-700">{r.name}</span>
                {r.success ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    Done
                  </span>
                ) : (
                  <span className="text-red-500 text-xs">{r.error}</span>
                )}
              </div>
            ))}
            {results.length > 200 && (
              <div className="px-4 py-2 text-xs text-slate-400 text-center">
                ...and {(results.length - 200).toLocaleString()} more
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ─── Off-screen card renderers (front + back) ─── */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <div ref={frontRef}>
          <CardComponent
            data={currentMember}
            showBack={false}
            orgName={orgName}
            logoUrl={logoUrl}
            customFields={customFields}
            watermark={watermark}
            gradientColors={gradientColors}
            cardStyles={cardStyles}
            orientation={orientation}
            validityText={validityText}
            renderSide="front"
          />
        </div>
        <div ref={backRef}>
          <CardComponent
            data={currentMember}
            showBack={true}
            orgName={orgName}
            logoUrl={logoUrl}
            customFields={customFields}
            watermark={watermark}
            gradientColors={gradientColors}
            cardStyles={cardStyles}
            orientation={orientation}
            validityText={validityText}
            renderSide="back"
          />
        </div>
      </div>
    </div>
  );
}
