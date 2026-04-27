import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BrandLogoLink from "../components/BrandLogoLink";

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

  const loadData = useCallback(async () => {
    try {
      const headers = await getAuth();
      if (!headers) return;
      const orgRes = await fetch(`${BACKEND}/api/org/slug/${slug}`, {
        headers,
      });
      const orgJson = await orgRes.json();
      if (!orgRes.ok) {
        setError(orgJson.error || "Organization not found.");
        setLoading(false);
        return;
      }
      setOrg(orgJson.org);
      setUserRole(orgJson.userRole);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-300 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            Organization Not Found
          </h1>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button
            onClick={() => navigate("/org/new")}
            className="px-5 py-2 bg-cyan-300 hover:bg-white text-black rounded-lg text-sm font-medium transition cursor-pointer shadow-sm"
          >
            Go to My Organizations
          </button>
        </div>
      </div>
    );
  }

  const statusBadge = (status) => {
    const colors = {
      active: "text-emerald-400 bg-emerald-900/30 border-emerald-800",
      archived: "text-zinc-400 bg-zinc-800 border-zinc-700",
      completed: "text-blue-400 bg-blue-900/30 border-blue-800",
    };
    return colors[status] || "text-zinc-400 bg-zinc-800 border-zinc-700";
  };

  return (
    <div className="min-h-screen bg-black font-['Public_Sans',sans-serif] text-white">
      {/* ── Header */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/12">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <BrandLogoLink
              className="shrink-0"
              imageClassName="h-8 sm:h-9 w-auto"
              showText={false}
            />
            <div className="w-px h-8 bg-white/12 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-semibold text-white truncate">
                {org?.name}
              </h1>
              <p className="text-[10px] sm:text-xs text-zinc-500 truncate">
                /{org?.slug} · {userRole}
              </p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => navigate(`/org/${slug}/events`)}
              className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer"
            >
              Events
            </button>
            <button
              onClick={() => navigate("/org/new")}
              className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer hidden sm:block"
            >
              Switch Org
            </button>
            <button
              onClick={handleSignOut}
              className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs text-zinc-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
        {success && (
          <div className="px-4 py-3 rounded-xl bg-emerald-900/30 border border-emerald-700 text-emerald-400 text-sm">
            {success}
          </div>
        )}

        {/* ── Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {[
            {
              label: "Projects",
              value: orgStats?.totalProjects || 0,
              color: "text-cyan-300 bg-cyan-300/10",
            },
            {
              label: "Total Members",
              value: orgStats?.totalMembers || 0,
              color: "text-zinc-300 bg-zinc-800",
            },
            {
              label: "Pending",
              value: orgStats?.pendingMembers || 0,
              color: "text-amber-400 bg-amber-900/20",
            },
            {
              label: "Total Cards",
              value: orgStats?.totalCards || 0,
              color: "text-violet-400 bg-violet-900/20",
            },
            {
              label: "Active Cards",
              value: orgStats?.activeCards || 0,
              color: "text-emerald-400 bg-emerald-900/20",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-zinc-950 border border-white/12 rounded-xl p-3 sm:p-5 hover:shadow-md transition-shadow"
            >
              <div
                className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${s.color} mb-2 sm:mb-3`}
              >
                <span className="text-sm sm:text-lg font-bold">{s.value}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] sm:text-xs text-zinc-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Projects section */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          {(userRole === "owner" || userRole === "admin") && (
            <button
              onClick={() => navigate(`/org/${slug}/project/new`)}
              className="px-4 py-2 bg-cyan-300 hover:bg-white text-black rounded-lg text-sm font-medium text-white transition cursor-pointer shadow-sm"
            >
              + New Project
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 bg-zinc-950 border border-white/12 rounded-xl">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <p className="text-white font-medium">No projects yet</p>
            <p className="text-sm text-zinc-400 mt-1 mb-4">
              Create your first project to generate a registration form link.
            </p>
            {(userRole === "owner" || userRole === "admin") && (
              <button
                onClick={() => navigate(`/org/${slug}/project/new`)}
                className="px-6 py-2.5 bg-cyan-300 hover:bg-white text-black rounded-lg text-white font-medium transition cursor-pointer shadow-sm"
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
                className="bg-zinc-950 border border-white/12 rounded-xl p-4 sm:p-5 hover:border-cyan-300/30 hover:shadow-md transition group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-sm sm:text-base text-white font-semibold truncate">
                        {p.name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge(p.status)}`}
                      >
                        {p.status}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-zinc-400 border border-white/12">
                        {p.type}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-zinc-400">
                      <span>Template: {p.template}</span>
                      {p.member_limit && <span>Limit: {p.member_limit}</span>}
                      <span>Expiry: {p.expiry_days}d</span>
                      <span>
                        Created: {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyFormLink(p.id);
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-cyan-300/10 text-zinc-400 hover:text-cyan-300 border border-white/12 rounded-lg text-xs transition cursor-pointer flex-1 sm:flex-none"
                      title="Copy form link"
                    >
                      Link
                    </button>
                    <button
                      onClick={() => navigate(`/org/${slug}/project/${p.id}`)}
                      className="px-3 py-1.5 bg-cyan-300 hover:bg-white text-black rounded-lg text-xs font-medium text-white transition cursor-pointer shadow-sm flex-1 sm:flex-none"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center pt-4 border-t border-white/8">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs text-zinc-500 hover:text-cyan-300 transition cursor-pointer"
          >
            ← Back to Personal Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
