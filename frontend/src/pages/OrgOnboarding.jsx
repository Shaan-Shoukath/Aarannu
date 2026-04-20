import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BrandLogoLink from "../components/BrandLogoLink";

/**
 * OrgOnboarding — Create or select an organization
 * ──────────────────────────────────────────────────
 * Step 1: User sees their existing orgs (if any)
 * Step 2: User can create a new organization
 * Step 3: After creation, navigated to org dashboard
 */
export default function OrgOnboarding() {
  const navigate = useNavigate();
  const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const [step, setStep] = useState("loading"); // loading | select | create
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Create org form state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [slugChecking, setSlugChecking] = useState(false);

  // Load user's organizations
  const loadOrgs = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return navigate("/login");

      const res = await fetch(`${BACKEND}/api/org/my`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();

      if (json.organizations && json.organizations.length > 0) {
        setOrgs(json.organizations);
        setStep("select");
      } else {
        setStep("create");
      }
    } catch {
      setStep("create");
    }
  };

  useEffect(() => {
    loadOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate slug from name
  const handleNameChange = (val) => {
    setOrgName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setOrgSlug(slug);
    setSlugAvailable(null);
  };

  // Check slug availability (debounced via onBlur)
  const checkSlug = async () => {
    if (orgSlug.length < 3) {
      setSlugAvailable(false);
      return;
    }
    setSlugChecking(true);
    try {
      const res = await fetch(`${BACKEND}/api/org/check-slug/${orgSlug}`);
      const json = await res.json();
      setSlugAvailable(json.available);
    } catch {
      setSlugAvailable(null);
    }
    setSlugChecking(false);
  };

  // Create organization
  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return navigate("/login");

      const res = await fetch(`${BACKEND}/api/org`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create organization.");
        setLoading(false);
        return;
      }

      navigate(`/org/${json.org.slug}/dashboard`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ─── Render ─────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#2563EB] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] font-['Public_Sans',sans-serif] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <BrandLogoLink
            className="justify-center mb-3"
            imageClassName="h-12 sm:h-14 w-auto"
            showText={false}
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Aarannu Platform
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2">
            {step === "select"
              ? "Select an organization or create a new one"
              : "Create your organization to get started"}
          </p>
        </div>

        {/* Existing Orgs List */}
        {step === "select" && (
          <div className="space-y-3 mb-6">
            {orgs.map((om) => (
              <button
                key={om.organizations.id}
                onClick={() =>
                  navigate(`/org/${om.organizations.slug}/dashboard`)
                }
                className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-[#2563EB]/30 hover:shadow-md transition-all group cursor-pointer"
              >
                {om.organizations.logo_url ? (
                  <img
                    src={om.organizations.logo_url}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-lg">
                    {om.organizations.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="text-slate-900 font-semibold group-hover:text-[#2563EB] transition-colors">
                    {om.organizations.name}
                  </p>
                  <p className="text-slate-500 text-sm">
                    /{om.organizations.slug} · {om.role}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-[#2563EB] transition-colors"
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
            ))}

            <button
              onClick={() => setStep("create")}
              className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-slate-500 hover:text-[#2563EB] hover:border-[#2563EB]/40 transition-all cursor-pointer"
            >
              + Create New Organization
            </button>
          </div>
        )}

        {/* Create Org Form */}
        {step === "create" && (
          <form
            onSubmit={handleCreate}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme University"
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Slug (URL identifier)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">/org/</span>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => {
                    setOrgSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    );
                    setSlugAvailable(null);
                  }}
                  onBlur={checkSlug}
                  placeholder="acme-university"
                  required
                  minLength={3}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all"
                />
              </div>
              {/* Slug status indicator */}
              {slugChecking && (
                <p className="text-xs text-slate-400 mt-1">Checking…</p>
              )}
              {slugAvailable === true && (
                <p className="text-xs text-emerald-600 mt-1">✓ Available</p>
              )}
              {slugAvailable === false && (
                <p className="text-xs text-red-600 mt-1">
                  ✗ Slug taken or too short (min 3 characters)
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading || slugAvailable === false || orgSlug.length < 3
              }
              className="w-full py-2.5 bg-[#2563EB] text-white font-semibold rounded-lg hover:bg-[#2563EB]/90 shadow-lg shadow-[#2563EB]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? "Creating…" : "Create Organization"}
            </button>

            {orgs.length > 0 && (
              <button
                type="button"
                onClick={() => setStep("select")}
                className="w-full py-2 text-slate-500 text-sm hover:text-[#2563EB] transition-colors cursor-pointer"
              >
                ← Back to My Organizations
              </button>
            )}
          </form>
        )}

        {/* Sign out */}
        <div className="text-center mt-6">
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
