import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { utils, writeFileXLSX } from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { safeFileName } from "../utils/downloadHelpers";
import { renderCardPdfWithBestSupport } from "../utils/cardPdfSupport";

/** Build a unique storage path – extracted to avoid React compiler purity check */
function buildFilePath(userId, memberName) {
  const timestamp = Date.now();
  const safeName = (memberName || "unnamed").replace(/[^a-zA-Z0-9]/g, "_");
  return `${userId}/${safeName}_${timestamp}.png`;
}

function buildMemberResultKey(member, rowNumber) {
  return [
    member?.projectMemberId || "local",
    member?.id_number || "no-id",
    (member?.email || "").trim().toLowerCase(),
    (member?.name || "").trim().toLowerCase(),
    rowNumber,
  ].join("::");
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
 *   3. Builds a 2-page PDF (front + back) via PDFKit
 * After all members are processed the PDFs are bundled into a
 * single ZIP (JSZip + file-saver) and auto-downloaded.
 * Capped at DAILY_LIMIT uploads per user per day.
 */
export default function BulkGenerator({
  members = [],
  userId,
  projectId = null,
  onComplete,
  templateId = "custom",
  orgName = "",
  logoUrl = "",
  customFields = [],
  watermark = {},
  gradientColors = { start: "#2563EB", end: "#ef4444" },
  cardStyles = {
    bgColor: "#ffffff",
    fontColor: "#1e293b",
    fontFamily: "'Public Sans', sans-serif",
    accentColor: "#64748b",
    borderRadius: 12,
  },
  orientation = "horizontal",
  validityText = "Valid as per subscription plan",
  rangeStart = 1,
  rangeEnd = 0, // 0 means "all"
  perPersonCap = 0, // 0 means "no limit"
  emailAfterGenerate = false,
  uploadToCloud = true,
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
  const [currentMember, setCurrentMember] = useState(null);
  const cancelRef = useRef(false);
  const [downloadFormat, setDownloadFormat] = useState("pdf");

  // Email step state
  const [emailProgress, setEmailProgress] = useState({
    sending: false,
    current: 0,
    total: 0,
    phase: "", // "Sending" | "Done"
  });
  // Email results keyed by a stable per-member row key
  const [emailResults, setEmailResults] = useState({});
  // Store PDF blobs keyed by a stable per-member row key for email attachments
  const pdfBlobsRef = useRef({});

  /**
   * Apply range + per-person cap filtering.
   * rangeStart/rangeEnd are 1-based inclusive indices.
   * perPersonCap = max cards per unique person name (0 = unlimited).
   */
  const getFilteredMembers = useCallback(() => {
    const start = Math.max(0, (rangeStart || 1) - 1);
    const end =
      rangeEnd > 0 ? Math.min(rangeEnd, members.length) : members.length;
    const sliced = members.slice(start, end);

    if (!perPersonCap || perPersonCap <= 0) return sliced;

    // Apply per-person cap: track how many times each name appears
    const nameCount = {};
    return sliced.filter((m) => {
      const key = (m.name || "").trim().toLowerCase();
      nameCount[key] = (nameCount[key] || 0) + 1;
      return nameCount[key] <= perPersonCap;
    });
  }, [members, rangeStart, rangeEnd, perPersonCap]);

  /** Format seconds to mm:ss */
  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  /**
   * Build the render payload and generate a PDF client-side.
   * Returns a Blob of the PDF.
   */
  const renderCardPdf = async (memberData) => {
    const payload = {
      data: memberData,
      template: templateId,
      orgName,
      logoUrl,
      cardStyles,
      gradientColors,
      fieldVisibility: {},
      orientation,
      validityText,
      watermark,
      customFields,
    };
    return renderCardPdfWithBestSupport(payload);
  };

  const persistProjectMembershipIds = useCallback(async (processedMembers) => {
    if (!projectId || processedMembers.length === 0) return { failed: 0 };

    const updates = processedMembers.filter(
      (member) => member?.projectMemberId && member?.id_number,
    );
    if (updates.length === 0) return { failed: 0 };

    const settled = await Promise.allSettled(
      updates.map((member) =>
        supabase
          .from("project_members")
          .update({
            custom_fields: {
              ...(member.projectCustomFields || {}),
              membership_id: member.id_number,
            },
          })
          .eq("id", member.projectMemberId),
      ),
    );

    const failed = settled.filter(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" && result.value?.error),
    ).length;

    return { failed };
  }, [projectId]);

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
      // Apply range + per-person cap
      const filteredMembers = getFilteredMembers();

      // ── 0. Queue size check ──
      if (filteredMembers.length > MAX_QUEUE_SIZE) {
        setError(
          `Queue too large (${filteredMembers.length}). Maximum ${MAX_QUEUE_SIZE} members per session.`,
        );
        return;
      }

      if (filteredMembers.length === 0) {
        setError(
          "No members to generate after applying range and per-person cap filters.",
        );
        return;
      }

      // ── 1. Check daily limit (non-fatal – default to allowing if check fails) ──
      let remaining = filteredMembers.length;
      try {
        const { used, err: usageErr } = await checkDailyUsage();
        if (usageErr) {
          console.warn("Daily usage check failed:", usageErr);
        } else {
          remaining = DAILY_LIMIT - (used || 0);
        }
      } catch (usageCheckErr) {
        console.warn("Daily usage check threw:", usageCheckErr);
      }

      if (remaining <= 0) {
        setError(
          `Daily limit reached (${DAILY_LIMIT} cards/day). Please try again tomorrow.`,
        );
        return;
      }
      const toProcess = Math.min(filteredMembers.length, remaining);
      if (toProcess < filteredMembers.length) {
        setError(
          `Only ${remaining} of ${filteredMembers.length} cards will be processed (daily limit: ${DAILY_LIMIT}).`,
        );
      }

      setGenerating(true);
      setResults([]);
      setLiveLog([]);
      setError("");
      cancelRef.current = false;
      pdfBlobsRef.current = {};
      setEmailResults({});
      setEmailProgress({ sending: false, current: 0, total: 0, phase: "" });
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
      const successfulMembers = [];
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

        const member = filteredMembers[i];
        const rowNumber = i + 1;
        const resultKey = buildMemberResultKey(member, rowNumber);
        setCurrentMember(member);
        setProgress((prev) => ({ ...prev, current: rowNumber, step: "capture" }));

        const cardStart = Date.now();

        try {
          // Generate PDF client-side
          setProgress((prev) => ({ ...prev, step: "pdf" }));
          const pdfBlob = await renderCardPdf(member);

          // Add to ZIP
          pdfFolder.file(safeFileName(member.name, i, "pdf"), pdfBlob);

          // Store for email attachments
          pdfBlobsRef.current[resultKey] = {
            blob: pdfBlob,
            member,
            resultKey,
            rowNumber,
          };

          // Attempt cloud upload (non-blocking for local download)
          let cloudWarning = "";
          if (uploadToCloud) {
            try {
              setProgress((prev) => ({ ...prev, step: "upload" }));
              const filePath = buildFilePath(userId, member.name).replace('.png', '.pdf');
              const { error: uploadError } = await supabase.storage
                .from("id-cards")
                .upload(filePath, pdfBlob, {
                  contentType: "application/pdf",
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
                expiresAt.setDate(expiresAt.getDate() + 365);

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
          } else {
            cloudWarning = "Skipped (upload disabled)";
          }

          const cardTime = ((Date.now() - cardStart) / 1000).toFixed(1);
          newResults.push({
            resultKey,
            rowNumber,
            name: member.name,
            id_number: member.id_number,
            success: true,
            cloudWarning,
          });
          successfulMembers.push(member);
          setLiveLog((prev) => [
            ...prev,
            {
              resultKey,
              rowNumber,
              name: member.name,
              status: cloudWarning ? "warn" : "ok",
              detail: cloudWarning || undefined,
              time: cardTime,
            },
          ]);
        } catch (err) {
          newResults.push({
            resultKey,
            rowNumber,
            name: member.name,
            id_number: member.id_number,
            success: false,
            error: err.message,
          });
          setLiveLog((prev) => [
            ...prev,
            {
              resultKey,
              rowNumber,
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

      if (!cancelRef.current && successfulMembers.length > 0) {
        const { failed } = await persistProjectMembershipIds(successfulMembers);
        if (failed > 0) {
          setError(
            "Cards were generated, but some membership IDs could not be written back to the project export.",
          );
        }
      }

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
        } catch (zipErr) {
          setError(`ZIP creation failed: ${zipErr.message}`);
        }
      }

      // ── 4. Email cards via Brevo (if enabled) ──
      if (emailAfterGenerate && okCount > 0 && !cancelRef.current) {
        setProgress((prev) => ({ ...prev, phase: "Emailing", step: "email" }));
        await handleEmailCards(pdfBlobsRef.current);
      }

      setProgress((prev) => ({ ...prev, phase: "Done", step: "done" }));

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
  }, [
    members,
    userId,
    templateId,
    orgName,
    logoUrl,
    customFields,
    watermark,
    getFilteredMembers,
    persistProjectMembershipIds,
    emailAfterGenerate,
    downloadFormat,
    uploadToCloud,
  ]);

  /**
   * Email generated PDF cards via the backend Brevo endpoint.
   * Iterates over generated PDF blobs; for each member with an email,
   * sends a POST to /api/email/send-card with the PDF as base64.
   */
  const handleEmailCards = async (pdfBlobs) => {
    // Only email members who have sendEmail turned ON and have a valid email
    const entries = Object.values(pdfBlobs).filter(
      (e) => e.member?.sendEmail && e.member?.email?.trim(),
    );
    if (entries.length === 0) {
      return;
    }

    setEmailProgress({
      sending: true,
      current: 0,
      total: entries.length,
      phase: "Sending",
    });
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authHeader = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};

    for (let i = 0; i < entries.length; i++) {
      if (cancelRef.current) break;
      const { blob, member, resultKey } = entries[i];
      setEmailProgress((prev) => ({ ...prev, current: i + 1 }));

      try {
        // Convert blob to base64
        const arrayBuf = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuf).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            "",
          ),
        );

        const res = await fetch(`${backendUrl}/api/email/send-card`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({
            recipientEmail: member.email.trim(),
            recipientName: member.name,
            pdfBase64: base64,
            fileName: safeFileName(member.name, i, "pdf"),
            orgName: orgName || "Community ID",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }

        setEmailResults((prev) => ({
          ...prev,
          [resultKey]: { status: "ok", detail: member.email },
        }));
      } catch (err) {
        setEmailResults((prev) => ({
          ...prev,
          [resultKey]: { status: "failed", detail: err.message },
        }));
      }
    }

    setEmailProgress((prev) => ({ ...prev, sending: false, phase: "Done" }));
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Bulk ID Generator
          </h3>
          <p className="text-sm text-slate-500">
            {(() => {
              const filtered = getFilteredMembers();
              const rangeInfo =
                filtered.length !== members.length
                  ? `${filtered.length} of ${members.length} (filtered)`
                  : `${members.length}`;
              return `${rangeInfo} member${filtered.length !== 1 ? "s" : ""} ready`;
            })()}
            {" · "}Limited to {DAILY_LIMIT} cards/day · Max {MAX_QUEUE_SIZE} per
            queue
            {emailAfterGenerate &&
              ` · ${members.filter((m) => m.sendEmail).length} email(s)`}
          </p>
        </div>
      </div>

      {/* Info badge */}
      <div className="text-xs px-3 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700">
        Each card is uploaded to cloud storage (expiry per subscription, signed
        URLs)
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
              ...(emailAfterGenerate
                ? [
                    {
                      key: "email",
                      label: "Email",
                      icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
                    },
                  ]
                : []),
            ].map((s, idx) => {
              const steps = [
                "capture",
                "upload",
                "pdf",
                "zip",
                ...(emailAfterGenerate ? ["email"] : []),
                "done",
              ];
              const currentIdx = steps.indexOf(progress.step);
              const thisIdx = idx;
              const isActive = progress.step === s.key;
              const isDone = currentIdx > thisIdx || progress.step === "done";
              return (
                <div
                  key={s.key}
                  className={`flex-1 flex flex-col items-center py-3 gap-1 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "bg-[#2563EB]/5 text-[#2563EB]"
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
                    progress.phase === "Done" ? "bg-green-500" : "bg-[#2563EB]"
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
                    <span className="text-[#2563EB] font-semibold">
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
                      {/* Inline email status */}
                      {entry.resultKey && emailResults[entry.resultKey] && (
                        <span
                          className={`ml-2 flex items-center gap-0.5 ${
                            emailResults[entry.resultKey].status === "ok"
                              ? "text-blue-500"
                              : "text-red-400"
                          }`}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          {emailResults[entry.resultKey].status === "ok"
                            ? "Sent"
                            : emailResults[entry.resultKey].detail}
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
            <div className="flex gap-3 text-xs items-center">
              <span className="text-green-600 font-semibold">
                {successCount.toLocaleString()} uploaded + zipped
              </span>
              {failedResults.length > 0 && (
                <span className="text-red-600 font-semibold">
                  {failedResults.length.toLocaleString()} failed
                </span>
              )}
              {Object.keys(emailResults).length > 0 && (
                <span className="text-blue-600 font-semibold">
                  {
                    Object.values(emailResults).filter((e) => e.status === "ok")
                      .length
                  }{" "}
                  emailed
                </span>
              )}
              {successCount > 0 && (
                <>
                  <button
                    onClick={() => {
                      const header =
                        "Queue Row,Name,ID Number,Status,Email Status";
                      const rows = results.map((r) => {
                        const emailSt = r.resultKey && emailResults[r.resultKey]
                          ? emailResults[r.resultKey].status === "ok"
                            ? "Sent"
                            : "Failed"
                          : "";
                        return `${r.rowNumber || ""},"${(r.name || "").replace(/"/g, '""')}","${(r.id_number || "").replace(/"/g, '""')}",${r.success ? "Success" : "Failed"},${emailSt}`;
                      });
                      const csv = `\uFEFF${[header, ...rows].join("\n")}`;
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `generated-ids-${Date.now()}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded text-[10px] font-medium transition-colors"
                    title="Download the generated membership roster as CSV"
                  >
                    ⬇ Download CSV
                  </button>
                  <button
                    onClick={() => {
                      const rows = results.map((r) => ({
                        "Queue Row": r.rowNumber || "",
                        Name: r.name || "",
                        "Membership ID": r.id_number || "",
                        Status: r.success ? "Success" : "Failed",
                        "Email Status": r.resultKey && emailResults[r.resultKey]
                          ? emailResults[r.resultKey].status === "ok"
                            ? "Sent"
                            : "Failed"
                          : "",
                      }));
                      const ws = utils.json_to_sheet(rows);
                      const wb = utils.book_new();
                      utils.book_append_sheet(wb, ws, "Membership IDs");
                      writeFileXLSX(wb, `generated-ids-${Date.now()}.xlsx`);
                    }}
                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-medium transition-colors"
                    title="Download the generated membership roster as Excel"
                  >
                    ⬇ Download XLSX
                  </button>
                  <button
                    onClick={() => {
                      const header = "Queue Row\tName\tID Number\tStatus";
                      const rows = results.map(
                        (r) =>
                          `${r.rowNumber || ""}\t${r.name || ""}\t${r.id_number || ""}\t${r.success ? "Success" : "Failed"}`,
                      );
                      const tsv = [header, ...rows].join("\n");
                      navigator.clipboard.writeText(tsv).then(
                        () =>
                          alert(
                            "Copied! Paste directly into your Google Sheet (Ctrl+V).",
                          ),
                        () => alert("Could not copy to clipboard."),
                      );
                    }}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium transition-colors"
                    title="Copy tab-separated data to paste into Google Sheets"
                  >
                    📋 Copy for Sheets
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {results.slice(0, 200).map((r, i) => (
              <div
                key={r.resultKey || i}
                className="px-4 py-2.5 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-400 tabular-nums">
                    #{r.rowNumber || i + 1}
                  </span>
                  <span className="text-slate-700">{r.name}</span>
                  {r.id_number && (
                    <span className="text-xs font-mono text-slate-400">
                      {r.id_number}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Email status (inline after generation status) */}
                  {r.resultKey && emailResults[r.resultKey] && (
                    <span
                      className={`flex items-center gap-1 text-xs font-medium ${
                        emailResults[r.resultKey].status === "ok"
                          ? "text-blue-600"
                          : "text-red-500"
                      }`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      {emailResults[r.resultKey].status === "ok"
                        ? "Emailed"
                        : emailResults[r.resultKey].detail}
                    </span>
                  )}
                  {/* Generation status */}
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
              </div>
            ))}
            {results.length > 200 && (
              <div className="px-4 py-2 text-xs text-slate-400 text-center">
                ...and {(results.length - 200).toLocaleString()} more
              </div>
            )}
          </div>
          {/* Email progress bar (shows during email sending phase) */}
          {(emailProgress.sending || emailProgress.phase === "Done") &&
            emailProgress.total > 0 && (
              <div className="border-t border-slate-200 px-4 py-3 bg-blue-50">
                <div className="flex items-center justify-between text-xs text-blue-700 mb-1.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Email Delivery
                  </span>
                  <span>
                    {emailProgress.current}/{emailProgress.total}
                    {emailProgress.phase === "Done" && " — Complete"}
                  </span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      emailProgress.phase === "Done"
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                    style={{
                      width: `${(emailProgress.current / emailProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ─── Sticky Bottom Bar: Generate & Download + Upload to Supabase ─── */}
      <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-b-xl px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Upload to Supabase indicator */}
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div>
              <p className="text-xs font-medium text-slate-700 leading-none">
                {uploadToCloud
                  ? "Uploads to Supabase"
                  : "Local only (no upload)"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {(() => {
                  const f = getFilteredMembers();
                  return `${f.length} card${f.length !== 1 ? "s" : ""} will be generated`;
                })()}
              </p>
            </div>
          </div>

          {/* Format selector + Action button */}
          <div className="flex items-center gap-3">
            {!generating && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                {["pdf", "jpeg", "png"].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setDownloadFormat(fmt)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      downloadFormat === fmt
                        ? "bg-white text-[#2563EB] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {generating ? (
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={members.length === 0}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-[#2563EB]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
      </div>
    </div>
  );
}
