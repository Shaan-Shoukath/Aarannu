import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { utils, writeFileXLSX } from "xlsx";
import { supabase } from "../lib/supabaseClient";
import QRScanner from "../components/QRScanner";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * EventDetail — QR scanner + live check-in feed for a single event.
 * URL: /org/:slug/events/:eventId
 */
export default function EventDetail() {
  const { slug, eventId } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [event, setEvent] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scannerActive, setScannerActive] = useState(false);
  const [lastScan, setLastScan] = useState(null); // { type: 'success'|'duplicate'|'error', message, name }
  const [scanning, setScanning] = useState(false); // prevent double-submission
  const lastScanTimerRef = useRef(null);

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  const getAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [navigate]);

  const loadCheckins = useCallback(async (headers) => {
    const res = await fetch(`${BACKEND}/api/events/${eventId}/checkins`, { headers });
    const json = await res.json();
    if (res.ok) setCheckins(json.checkins || []);
  }, [eventId]);

  const loadAll = useCallback(async () => {
    try {
      const headers = await getAuth();
      if (!headers) return;

      const [orgRes, eventRes] = await Promise.all([
        fetch(`${BACKEND}/api/org/slug/${slug}`, { headers }),
        fetch(`${BACKEND}/api/events/${eventId}`, { headers }),
      ]);

      const orgJson = await orgRes.json();
      const eventJson = await eventRes.json();

      if (!orgRes.ok) { setError(orgJson.error || "Organization not found."); setLoading(false); return; }
      if (!eventRes.ok) { setError(eventJson.error || "Event not found."); setLoading(false); return; }

      setOrg(orgJson.org);
      setUserRole(orgJson.userRole);
      setEvent(eventJson.event);

      await loadCheckins(headers);
    } catch {
      setError("Failed to load event.");
    } finally {
      setLoading(false);
    }
  }, [slug, eventId, getAuth, loadCheckins]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Poll for check-ins every 10 seconds (handles multi-device scenarios)
  useEffect(() => {
    const interval = setInterval(async () => {
      const headers = await getAuth();
      if (headers) await loadCheckins(headers);
    }, 10000);
    return () => clearInterval(interval);
  }, [getAuth, loadCheckins]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const flashScan = (type, message, name) => {
    if (lastScanTimerRef.current) clearTimeout(lastScanTimerRef.current);
    setLastScan({ type, message, name });
    lastScanTimerRef.current = setTimeout(() => setLastScan(null), 4000);
  };

  const handleScan = useCallback(async (cardId) => {
    if (scanning) return;
    setScanning(true);
    try {
      const headers = await getAuth();
      if (!headers) return;
      const res = await fetch(`${BACKEND}/api/events/${eventId}/checkin`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const json = await res.json();
      if (res.ok) {
        const newCheckin = json.checkin;
        setCheckins((prev) => [newCheckin, ...prev]);
        flashScan("success", "Checked in!", newCheckin.member_name);
      } else if (res.status === 409) {
        flashScan("duplicate", "Already checked in", json.error || "");
      } else {
        flashScan("error", json.error || "Invalid card", "");
      }
    } catch {
      flashScan("error", "Network error — try again", "");
    } finally {
      setScanning(false);
    }
  }, [scanning, getAuth, eventId]);

  const handleUndoCheckin = async (checkinId) => {
    try {
      const headers = await getAuth();
      if (!headers) return;
      const res = await fetch(`${BACKEND}/api/events/${eventId}/checkins/${checkinId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) setCheckins((prev) => prev.filter((c) => c.id !== checkinId));
    } catch { /* ignore */ }
  };

  const handleEndEvent = async () => {
    setEnding(true);
    try {
      const headers = await getAuth();
      if (!headers) return;
      const res = await fetch(`${BACKEND}/api/events/${eventId}/end`, { method: "PATCH", headers });
      const json = await res.json();
      if (res.ok) { setEvent(json.event); setScannerActive(false); }
    } catch { /* ignore */ } finally {
      setEnding(false);
      setConfirmEnd(false);
    }
  };

  const handleExportCsv = async () => {
    const headers = await getAuth();
    if (!headers) return;
    const res = await fetch(`${BACKEND}/api/events/${eventId}/export?format=csv`, { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.name || "event"}_checkins.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = () => {
    const rows = checkins.map((c) => ({
      Name: c.member_name,
      Email: c.member_email || "",
      "Check-in Time": c.checked_in_at
        ? new Date(c.checked_in_at).toLocaleString("en-IN")
        : "",
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Check-ins");
    writeFileXLSX(wb, `${event?.name || "event"}_checkins.xlsx`);
  };

  const isAdmin = userRole === "admin" || userRole === "owner";
  const isEnded = event?.status === "ended";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#2563EB] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-900 font-medium mb-2">Something went wrong</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button onClick={() => navigate(`/org/${slug}/events`)} className="px-5 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] font-['Public_Sans',sans-serif]">
      {/* ── Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {org?.logo_url ? (
              <img src={org.logo_url} alt="" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-1 ring-slate-200 shrink-0" />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                {org?.name?.charAt(0)?.toUpperCase() || "O"}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button onClick={() => navigate(`/org/${slug}/events`)} className="text-xs sm:text-sm text-slate-400 hover:text-slate-700 transition cursor-pointer">
                  Events
                </button>
                <span className="text-slate-300">/</span>
                <h1 className="text-xs sm:text-sm font-semibold text-slate-900 max-w-24 sm:max-w-48 truncate">{event?.name}</h1>
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border font-medium ${isEnded ? "text-slate-500 bg-slate-50 border-slate-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"}`}>
                  {event?.status}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">/{org?.slug} · {userRole}</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <button onClick={() => navigate("/org/new")} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer hidden sm:block">
              Switch Org
            </button>
            <button onClick={handleSignOut} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* ── Event meta */}
        <div className="mb-6">
          <p className="text-sm text-slate-500">
            {event?.event_date
              ? new Date(event.event_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : ""}
            {event?.description ? ` — ${event.description}` : ""}
          </p>
        </div>

        {isEnded && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm">
            This event has ended. The check-in list is read-only and available for export.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Left: Scanner */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">QR Scanner</h2>
                {!isEnded && (
                  <button
                    onClick={() => setScannerActive((v) => !v)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm ${scannerActive ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" : "bg-[#2563EB] hover:bg-[#2563EB]/90 text-white"}`}
                  >
                    {scannerActive ? "Stop Scanner" : "Start Scanner"}
                  </button>
                )}
              </div>

              {!isEnded && scannerActive ? (
                <QRScanner
                  active={scannerActive}
                  onScan={handleScan}
                  onError={(msg) => flashScan("error", msg, "")}
                />
              ) : (
                !isEnded && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <p className="text-sm">Press Start Scanner to open camera</p>
                  </div>
                )
              )}

              {isEnded && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <p className="text-sm">Event has ended — scanning disabled</p>
                </div>
              )}
            </div>

            {/* ── Last scan result flash */}
            {lastScan && (
              <div className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                lastScan.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                lastScan.type === "duplicate" ? "bg-amber-50 border-amber-200 text-amber-800" :
                "bg-red-50 border-red-200 text-red-800"
              }`}>
                <div className="flex items-center gap-2">
                  {lastScan.type === "success" && (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {lastScan.type === "duplicate" && (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  )}
                  {lastScan.type === "error" && (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span>
                    {lastScan.name && <strong>{lastScan.name} — </strong>}
                    {lastScan.message}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Check-in feed */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900">Check-ins</h2>
                <p className="text-2xl font-bold text-[#2563EB] mt-0.5">{checkins.length}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                >
                  CSV
                </button>
                <button
                  onClick={handleExportXlsx}
                  className="px-3 py-1.5 text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                >
                  XLSX
                </button>
                {isAdmin && !isEnded && (
                  <button
                    onClick={() => setConfirmEnd(true)}
                    className="px-3 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                  >
                    End Event
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2 pr-1">
              {checkins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm">No check-ins yet</p>
                </div>
              ) : (
                checkins.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition group">
                    {c.member_photo_url ? (
                      <img src={c.member_photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB] font-bold text-sm shrink-0">
                        {c.member_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.member_name}</p>
                      <p className="text-xs text-slate-400 truncate">{c.member_email || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">
                        {c.checked_in_at
                          ? new Date(c.checked_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                          : "—"}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleUndoCheckin(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition cursor-pointer"
                          title="Undo check-in"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── End Event confirmation dialog */}
      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">End this event?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Scanning will be disabled. The check-in list will remain available for export.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEnd(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition cursor-pointer">
                Cancel
              </button>
              <button onClick={handleEndEvent} disabled={ending} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition cursor-pointer">
                {ending ? "Ending…" : "End Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
