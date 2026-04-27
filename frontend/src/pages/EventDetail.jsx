import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { utils, writeFileXLSX } from "xlsx";
import { supabase } from "../lib/supabaseClient";
import QRScanner from "../components/QRScanner";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

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
  const [lastScan, setLastScan] = useState(null);
  const [scanning, setScanning] = useState(false);
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
    } catch { setError("Failed to load event."); } finally { setLoading(false); }
  }, [slug, eventId, getAuth, loadCheckins]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const headers = await getAuth();
      if (headers) await loadCheckins(headers);
    }, 10000);
    return () => clearInterval(interval);
  }, [getAuth, loadCheckins]);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/login"); };

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
      if (res.ok) { setCheckins((prev) => [json.checkin, ...prev]); flashScan("success", "Checked in!", json.checkin.member_name); }
      else if (res.status === 409) flashScan("duplicate", "Already checked in", json.error || "");
      else flashScan("error", json.error || "Invalid card", "");
    } catch { flashScan("error", "Network error — try again", ""); } finally { setScanning(false); }
  }, [scanning, getAuth, eventId]);

  const handleUndoCheckin = async (checkinId) => {
    try {
      const headers = await getAuth();
      if (!headers) return;
      const res = await fetch(`${BACKEND}/api/events/${eventId}/checkins/${checkinId}`, { method: "DELETE", headers });
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
    } catch { /* ignore */ } finally { setEnding(false); setConfirmEnd(false); }
  };

  const handleExportCsv = async () => {
    const headers = await getAuth();
    if (!headers) return;
    const res = await fetch(`${BACKEND}/api/events/${eventId}/export?format=csv`, { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${event?.name || "event"}_checkins.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = () => {
    const rows = checkins.map((c) => ({ Name: c.member_name, Email: c.member_email || "", "Check-in Time": c.checked_in_at ? new Date(c.checked_in_at).toLocaleString("en-IN") : "" }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Check-ins");
    writeFileXLSX(wb, `${event?.name || "event"}_checkins.xlsx`);
  };

  const isAdmin = userRole === "admin" || userRole === "owner";
  const isEnded = event?.status === "ended";

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-cyan-300 border-t-transparent rounded-full" />
    </div>
  );

  if (error && !event) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-white font-medium mb-2">Something went wrong</p>
        <p className="text-zinc-400 text-sm mb-4">{error}</p>
        <button onClick={() => navigate(`/org/${slug}/events`)} className="px-5 py-2 bg-cyan-300 hover:bg-white text-black rounded-lg text-sm font-medium">Back to Events</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black font-['Public_Sans',sans-serif] text-white">
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/12">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {org?.logo_url ? (
              <img src={org.logo_url} alt="" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-1 ring-white/20 shrink-0" />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-300 flex items-center justify-center text-black font-bold text-xs sm:text-sm shrink-0">
                {org?.name?.charAt(0)?.toUpperCase() || "O"}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button onClick={() => navigate(`/org/${slug}/events`)} className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-300 transition cursor-pointer">Events</button>
                <span className="text-zinc-700">/</span>
                <h1 className="text-xs sm:text-sm font-semibold text-white max-w-24 sm:max-w-48 truncate">{event?.name}</h1>
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border font-medium ${isEnded ? "text-zinc-400 bg-zinc-800 border-zinc-700" : "text-emerald-400 bg-emerald-900/30 border-emerald-800"}`}>
                  {event?.status}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-500 hidden sm:block">/{org?.slug} · {userRole}</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <button onClick={() => navigate("/org/new")} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer hidden sm:block">Switch Org</button>
            <button onClick={handleSignOut} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-zinc-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition cursor-pointer">Sign Out</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="mb-6">
          <p className="text-sm text-zinc-400">
            {event?.event_date ? new Date(event.event_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
            {event?.description ? ` — ${event.description}` : ""}
          </p>
        </div>

        {isEnded && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-zinc-800/60 border border-white/12 text-zinc-400 text-sm">
            This event has ended. The check-in list is read-only and available for export.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-white/12 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">QR Scanner</h2>
                {!isEnded && (
                  <button
                    onClick={() => setScannerActive((v) => !v)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm ${scannerActive ? "bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50" : "bg-cyan-300 hover:bg-white text-black"}`}
                  >
                    {scannerActive ? "Stop Scanner" : "Start Scanner"}
                  </button>
                )}
              </div>
              {!isEnded && scannerActive ? (
                <QRScanner active={scannerActive} onScan={handleScan} onError={(msg) => flashScan("error", msg, "")} />
              ) : !isEnded ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <p className="text-sm">Press Start Scanner to open camera</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <p className="text-sm">Event has ended — scanning disabled</p>
                </div>
              )}
            </div>

            {lastScan && (
              <div className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                lastScan.type === "success" ? "bg-emerald-900/30 border-emerald-700 text-emerald-400" :
                lastScan.type === "duplicate" ? "bg-amber-900/30 border-amber-700 text-amber-400" :
                "bg-red-900/30 border-red-700 text-red-400"
              }`}>
                <div className="flex items-center gap-2">
                  {lastScan.type === "success" && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                  {lastScan.type === "error" && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                  <span>{lastScan.name && <strong>{lastScan.name} — </strong>}{lastScan.message}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-950 border border-white/12 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white">Check-ins</h2>
                <p className="text-2xl font-bold text-cyan-300 mt-0.5">{checkins.length}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleExportCsv} className="px-3 py-1.5 text-xs border border-white/12 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer">CSV</button>
                <button onClick={handleExportXlsx} className="px-3 py-1.5 text-xs border border-white/12 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer">XLSX</button>
                {isAdmin && !isEnded && (
                  <button onClick={() => setConfirmEnd(true)} className="px-3 py-1.5 text-xs border border-red-800 text-red-400 hover:bg-red-900/30 rounded-lg transition cursor-pointer">End Event</button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2 pr-1">
              {checkins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm">No check-ins yet</p>
                </div>
              ) : (
                checkins.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition group">
                    {c.member_photo_url ? (
                      <img src={c.member_photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-white/20" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-cyan-300/10 flex items-center justify-center text-cyan-300 font-bold text-sm shrink-0">
                        {c.member_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.member_name}</p>
                      <p className="text-xs text-zinc-500 truncate">{c.member_email || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-500">
                        {c.checked_in_at ? new Date(c.checked_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                      </span>
                      {isAdmin && (
                        <button onClick={() => handleUndoCheckin(c.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition cursor-pointer" title="Undo check-in">✕</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-white/12 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">End this event?</h3>
            <p className="text-sm text-zinc-400 mb-6">Scanning will be disabled. The check-in list will remain available for export.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEnd(false)} className="flex-1 px-4 py-2 border border-white/12 rounded-lg text-sm text-zinc-400 hover:bg-white/5 hover:text-white transition cursor-pointer">Cancel</button>
              <button onClick={handleEndEvent} disabled={ending} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition cursor-pointer">{ending ? "Ending…" : "End Event"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
