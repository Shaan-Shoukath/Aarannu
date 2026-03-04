import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * ProjectDashboard — Admin view for a single project
 * ───────────────────────────────────────────────────
 * URL: /org/:slug/project/:projectId
 *
 * Features:
 *  - Copy shareable registration link
 *  - View project stats (pending / approved / rejected / total)
 *  - Member table with approve / reject / delete actions
 *  - Bulk approve all pending members
 *  - Export CSV download
 *  - Renewal flow: continue existing members or fresh reset
 */
export default function ProjectDashboard() {
  const { slug, projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewMode, setRenewMode] = useState("continue");
  const [renewing, setRenewing] = useState(false);

  // ── Auth header helper ────────────────────────────────────
  const getAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [navigate]);

  // ── Load project data ─────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const headers = await getAuth();
      if (!headers) return;

      const [projRes, statsRes, membersRes] = await Promise.all([
        fetch(`${BACKEND}/api/projects/${projectId}`, { headers }),
        fetch(`${BACKEND}/api/projects/${projectId}/stats`, { headers }),
        fetch(`${BACKEND}/api/members/${projectId}${filter !== "all" ? `?status=${filter}` : ""}`, { headers }),
      ]);

      const projJson = await projRes.json();
      const statsJson = await statsRes.json();
      const membersJson = await membersRes.json();

      if (projRes.ok) setProject(projJson.project);
      if (statsRes.ok) setStats(statsJson.stats);
      if (membersRes.ok) setMembers(membersJson.members || []);
    } catch {
      setError("Failed to load project data.");
    } finally {
      setLoading(false);
    }
  }, [projectId, filter, getAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ───────────────────────────────────────────────
  const approveMember = async (id) => {
    const headers = await getAuth();
    if (!headers) return;
    const res = await fetch(`${BACKEND}/api/members/${id}/approve`, {
      method: "PATCH", headers,
    });
    if (res.ok) {
      setSuccess("Member approved — email notification sent.");
      loadData();
    }
  };

  const rejectMember = async (id) => {
    const headers = await getAuth();
    if (!headers) return;
    await fetch(`${BACKEND}/api/members/${id}/reject`, { method: "PATCH", headers });
    loadData();
  };

  const deleteMember = async (id) => {
    if (!confirm("Remove this member permanently?")) return;
    const headers = await getAuth();
    if (!headers) return;
    await fetch(`${BACKEND}/api/members/${id}`, { method: "DELETE", headers });
    loadData();
  };

  const bulkApproveAll = async () => {
    const pending = members.filter((m) => m.status === "pending");
    if (pending.length === 0) return;
    const ids = selected.size > 0 ? [...selected] : pending.map((m) => m.id);
    const headers = await getAuth();
    if (!headers) return;
    const res = await fetch(`${BACKEND}/api/members/bulk-approve`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: ids }),
    });
    if (res.ok) {
      setSuccess(`${ids.length} members approved — notification emails sent.`);
      setSelected(new Set());
      loadData();
    }
  };

  const handleExportCsv = async () => {
    const headers = await getAuth();
    if (!headers) return;
    const res = await fetch(`${BACKEND}/api/projects/${projectId}/export-csv`, { headers });
    if (!res.ok) { setError("CSV export failed."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name || "members"}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess("CSV downloaded!");
  };

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const headers = await getAuth();
      if (!headers) return;
      const res = await fetch(`${BACKEND}/api/projects/${projectId}/renew`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: renewMode }),
      });
      const json = await res.json();
      if (res.ok) {
        setSuccess(json.message);
        setShowRenewModal(false);
        loadData();
      } else {
        setError(json.error || "Renewal failed.");
      }
    } catch {
      setError("Network error during renewal.");
    } finally {
      setRenewing(false);
    }
  };

  const copyFormLink = () => {
    const link = `${window.location.origin}/register/${projectId}`;
    navigator.clipboard.writeText(link);
    setSuccess("Form link copied to clipboard!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingCount = stats?.pending || 0;
  const statusColors = {
    pending: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    approved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    rejected: "text-red-400 bg-red-400/10 border-red-400/30",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 backdrop-blur bg-slate-950/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate(`/org/${slug}/dashboard`)}
            className="text-sm text-indigo-300 hover:text-white transition cursor-pointer"
          >
            ← {slug}
          </button>
          <h1 className="text-lg font-bold truncate max-w-xs">
            {project?.name || "Project"}
          </h1>
          <div className="flex gap-2">
            <button onClick={copyFormLink} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium transition cursor-pointer">
              🔗 Copy Form Link
            </button>
            <button onClick={handleExportCsv} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition cursor-pointer">
              📥 CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* ── Messages ─────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm">
            {error}
            <button onClick={() => setError("")} className="float-right text-red-400 hover:text-red-200 cursor-pointer">✕</button>
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-green-500/20 border border-green-400/30 text-green-300 text-sm">
            {success}
            <button onClick={() => setSuccess("")} className="float-right text-green-400 hover:text-green-200 cursor-pointer">✕</button>
          </div>
        )}

        {/* ── Stats cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats?.totalMembers || 0, color: "text-white" },
            { label: "Pending", value: pendingCount, color: "text-amber-400" },
            { label: "Approved", value: stats?.approved || 0, color: "text-emerald-400" },
            { label: "Rejected", value: stats?.rejected || 0, color: "text-red-400" },
            { label: "Cards", value: stats?.cardsGenerated || 0, color: "text-indigo-400" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Shareable link ───────────────────────────────── */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-1">Public Registration Link</p>
              <code className="block text-sm text-indigo-300 truncate">
                {window.location.origin}/register/{projectId}
              </code>
            </div>
            <button onClick={copyFormLink} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition cursor-pointer shrink-0">
              Copy
            </button>
          </div>
        </div>

        {/* ── Controls row ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter */}
          <div className="flex gap-1 bg-slate-800/40 rounded-lg p-1">
            {["all", "pending", "approved", "rejected"].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelected(new Set()); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  filter === f ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Bulk approve */}
          {pendingCount > 0 && (
            <button
              onClick={bulkApproveAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              ✓ Approve {selected.size > 0 ? `(${selected.size})` : `All (${pendingCount})`}
            </button>
          )}

          {/* Renew */}
          <button
            onClick={() => setShowRenewModal(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            🔄 Renew Project
          </button>
        </div>

        {/* ── Members table ────────────────────────────────── */}
        {members.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium">No members yet</p>
            <p className="text-sm mt-1">Share the registration link to start receiving submissions.</p>
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/40 text-slate-400 text-xs">
                    <th className="text-left px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected(new Set(members.filter(m => m.status === "pending").map(m => m.id)));
                          } else {
                            setSelected(new Set());
                          }
                        }}
                        checked={selected.size > 0 && selected.size === members.filter(m => m.status === "pending").length}
                        className="accent-indigo-500"
                      />
                    </th>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Submitted</th>
                    <th className="text-left px-4 py-3">Custom Fields</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-slate-700/20 hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        {m.status === "pending" && (
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                            className="accent-indigo-500"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{m.name}</td>
                      <td className="px-4 py-3 text-slate-400">{m.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[m.status] || "text-slate-400"}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                        {m.custom_fields && Object.keys(m.custom_fields).length > 0
                          ? Object.entries(m.custom_fields).map(([k, v]) => `${k}: ${v}`).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {m.status === "pending" && (
                            <>
                              <button onClick={() => approveMember(m.id)} className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded text-xs transition cursor-pointer">
                                Approve
                              </button>
                              <button onClick={() => rejectMember(m.id)} className="px-2.5 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded text-xs transition cursor-pointer">
                                Reject
                              </button>
                            </>
                          )}
                          <button onClick={() => deleteMember(m.id)} className="px-2.5 py-1 bg-white/5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 rounded text-xs transition cursor-pointer">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Renew Modal ──────────────────────────────────────── */}
      {showRenewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">Renew Project</h2>
            <p className="text-sm text-slate-400">
              Choose how to handle existing members when renewing this project
              for a new subscription period.
            </p>

            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  renewMode === "continue"
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="renewMode"
                  value="continue"
                  checked={renewMode === "continue"}
                  onChange={() => setRenewMode("continue")}
                  className="accent-indigo-500 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-white">Continue from last point</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Keep all existing members. New registrations will be added
                    alongside previous ones. The form link stays the same.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  renewMode === "reset"
                    ? "border-red-500 bg-red-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="renewMode"
                  value="reset"
                  checked={renewMode === "reset"}
                  onChange={() => setRenewMode("reset")}
                  className="accent-red-500 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-white">Fresh start (reset all)</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    All existing members will be removed. The project starts
                    clean with no data. Download CSV first if you need the data!
                  </p>
                </div>
              </label>
            </div>

            {renewMode === "reset" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-xs text-red-400">
                  ⚠ This will permanently delete all member data for this project.
                  Make sure you&apos;ve exported the CSV before proceeding.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRenew}
                disabled={renewing}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  renewMode === "reset"
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                } disabled:opacity-50`}
              >
                {renewing ? "Processing..." : renewMode === "continue" ? "Renew & Continue" : "Reset & Renew"}
              </button>
              <button
                onClick={() => setShowRenewModal(false)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
