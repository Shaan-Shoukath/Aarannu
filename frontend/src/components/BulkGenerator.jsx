import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient";
import IDCard from "./IDCard";

/**
 * BulkGenerator Component
 * --------------------------------------------------
 * Generates ID card images from an array of member data.
 *
 * Flow:
 *  1. Receives `members` array (from parent / manual entry).
 *  2. For each member, renders the IDCard off-screen.
 *  3. Uses html2canvas to convert it to a PNG blob.
 *  4. Uploads the blob to Supabase Storage (private bucket).
 *  5. Inserts a row into `generated_ids` with file_url and expires_at.
 *
 * Security:
 *  • Files are uploaded to a private bucket.
 *  • Only signed URLs are used for access (generated on demand).
 *  • RLS ensures users can only insert their own records.
 */
export default function BulkGenerator({ members = [], userId, onComplete }) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const cardRef = useRef(null);
  const [currentMember, setCurrentMember] = useState(null);

  const generateAll = async () => {
    if (members.length === 0) return;

    setGenerating(true);
    setError("");
    setResults([]);
    setProgress({ current: 0, total: members.length });

    const newResults = [];

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      setCurrentMember(member);
      setProgress({ current: i + 1, total: members.length });

      // Wait a tick for React to render the card with new data
      await new Promise((r) => setTimeout(r, 300));

      try {
        // 1. Capture the card as an image
        const canvas = await html2canvas(cardRef.current, {
          scale: 2, // 2× for crisp output
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        // 2. Convert to blob
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png", 1.0),
        );

        // 3. Build a unique file path
        const timestamp = Date.now();
        const safeName = (member.name || "unnamed").replace(
          /[^a-zA-Z0-9]/g,
          "_",
        );
        const filePath = `${userId}/${safeName}_${timestamp}.png`;

        // 4. Upload to Supabase Storage (private bucket: "id-cards")
        const { error: uploadError } = await supabase.storage
          .from("id-cards")
          .upload(filePath, blob, {
            contentType: "image/png",
            upsert: false,
          });

        if (uploadError) {
          newResults.push({
            name: member.name,
            success: false,
            error: uploadError.message,
          });
          continue;
        }

        // 5. Insert metadata into generated_ids
        //    expires_at = now + 15 days
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
          newResults.push({
            name: member.name,
            success: false,
            error: insertError.message,
          });
          continue;
        }

        newResults.push({ name: member.name, success: true });
      } catch (err) {
        newResults.push({
          name: member.name,
          success: false,
          error: err.message,
        });
      }
    }

    setResults(newResults);
    setGenerating(false);
    setCurrentMember(null);

    if (onComplete) onComplete(newResults);
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div className="space-y-6">
      {/* ─── Action Bar ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Bulk ID Generator
          </h3>
          <p className="text-sm text-slate-500">
            {members.length} member{members.length !== 1 ? "s" : ""} ready to
            generate
          </p>
        </div>
        <button
          onClick={generateAll}
          disabled={generating || members.length === 0}
          className="px-6 py-2.5 bg-[#1152d4] hover:bg-[#1152d4]/90 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-[#1152d4]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating {progress.current}/{progress.total}
            </>
          ) : (
            <>
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Generate All IDs
            </>
          )}
        </button>
      </div>

      {/* ─── Progress Bar ─── */}
      {generating && (
        <div className="space-y-2">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-[#1152d4] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 text-center">
            Processing: {currentMember?.name || "..."}
          </p>
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
                {successCount} succeeded
              </span>
              {failCount > 0 && (
                <span className="text-red-600 font-semibold">
                  {failCount} failed
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {results.map((r, i) => (
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
                    Uploaded
                  </span>
                ) : (
                  <span className="text-red-500 text-xs">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ─── Off-screen card renderer ─── */}
      <div
        className="fixed -left-full top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div ref={cardRef}>
          <IDCard data={currentMember} />
        </div>
      </div>
    </div>
  );
}
