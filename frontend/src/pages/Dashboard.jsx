import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Dashboard — Unified Home
 * ────────────────────────
 * Two clear pathways:
 *   1. Organization Manager (SaaS) — orgs, projects, forms, approve, bulk generate
 *   2. Quick Generate (legacy)     — pick template, enter data, generate
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [orgs, setOrgs] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) return;

      const { data: { session } } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token}` };

      // Fetch token balance
      try {
        const tokenRes = await fetch(`${API}/api/tokens/balance`, { headers });
        if (tokenRes.ok) {
          const d = await tokenRes.json();
          setTokenBalance(d.is_unlimited ? "∞" : d.balance);
          setIsUnlimited(d.is_unlimited);
        }
      } catch (e) { console.warn("Token fetch:", e.message); }

      // Fetch user's organizations
      try {
        const orgRes = await fetch(`${API}/api/org/my`, { headers });
        if (orgRes.ok) {
          const d = await orgRes.json();
          setOrgs(d.organizations || []);
        }
      } catch (e) { console.warn("Org fetch:", e.message); }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-['Inter',sans-serif]">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 backdrop-blur bg-slate-950/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/30">
              A
            </div>
            <h1 className="font-bold text-lg">
              Aarannu
              <span className="text-slate-500 font-normal text-sm ml-2">Home</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Token Badge */}
            <button
              onClick={() => navigate("/tokens")}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg text-amber-300 text-sm font-medium transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isUnlimited ? "∞ Unlimited" : tokenBalance !== null ? tokenBalance : "—"}
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* ─── Welcome ─── */}
        <div>
          <h2 className="text-2xl font-bold">
            Welcome back{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ""}
          </h2>
          <p className="text-slate-400 mt-1">Choose how you want to create ID cards.</p>
        </div>

        {/* ─── Two Pathways ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ═══ PATHWAY 1: Organization Manager ═══ */}
          <div
            onClick={() => navigate("/org/new")}
            className="group relative bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50 hover:border-indigo-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 overflow-hidden"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-linear-to-br from-indigo-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative space-y-4">
              {/* Icon */}
              <div className="w-14 h-14 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Organization Manager
                </h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Create organizations & projects. Share a registration form link — members fill it out, you approve them, and generate cards in bulk.
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2">
                {["Registration Forms", "Approve & Reject", "Bulk Generate", "Email Delivery", "Google Sheets Import"].map((f) => (
                  <span key={f} className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-300">
                    {f}
                  </span>
                ))}
              </div>

              {/* Existing orgs count */}
              {orgs.length > 0 && (
                <p className="text-xs text-indigo-400 font-medium">
                  {orgs.length} organization{orgs.length !== 1 ? "s" : ""} active →
                </p>
              )}
            </div>

            {/* Arrow */}
            <div className="absolute top-8 right-8 text-slate-600 group-hover:text-indigo-400 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>

          {/* ═══ PATHWAY 2: Quick Generate ═══ */}
          <div
            onClick={() => navigate("/templates")}
            className="group relative bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50 hover:border-emerald-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-linear-to-br from-emerald-600/5 to-teal-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative space-y-4">
              <div className="w-14 h-14 bg-linear-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Quick Generate
                </h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Pick a card template, enter member data manually or import from Google Sheets, preview and generate cards instantly.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["4 Templates", "Manual Entry", "Google Sheets", "PDF / ZIP / PNG", "Live Preview"].map((f) => (
                  <span key={f} className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="absolute top-8 right-8 text-slate-600 group-hover:text-emerald-400 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
        </div>

        {/* ─── Quick Links ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate("/tokens")}
            className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-amber-500/30 rounded-xl p-4 text-left transition-all cursor-pointer group"
          >
            <div className="text-2xl mb-2">{"\uD83D\uDCB0"}</div>
            <p className="text-lg font-bold text-white">{isUnlimited ? "\u221E" : (tokenBalance ?? "\u2014")}</p>
            <p className="text-xs text-slate-500 group-hover:text-slate-400">Token Balance</p>
          </button>
          <button
            onClick={() => navigate("/tokens/purchase")}
            className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-green-500/30 rounded-xl p-4 text-left transition-all cursor-pointer group"
          >
            <div className="text-2xl mb-2">{"\uD83D\uDED2"}</div>
            <p className="text-lg font-bold text-white">Purchase</p>
            <p className="text-xs text-slate-500 group-hover:text-slate-400">Buy Tokens</p>
          </button>
          <button
            onClick={() => navigate("/org/new")}
            className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-indigo-500/30 rounded-xl p-4 text-left transition-all cursor-pointer group"
          >
            <div className="text-2xl mb-2">{"\uD83C\uDFE2"}</div>
            <p className="text-lg font-bold text-white">{orgs.length}</p>
            <p className="text-xs text-slate-500 group-hover:text-slate-400">Organizations</p>
          </button>
          <button
            onClick={() => navigate("/templates")}
            className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-purple-500/30 rounded-xl p-4 text-left transition-all cursor-pointer group"
          >
            <div className="text-2xl mb-2">{"\uD83C\uDFA8"}</div>
            <p className="text-lg font-bold text-white">Browse</p>
            <p className="text-xs text-slate-500 group-hover:text-slate-400">Templates</p>
          </button>
        </div>

        {/* ─── Your Organizations (if any) ─── */}
        {orgs.length > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700/30 flex items-center justify-between">
              <h3 className="font-bold text-white">Your Organizations</h3>
              <button
                onClick={() => navigate("/org/new")}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
              >
                + New Organization
              </button>
            </div>
            <div className="divide-y divide-slate-700/30">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => navigate(`/org/${org.slug}/dashboard`)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-sm">
                      {(org.name || "O").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{org.name}</p>
                      <p className="text-xs text-slate-500">/{org.slug}</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
