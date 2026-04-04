import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";

const BACKEND =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

/**
 * VerifyCard — Public QR Verification Page
 * ─────────────────────────────────────────
 * Reached when someone scans the QR code on a generated ID card.
 * Calls GET /api/verify/:cardId (no auth required) and displays
 * the card's validity, member details, and org info.
 *
 * States:
 *   loading → fetching verification data from backend
 *   valid   → card is active and not expired
 *   invalid → card is expired, revoked, or not found
 *   error   → network / server error
 */
export default function VerifyCard() {
  const { cardId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/verify/${cardId}`);
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Card not found.");
          return;
        }

        setData(json);
      } catch {
        setError("Unable to verify card. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [cardId]);

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center font-['Public_Sans',sans-serif]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-[#2563EB]/20 border-t-[#2563EB] animate-spin" />
          <p className="text-slate-500 text-sm">Verifying card…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center font-['Public_Sans',sans-serif] p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Verification Failed</h1>
          <p className="text-slate-500">{error}</p>
          <p className="text-xs text-slate-400">Card ID: {cardId}</p>
        </div>
      </div>
    );
  }

  const isValid = data?.valid;
  const isExpired = data?.expired;
  const isRevoked = data?.status === "revoked";

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-['Public_Sans',sans-serif] p-6 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        {/* ── Status badge ──────────────────────────────── */}
        <div className="text-center space-y-4">
          <div
            className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
              isValid
                ? "bg-emerald-100"
                : "bg-red-100"
            }`}
          >
            {isValid ? (
              <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isValid ? "text-emerald-700" : "text-red-600"}`}>
              {isValid ? "VERIFIED" : isExpired ? "EXPIRED" : isRevoked ? "REVOKED" : "INVALID"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {isValid
                ? "This ID card is valid and active."
                : isExpired
                  ? "This ID card has passed its expiry date."
                  : isRevoked
                    ? "This ID card has been revoked by the administrator."
                    : "This ID card is no longer valid."}
            </p>
          </div>
        </div>

        {/* ── Card details ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Organization header */}
          {data?.organization?.name && (
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
              {data.organization.logo_url ? (
                <img
                  src={data.organization.logo_url}
                  alt={data.organization.name}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold">
                  {data.organization.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-slate-900">{data.organization.name}</p>
                {data.project?.name && (
                  <p className="text-xs text-slate-500">{data.project.name}</p>
                )}
              </div>
            </div>
          )}

          {/* Member info */}
          <div className="px-6 py-5 space-y-4">
            {/* Photo + name */}
            <div className="flex items-center gap-4">
              {data?.member?.photo_url ? (
                <img
                  src={data.member.photo_url}
                  alt={data.member.name}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {data?.member?.name || "Unknown"}
                </h2>
                {data?.member?.email && (
                  <p className="text-sm text-slate-500">{data.member.email}</p>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Status</span>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  isValid
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600"
                }`}>
                  {data?.status?.toUpperCase() || "UNKNOWN"}
                </span>
              </div>

              {data?.project?.type && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Type</span>
                  <span className="text-sm font-medium text-slate-700">
                    {data.project.type.charAt(0).toUpperCase() + data.project.type.slice(1)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Issued</span>
                <span className="text-sm font-medium text-slate-700">{formatDate(data?.issued_at)}</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Expires</span>
                <span className={`text-sm font-medium ${isExpired ? "text-red-600" : "text-slate-700"}`}>
                  {formatDate(data?.expires_at)}
                </span>
              </div>
            </div>

            {/* Custom fields */}
            {data?.member?.custom_fields && Object.keys(data.member.custom_fields).length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Additional Info</p>
                {Object.entries(data.member.custom_fields).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-1">
                    <span className="text-xs text-slate-500">{key}</span>
                    <span className="text-sm font-medium text-slate-700">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <p className="text-[10px] text-slate-400 font-mono">Card ID: {cardId}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <img src="/aarannu.png" alt="" className="h-4 w-auto" />
            <span className="text-[10px] font-medium">Verified by Aarannu</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
