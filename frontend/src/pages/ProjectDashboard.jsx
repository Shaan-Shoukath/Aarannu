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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return null;
    }
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
        fetch(
          `${BACKEND}/api/members/${projectId}${filter !== "all" ? `?status=${filter}` : ""}`,
          { headers },
        ),
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Actions ───────────────────────────────────────────────
  const approveMember = async (id) => {
    const headers = await getAuth();
    if (!headers) return;
    const res = await fetch(`${BACKEND}/api/members/${id}/approve`, {
      method: "PATCH",
      headers,
    });
    if (res.ok) {
      setSuccess("Member approved — email notification sent.");
      loadData();
    }
  };

  const rejectMember = async (id) => {
    const headers = await getAuth();
    if (!headers) return;
    await fetch(`${BACKEND}/api/members/${id}/reject`, {
      method: "PATCH",
      headers,
    });
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
    const res = await fetch(`${BACKEND}/api/projects/${projectId}/export-csv`, {
      headers,
    });
    if (!res.ok) {
      setError("CSV export failed.");
      return;
    }
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
      <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#2563EB] border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingCount = stats?.pending || 0;
  const statusColors = {
    pending: "text-amber-600 bg-amber-50 border-amber-200",
    approved: "text-emerald-600 bg-emerald-50 border-emerald-200",
    rejected: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900 font-['Public_Sans',sans-serif]">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => navigate(`/org/${slug}/dashboard`)}
              className="text-[#2563EB] hover:underline transition cursor-pointer font-medium"
            >
              {slug}
            </button>
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="font-bold text-slate-900 truncate max-w-xs">
              {project?.name || "Project"}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copyFormLink}
              className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm"
            >
              Copy Form Link
            </button>
            <button
              onClick={() => navigate(`/org/${slug}/bulk/${projectId}`)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm"
            >
              Bulk Import
            </button>
            <button
              onClick={() => {
                const approvedMembers = members.filter(
                  (m) => m.status === "approved",
                );
                navigate("/generate", {
                  state: {
                    fromProject: true,
                    projectId,
                    slug,
                    orgName: project?.org_name || slug,
                    members: approvedMembers.map((m) => ({
                      name: m.name,
                      email: m.email || "",
                      photo: m.photo_url || "",
                      ...m.custom_fields,
                    })),
                  },
                });
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm"
            >
              Generate Cards
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              CSV Export
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* ── Messages ─────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError("")}
              className="float-right text-red-400 hover:text-red-600 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            {success}
            <button
              onClick={() => setSuccess("")}
              className="float-right text-emerald-400 hover:text-emerald-600 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Stats cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            {
              label: "Total",
              value: stats?.totalMembers || 0,
              color: "text-slate-900",
              bg: "bg-white",
              iconBg: "bg-slate-100",
              iconColor: "text-slate-600",
            },
            {
              label: "Pending",
              value: pendingCount,
              color: "text-amber-600",
              bg: "bg-white",
              iconBg: "bg-amber-50",
              iconColor: "text-amber-500",
            },
            {
              label: "Approved",
              value: stats?.approved || 0,
              color: "text-emerald-600",
              bg: "bg-white",
              iconBg: "bg-emerald-50",
              iconColor: "text-emerald-500",
            },
            {
              label: "Rejected",
              value: stats?.rejected || 0,
              color: "text-red-600",
              bg: "bg-white",
              iconBg: "bg-red-50",
              iconColor: "text-red-500",
            },
            {
              label: "Cards",
              value: stats?.cardsGenerated || 0,
              color: "text-[#2563EB]",
              bg: "bg-white",
              iconBg: "bg-[#2563EB]/10",
              iconColor: "text-[#2563EB]",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} border border-slate-200 rounded-xl p-5`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 ${s.iconBg} rounded-lg flex items-center justify-center`}
                >
                  <span className={`text-lg font-bold ${s.iconColor}`}>#</span>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Shareable link ───────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 mb-1 font-medium">
                Public Registration Link
              </p>
              <code className="block text-sm text-[#2563EB] truncate font-mono bg-[#2563EB]/5 px-3 py-1.5 rounded-lg">
                {window.location.origin}/register/{projectId}
              </code>
            </div>
            <button
              onClick={copyFormLink}
              className="px-4 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-lg text-sm font-medium transition cursor-pointer shrink-0 shadow-sm"
            >
              Copy
            </button>
          </div>
        </div>

        {/* ── Controls row ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter */}
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {["all", "pending", "approved", "rejected"].map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setSelected(new Set());
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  filter === f
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
            >
              ✓ Approve{" "}
              {selected.size > 0
                ? `(${selected.size})`
                : `All (${pendingCount})`}
            </button>
          )}

          {/* Renew */}
          <button
            onClick={() => setShowRenewModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Renew Project
          </button>
        </div>

        {/* ── Members table ────────────────────────────────── */}
        {members.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="font-medium text-slate-600">No members yet</p>
            <p className="text-sm mt-1 text-slate-400">
              Share the registration link to start receiving submissions.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs bg-slate-50/50">
                    <th className="text-left px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected(
                              new Set(
                                members
                                  .filter((m) => m.status === "pending")
                                  .map((m) => m.id),
                              ),
                            );
                          } else {
                            setSelected(new Set());
                          }
                        }}
                        checked={
                          selected.size > 0 &&
                          selected.size ===
                            members.filter((m) => m.status === "pending").length
                        }
                        className="accent-[#2563EB] rounded"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">
                      Submitted
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">
                      Custom Fields
                    </th>
                    <th className="text-right px-4 py-3 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition"
                    >
                      <td className="px-4 py-3">
                        {m.status === "pending" && (
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                            className="accent-[#2563EB] rounded"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {m.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {m.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[m.status] || "text-slate-400 bg-slate-50 border-slate-200"}`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-50 truncate">
                        {m.custom_fields &&
                        Object.keys(m.custom_fields).length > 0
                          ? Object.entries(m.custom_fields)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {m.status === "pending" && (
                            <>
                              <button
                                onClick={() => approveMember(m.id)}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-md text-xs font-medium transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => rejectMember(m.id)}
                                className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md text-xs font-medium transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => deleteMember(m.id)}
                            className="px-2.5 py-1 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-md text-xs font-medium transition cursor-pointer"
                          >
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
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Renew Project</h2>
            <p className="text-sm text-slate-500">
              Choose how to handle existing members when renewing this project
              for a new subscription period.
            </p>

            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  renewMode === "continue"
                    ? "border-[#2563EB] bg-[#2563EB]/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="renewMode"
                  value="continue"
                  checked={renewMode === "continue"}
                  onChange={() => setRenewMode("continue")}
                  className="accent-[#2563EB] mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Continue from last point
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Keep all existing members. New registrations will be added
                    alongside previous ones. The form link stays the same.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  renewMode === "reset"
                    ? "border-red-500 bg-red-50"
                    : "border-slate-200 hover:border-slate-300"
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
                  <p className="text-sm font-medium text-slate-900">
                    Fresh start (reset all)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All existing members will be removed. The project starts
                    clean with no data. Download CSV first if you need the data!
                  </p>
                </div>
              </label>
            </div>

            {renewMode === "reset" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-600">
                  ⚠ This will permanently delete all member data for this
                  project. Make sure you&apos;ve exported the CSV before
                  proceeding.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRenew}
                disabled={renewing}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm ${
                  renewMode === "reset"
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-[#2563EB] hover:bg-[#2563EB]/90 text-white"
                } disabled:opacity-50`}
              >
                {renewing
                  ? "Processing..."
                  : renewMode === "continue"
                    ? "Renew & Continue"
                    : "Reset & Renew"}
              </button>
              <button
                onClick={() => setShowRenewModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition cursor-pointer"
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
