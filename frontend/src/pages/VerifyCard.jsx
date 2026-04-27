import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";

const BACKEND =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

/**
 * VerifyCard — Public QR Verification Page (pitch-black theme)
 * ─────────────────────────────────────────────────────────────
 * Reached when someone scans the QR code on a generated ID card.
 * Calls GET /api/verify/:cardId (no auth required).
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
        if (!res.ok) { setError(json.error || "Card not found."); return; }
        setData(json);
      } catch {
        setError("Unable to verify card. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [cardId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-['Public_Sans',sans-serif]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-300/20 border-t-cyan-300 animate-spin" />
          <p className="text-zinc-400 text-sm">Verifying card…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-['Public_Sans',sans-serif] p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-900/30 border border-red-700 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Verification Failed</h1>
          <p className="text-zinc-400">{error}</p>
          <p className="text-xs text-zinc-600 font-mono">Card ID: {cardId}</p>
        </div>
      </div>
    );
  }

  const isValid = data?.valid;
  const isExpired = data?.expired;
  const isRevoked = data?.status === "revoked";

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-black font-['Public_Sans',sans-serif] p-4 sm:p-6 flex items-center justify-center">
      <div className="max-w-md w-full space-y-5 sm:space-y-6">
        {/* ── Status badge */}
        <div className="text-center space-y-4">
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${isValid ? "bg-emerald-900/30 border-2 border-emerald-600" : "bg-red-900/30 border-2 border-red-700"}`}>
            {isValid ? (
              <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isValid ? "text-emerald-400" : "text-red-400"}`}>
              {isValid ? "VERIFIED" : isExpired ? "EXPIRED" : isRevoked ? "REVOKED" : "INVALID"}
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
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

        {/* ── Card details */}
        <div className="bg-zinc-950 rounded-2xl border border-white/12 overflow-hidden">
          {/* Organization header */}
          {data?.organization?.name && (
            <div className="bg-zinc-900 border-b border-white/12 px-6 py-4 flex items-center gap-3">
              {data.organization.logo_url ? (
                <img src={data.organization.logo_url} alt={data.organization.name} className="w-10 h-10 rounded-lg object-cover border border-white/20" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-cyan-300 flex items-center justify-center text-black font-bold">
                  {data.organization.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white">{data.organization.name}</p>
                {data.project?.name && (
                  <p className="text-xs text-zinc-400">{data.project.name}</p>
                )}
              </div>
            </div>
          )}

          {/* Member info */}
          <div className="px-6 py-5 space-y-4">
            {/* Photo + name */}
            <div className="flex items-center gap-4">
              {data?.member?.photo_url ? (
                <img src={data.member.photo_url} alt={data.member.name} className="w-16 h-16 rounded-xl object-cover border-2 border-white/20" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-white">{data?.member?.name || "Unknown"}</h2>
                {data?.member?.email && (
                  <p className="text-sm text-zinc-400">{data.member.email}</p>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center py-2 border-b border-white/8">
                <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wide">Status</span>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${isValid ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700" : "bg-red-900/40 text-red-400 border border-red-700"}`}>
                  {data?.status?.toUpperCase() || "UNKNOWN"}
                </span>
              </div>

              {data?.project?.type && (
                <div className="flex justify-between items-center py-2 border-b border-white/8">
                  <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wide">Type</span>
                  <span className="text-sm font-medium text-zinc-300">
                    {data.project.type.charAt(0).toUpperCase() + data.project.type.slice(1)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-2 border-b border-white/8">
                <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wide">Issued</span>
                <span className="text-sm font-medium text-zinc-300">{formatDate(data?.issued_at)}</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wide">Expires</span>
                <span className={`text-sm font-medium ${isExpired ? "text-red-400" : "text-zinc-300"}`}>
                  {formatDate(data?.expires_at)}
                </span>
              </div>
            </div>

            {/* Custom fields */}
            {data?.member?.custom_fields && Object.keys(data.member.custom_fields).length > 0 && (
              <div className="pt-3 border-t border-white/8 space-y-2">
                <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wide">Additional Info</p>
                {Object.entries(data.member.custom_fields).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-1">
                    <span className="text-xs text-zinc-500">{key}</span>
                    <span className="text-sm font-medium text-zinc-300">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer */}
        <div className="text-center space-y-2">
          <p className="text-[10px] text-zinc-600 font-mono">Card ID: {cardId}</p>
          <Link to="/" className="inline-flex items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
            <span className="inline-flex shrink-0 overflow-hidden rounded-[22%]" style={{ lineHeight: 0 }}>
              <img src="/aarannu.png" alt="" className="h-4 w-auto" />
            </span>
            <span className="text-[10px] font-medium">Verified by Aarannu</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
