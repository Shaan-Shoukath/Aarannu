import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BrandLogoLink from "../components/BrandLogoLink";

const API =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000";

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (!user) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token}` };

      // Fetch token balance
      try {
        const tokenRes = await fetch(`${API}/api/tokens/balance`, { headers });
        if (tokenRes.ok) {
          const d = await tokenRes.json();
          setTokenBalance(d.is_unlimited ? "∞" : d.balance);
          setIsUnlimited(d.is_unlimited);
        }
      } catch (e) {
        console.warn("Token fetch:", e.message);
      }

      // Fetch user's organizations
      try {
        const orgRes = await fetch(`${API}/api/org/my`, { headers });
        if (orgRes.ok) {
          const d = await orgRes.json();
          // API returns { role, joined_at, organizations: { id, name, slug, ... } }
          // Flatten so each item has org fields at top level
          const flat = (d.organizations || []).map((entry) =>
            entry.organizations
              ? { ...entry.organizations, role: entry.role }
              : entry,
          );
          setOrgs(flat);
        }
      } catch (e) {
        console.warn("Org fetch:", e.message);
      }
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
      <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#2563EB] border-t-transparent rounded-full" />
      </div>
    );
  }

  const sidebarLinks = [
    {
      label: "Dashboard",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      active: true,
      onClick: () => {},
    },
    {
      label: "Organizations",
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      onClick: () => navigate("/org/new"),
    },
    {
      label: "Templates",
      icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
      onClick: () => navigate("/templates"),
    },
    {
      label: "Tokens",
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      onClick: () => navigate("/tokens"),
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-white font-['Public_Sans',sans-serif]">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-[#F9FAFB] hidden lg:flex flex-col justify-between py-6 px-4">
        <div className="space-y-8">
          {/* User / Brand */}
          <div className="px-2">
            <BrandLogoLink imageClassName="h-10 w-auto" />
            <p className="mt-2 text-xs text-slate-500 pl-0.5">
              {isUnlimited ? "Admin Workspace" : "Aarannu Workspace"}
            </p>
          </div>
          {/* Nav */}
          <nav className="space-y-1">
            {sidebarLinks.map((link) => (
              <button
                key={link.label}
                onClick={link.onClick}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left cursor-pointer ${
                  link.active
                    ? "bg-[#2563EB]/15 text-[#2563EB]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#2563EB]"
                }`}
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d={link.icon}
                  />
                </svg>
                <span className="text-sm font-medium">{link.label}</span>
              </button>
            ))}
          </nav>
        </div>
        {/* Sidebar footer */}
        <div className="px-2 space-y-3">
          <button
            onClick={() => navigate("/tokens/purchase")}
            className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90 text-white text-sm font-semibold py-2.5 rounded-lg shadow-lg shadow-[#2563EB]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Buy Tokens
          </button>
          <button
            onClick={handleSignOut}
            className="w-full text-slate-500 hover:text-red-600 text-xs py-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── Main Content Wrapper ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ─── Top Header ─── */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 bg-white/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile brand */}
            <BrandLogoLink
              className="flex lg:hidden items-center"
              imageClassName="h-9 w-auto"
              textClassName="font-bold text-slate-900"
            />
            <span className="hidden lg:block text-slate-900 font-bold text-lg">
              Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Token Badge */}
            <button
              onClick={() => navigate("/tokens")}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#2563EB]/10 hover:bg-[#2563EB]/20 border border-[#2563EB]/20 rounded-lg text-[#2563EB] text-sm font-medium transition cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {isUnlimited
                ? "∞ Unlimited"
                : tokenBalance !== null
                  ? tokenBalance
                  : "—"}
            </button>
            {/* Mobile sign out */}
            <button
              onClick={handleSignOut}
              className="lg:hidden px-3 py-1.5 text-sm text-slate-500 hover:text-red-600 rounded-lg transition cursor-pointer"
            >
              Sign Out
            </button>
            {/* Profile */}
            <div className="hidden lg:flex w-8 h-8 rounded-full bg-slate-200 items-center justify-center overflow-hidden">
              <span className="text-xs font-bold text-slate-600">
                {user?.user_metadata?.name?.charAt(0)?.toUpperCase() ||
                  user?.email?.charAt(0)?.toUpperCase() ||
                  "U"}
              </span>
            </div>
          </div>
        </header>

        {/* ─── Scrollable Content ─── */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* ─── Welcome Header ─── */}
            <div>
              <h2 className="text-3xl font-bold text-slate-900">
                Welcome back
                {user?.user_metadata?.name
                  ? `, ${user.user_metadata.name}`
                  : ""}
              </h2>
              <p className="text-slate-500 mt-1">
                Manage your organizations and ID card deployments from your
                command center.
              </p>
            </div>

            {/* ─── Action Cards Grid ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Organization Manager */}
              <div
                onClick={() => navigate("/org/new")}
                className="group relative p-6 bg-white rounded-xl border border-slate-200 hover:border-[#2563EB]/30 hover:shadow-md transition-all overflow-hidden cursor-pointer"
              >
                <div className="absolute -right-4 -top-4 text-[#2563EB]/5 group-hover:text-[#2563EB]/10 transition-colors">
                  <svg
                    className="w-28 h-28"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mb-4">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Organization Manager
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">
                      Manage teams, invite collaborators, and define granular
                      permissions.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {[
                      "Registration Forms",
                      "Approve & Reject",
                      "Bulk Generate",
                      "Email Delivery",
                      "Sheets Import",
                    ].map((f) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 bg-[#2563EB]/5 border border-[#2563EB]/10 rounded-full text-[10px] font-medium text-[#2563EB]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  {orgs.length > 0 && (
                    <p className="mt-3 text-xs text-[#2563EB] font-medium">
                      {orgs.length} org{orgs.length !== 1 ? "s" : ""} active →
                    </p>
                  )}
                  <button className="mt-4 flex items-center gap-2 text-[#2563EB] text-sm font-semibold group-hover:underline">
                    Manage Team <span>→</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Quick Generate */}
              <div
                onClick={() => navigate("/templates")}
                className="group relative p-6 bg-white rounded-xl border border-slate-200 hover:border-[#2563EB]/30 hover:shadow-md transition-all overflow-hidden cursor-pointer"
              >
                <div className="absolute -right-4 -top-4 text-[#2563EB]/5 group-hover:text-[#2563EB]/10 transition-colors">
                  <svg
                    className="w-28 h-28"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mb-4">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Quick Generate
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">
                      Pick a template, enter data manually or import from
                      Sheets, preview and generate.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {[
                      "4 Templates",
                      "Manual Entry",
                      "Google Sheets",
                      "PDF / ZIP / PNG",
                      "Live Preview",
                    ].map((f) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/10 rounded-full text-[10px] font-medium text-emerald-600"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  <button className="mt-4 flex items-center gap-2 text-[#2563EB] text-sm font-semibold group-hover:underline">
                    Start Generate <span>→</span>
                  </button>
                </div>
              </div>

              {/* Token Balance Card */}
              <div
                onClick={() => navigate("/tokens")}
                className="p-6 bg-[#2563EB] rounded-xl text-white shadow-xl shadow-[#2563EB]/20 flex flex-col justify-between cursor-pointer hover:shadow-2xl transition-shadow"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                      Token Balance
                    </span>
                    <svg
                      className="w-5 h-5 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-4xl font-black tracking-tight">
                    {isUnlimited
                      ? "∞"
                      : tokenBalance !== null
                        ? tokenBalance
                        : "—"}
                  </p>
                  <p className="text-sm text-white/80 mt-1">
                    {isUnlimited ? "Unlimited tokens" : "tokens available"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/tokens/purchase");
                  }}
                  className="mt-6 w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
                >
                  Refill Balance
                </button>
              </div>
            </div>

            {/* ─── Bottom Grid ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Quick Links */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">
                    Quick Actions
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => navigate("/tokens")}
                    className="bg-white border border-slate-200 hover:border-[#2563EB]/30 hover:shadow-sm rounded-xl p-4 text-left transition-all cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {isUnlimited ? "∞" : (tokenBalance ?? "—")}
                    </p>
                    <p className="text-xs text-slate-500">Token Balance</p>
                  </button>
                  <button
                    onClick={() => navigate("/tokens/purchase")}
                    className="bg-white border border-slate-200 hover:border-[#2563EB]/30 hover:shadow-sm rounded-xl p-4 text-left transition-all cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-3">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-slate-900">Purchase</p>
                    <p className="text-xs text-slate-500">Buy Tokens</p>
                  </button>
                  <button
                    onClick={() => navigate("/org/new")}
                    className="bg-white border border-slate-200 hover:border-[#2563EB]/30 hover:shadow-sm rounded-xl p-4 text-left transition-all cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {orgs.length}
                    </p>
                    <p className="text-xs text-slate-500">Organizations</p>
                  </button>
                  <button
                    onClick={() => navigate("/templates")}
                    className="bg-white border border-slate-200 hover:border-[#2563EB]/30 hover:shadow-sm rounded-xl p-4 text-left transition-all cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-slate-900">Browse</p>
                    <p className="text-xs text-slate-500">Templates</p>
                  </button>
                </div>
              </div>

              {/* Organizations List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">
                    Your Organizations
                  </h3>
                  <button
                    onClick={() => navigate("/org/new")}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
                {orgs.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-200 rounded-xl text-center">
                    <p className="text-sm text-slate-500">
                      No organizations yet
                    </p>
                    <button
                      onClick={() => navigate("/org/new")}
                      className="mt-3 text-sm text-[#2563EB] font-medium hover:underline cursor-pointer"
                    >
                      + Create your first org
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orgs.map((org) => {
                      const colors = [
                        "bg-indigo-500",
                        "bg-orange-500",
                        "bg-purple-500",
                        "bg-emerald-500",
                        "bg-rose-500",
                      ];
                      const colorIdx = org.name
                        ? org.name.charCodeAt(0) % colors.length
                        : 0;
                      return (
                        <button
                          key={org.id}
                          onClick={() => navigate(`/org/${org.slug}/dashboard`)}
                          className="w-full p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:shadow-sm hover:border-[#2563EB]/20 transition-all cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg ${colors[colorIdx]} flex items-center justify-center text-white font-bold`}
                            >
                              {(org.name || "O").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-tight">
                                {org.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                /{org.slug}
                              </p>
                            </div>
                          </div>
                          <svg
                            className="w-4 h-4 text-slate-300"
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
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
