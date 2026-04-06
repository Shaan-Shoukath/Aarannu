import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * EventsDashboard — List and manage events for an organization.
 * URL: /org/:slug/events
 */
export default function EventsDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formProjectId, setFormProjectId] = useState("");

  const getAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [navigate]);

  const loadData = useCallback(async () => {
    try {
      const headers = await getAuth();
      if (!headers) return;

      const orgRes = await fetch(`${BACKEND}/api/org/slug/${slug}`, { headers });
      const orgJson = await orgRes.json();
      if (!orgRes.ok) { setError(orgJson.error || "Organization not found."); setLoading(false); return; }

      setOrg(orgJson.org);
      setUserRole(orgJson.userRole);

      const eventsRes = await fetch(`${BACKEND}/api/events/org/${orgJson.org.id}`, { headers });
      const eventsJson = await eventsRes.json();
      if (eventsRes.ok) setEvents(eventsJson.events || []);
    } catch {
      setError("Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [slug, getAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const openModal = async () => {
    setShowModal(true);
    if (projects.length === 0 && org) {
      try {
        const headers = await getAuth();
        if (!headers) return;
        const res = await fetch(`${BACKEND}/api/projects/org/${org.id}`, { headers });
        const json = await res.json();
        if (res.ok) setProjects(json.projects || []);
      } catch { /* ignore */ }
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formDate) return;
    setCreating(true);
    try {
      const headers = await getAuth();
      if (!headers) return;
      const res = await fetch(`${BACKEND}/api/events/`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          projectId: formProjectId || null,
          name: formName.trim(),
          description: formDesc.trim(),
          eventDate: formDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to create event."); return; }
      setEvents((prev) => [json.event, ...prev]);
      setShowModal(false);
      setFormName(""); setFormDate(""); setFormDesc(""); setFormProjectId("");
      setSuccess("Event created!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to create event.");
    } finally {
      setCreating(false);
    }
  };

  const handleEndEvent = async (eventId) => {
    try {
      const headers = await getAuth();
      if (!headers) return;
      const res = await fetch(`${BACKEND}/api/events/${eventId}/end`, { method: "PATCH", headers });
      const json = await res.json();
      if (res.ok) {
        setEvents((prev) => prev.map((ev) => ev.id === eventId ? json.event : ev));
      }
    } catch { /* ignore */ }
  };

  const isAdmin = userRole === "admin" || userRole === "owner";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#2563EB] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-900 font-medium mb-2">Something went wrong</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button onClick={() => navigate("/org/new")} className="px-5 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-lg text-sm font-medium transition cursor-pointer shadow-sm">
            Go to My Organizations
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
              <h1 className="text-sm sm:text-lg font-semibold text-slate-900 truncate">{org?.name}</h1>
              <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">/{org?.slug} · {userRole}</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <button onClick={() => navigate(`/org/${slug}/dashboard`)} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer">
              Dashboard
            </button>
            <button onClick={() => navigate("/org/new")} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer hidden sm:block">
              Switch Org
            </button>
            <button onClick={handleSignOut} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
        {success && (
          <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{success}</div>
        )}
        {error && org && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* ── Section header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Events</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {events.filter((e) => e.status === "active").length} active
              &nbsp;·&nbsp;{events.length} total
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openModal}
              className="px-4 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 rounded-lg text-sm font-medium text-white transition cursor-pointer shadow-sm"
            >
              + New Event
            </button>
          )}
        </div>

        {/* ── Event list */}
        {events.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-900 font-medium">No events yet</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Create an event to start scanning QR check-ins.</p>
            {isAdmin && (
              <button onClick={openModal} className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 rounded-lg text-white font-medium transition cursor-pointer shadow-sm">
                + Create First Event
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {events.map((ev) => (
              <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">{ev.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ev.status === "active" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                        {ev.status}
                      </span>
                    </div>
                    {ev.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">{ev.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {ev.event_date ? new Date(ev.event_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/org/${slug}/events/${ev.id}`)}
                      className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm"
                    >
                      Open
                    </button>
                    {isAdmin && ev.status === "active" && (
                      <button
                        onClick={() => handleEndEvent(ev.id)}
                        className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                      >
                        End
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">New Event</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Annual Meetup 2025"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  placeholder="Brief description of the event…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none"
                />
              </div>
              {projects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scope to Project <span className="text-slate-400 font-normal">(optional)</span></label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] bg-white"
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition cursor-pointer shadow-sm"
                >
                  {creating ? "Creating…" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
