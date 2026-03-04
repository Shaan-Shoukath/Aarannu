import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * OrgDashboard — Organization management hub
 * ────────────────────────────────────────────
 * URL: /org/:slug/dashboard
 *
 * Features:
 *  - Org info (name, slug, plan, member count)
 *  - Project list with quick stats
 *  - Create new project button
 *  - Per-project actions: copy form link, view dashboard
 */
export default function OrgDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [orgStats, setOrgStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Auth header helper ────────────────────────────────────
  const getAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [navigate]);

  // ── Load data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const headers = await getAuth();
      if (!headers) return;

      // Fetch org by slug
      const orgRes = await fetch(`${BACKEND}/api/org/slug/${slug}`, { headers });
      const orgJson = await orgRes.json();
      if (!orgRes.ok) {
        setError(orgJson.error || "Organization not found.");
        setLoading(false);
        return;
      }
      setOrg(orgJson.org);
      setUserRole(orgJson.userRole);

      // Fetch stats + projects in parallel
      const [statsRes, projRes] = await Promise.all([
        fetch(`${BACKEND}/api/org/${orgJson.org.id}/stats`, { headers }),
        fetch(`${BACKEND}/api/projects/org/${orgJson.org.id}`, { headers }),
      ]);

      const statsJson = await statsRes.json();
      const projJson = await projRes.json();

      if (statsRes.ok) setOrgStats(statsJson.stats);
      if (projRes.ok) setProjects(projJson.projects || []);
    } catch {
      setError("Failed to load organization data.");
    } finally {
      setLoading(false);
    }
  }, [slug, getAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  const copyFormLink = (projectId) => {
    const link = `${window.location.origin}/register/${projectId}`;
    navigator.clipboard.writeText(link);
    setSuccess("Form link copied!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h1 className="text-xl font-bold text-white mb-2">Organization Not Found</h1>
          <p className="text-slate-400 mb-4">{error}</p>
          <button onClick={() => navigate("/org/new")} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition cursor-pointer">
            Go to My Organizations
          </button>
        </div>
      </div>
    );
  }

  const statusBadge = (status) => {
    const colors = {
      active: "text-emerald-400 bg-emerald-400/10",
      archived: "text-slate-400 bg-slate-400/10",
      completed: "text-indigo-400 bg-indigo-400/10",
    };
    return colors[status] || "text-slate-400 bg-slate-400/10";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 backdrop-blur bg-slate-950/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {org?.logo_url ? (
              <img src={org.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-600" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {org?.name?.charAt(0)?.toUpperCase() || "O"}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">{org?.name}</h1>
              <p className="text-xs text-slate-500">/{org?.slug} · {userRole}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/org/new")} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer">
              Switch Org
            </button>
            <button onClick={handleSignOut} className="px-3 py-1.5 text-xs text-slate-500 hover:text-red-400 transition cursor-pointer">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* ── Messages ─────────────────────────────────────── */}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-green-500/20 border border-green-400/30 text-green-300 text-sm">
            {success}
          </div>
        )}

        {/* ── Stats cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Projects", value: orgStats?.totalProjects || 0, color: "text-indigo-400" },
            { label: "Total Members", value: orgStats?.totalMembers || 0, color: "text-white" },
            { label: "Pending", value: orgStats?.pendingMembers || 0, color: "text-amber-400" },
            { label: "Total Cards", value: orgStats?.totalCards || 0, color: "text-purple-400" },
            { label: "Active Cards", value: orgStats?.activeCards || 0, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Projects section ─────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          {(userRole === "owner" || userRole === "admin") && (
            <button
              onClick={() => navigate(`/org/${slug}/project/new`)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              + New Project
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 border border-slate-700/30 rounded-xl">
            <div className="text-5xl mb-3">📁</div>
            <p className="text-slate-400 font-medium">No projects yet</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Create your first project to generate a registration form link.
            </p>
            {(userRole === "owner" || userRole === "admin") && (
              <button
                onClick={() => navigate(`/org/${slug}/project/new`)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition cursor-pointer"
              >
                + Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-indigo-500/30 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold truncate">{p.name}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(p.status)}`}>
                        {p.status}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/50 text-slate-400">
                        {p.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Template: {p.template}</span>
                      {p.member_limit && <span>Limit: {p.member_limit}</span>}
                      <span>Expiry: {p.expiry_days}d</span>
                      <span>Created: {new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyFormLink(p.id); }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-300 rounded-lg text-xs transition cursor-pointer"
                      title="Copy form link"
                    >
                      🔗 Link
                    </button>
                    <button
                      onClick={() => navigate(`/org/${slug}/project/${p.id}`)}
                      className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      Open →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Back to legacy dashboard link ─────────────────── */}
        <div className="text-center pt-4 border-t border-slate-800/50">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs text-slate-500 hover:text-indigo-400 transition cursor-pointer"
          >
            ← Back to Personal Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
