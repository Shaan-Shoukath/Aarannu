import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Templates Page
 * --------------------------------------------------
 * Template selection screen shown after clicking "Generate IDs" from Dashboard.
 * User picks a template, configures org details, then proceeds to Generate.
 */

const TEMPLATES = [
  {
    id: "custom",
    name: "Create Custom",
    description: "Start with a blank canvas and design your own ID card.",
    tags: [],
    gradient: null,
    icon: "plus",
  },
  {
    id: "corporate",
    name: "Corporate Standard",
    description: "Red & Blue Dynamic Gradient",
    tags: ["Portrait", "Employee"],
    badge: "PRO",
    gradient: "from-[#1152d4] via-blue-500 to-red-400",
  },
  {
    id: "event",
    name: "Event Access",
    description: "Dark Royal Theme",
    tags: ["Landscape", "VIP"],
    badge: "POPULAR",
    gradient: "from-indigo-900 via-purple-800 to-indigo-700",
  },
  {
    id: "student",
    name: "Student ID",
    description: "Modern Academic Vertical",
    tags: ["Vertical", "Education"],
    badge: null,
    gradient: "from-orange-400 via-pink-500 to-purple-600",
  },
];

export default function Templates() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgConfig, setOrgConfig] = useState({
    orgName: "",
    logoUrl: "",
  });

  const checkAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const { data: memberData } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!memberData?.approved) {
      navigate("/dashboard", { replace: true });
      return;
    }

    setLoading(false);
  };

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setShowOrgModal(true);
  };

  const handleProceed = () => {
    if (!orgConfig.orgName.trim()) return;
    navigate("/generate", {
      state: {
        template: selectedTemplate.id,
        orgName: orgConfig.orgName.trim(),
        logoUrl: orgConfig.logoUrl.trim(),
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8]">
        <svg
          className="animate-spin h-8 w-8 text-[#1152d4]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] font-['Public_Sans',sans-serif]">
      {/* ─── Header ─── */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1152d4] rounded-lg flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <h1 className="font-bold text-lg text-slate-900">
            Aarannu
            <span className="text-slate-400 font-normal ml-2 text-sm">
              | Templates
            </span>
          </h1>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#1152d4] transition-colors border border-slate-300 rounded-lg"
        >
          &larr; Back to Dashboard
        </button>
      </header>

      {/* ─── Main ─── */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-slate-900 italic">
            Select a Template
          </h2>
          <p className="text-slate-500 mt-2 max-w-xl">
            Start creating professional ID cards in minutes. Choose from our
            expertly designed templates or build a custom layout from the ground
            up.
          </p>
        </div>

        {/* ─── Template Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-[#1152d4]/30 transition-all duration-300 overflow-hidden text-left"
            >
              {/* Card Preview */}
              <div className="h-44 relative overflow-hidden">
                {t.id === "custom" ? (
                  <div className="h-full border-2 border-dashed border-slate-300 rounded-t-xl flex flex-col items-center justify-center gap-3 bg-slate-50 group-hover:border-[#1152d4]/40 transition-colors">
                    <div className="w-12 h-12 bg-[#1152d4]/10 rounded-full flex items-center justify-center group-hover:bg-[#1152d4]/20 transition-colors">
                      <svg
                        className="w-6 h-6 text-[#1152d4]"
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
                    </div>
                    <span className="text-sm font-semibold text-slate-600">
                      {t.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {t.description}
                    </span>
                  </div>
                ) : (
                  <>
                    <div
                      className={`h-full bg-linear-to-br ${t.gradient} flex items-center justify-center`}
                    >
                      {/* Mini card preview */}
                      <div className="w-4/5 h-3/5 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30 p-3 flex gap-2">
                        <div className="w-8 h-10 bg-white/30 rounded" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2 w-3/4 bg-white/40 rounded" />
                          <div className="h-1.5 w-1/2 bg-white/30 rounded" />
                          <div className="h-1.5 w-2/3 bg-white/20 rounded" />
                        </div>
                      </div>
                    </div>
                    {t.badge && (
                      <span
                        className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          t.badge === "PRO"
                            ? "bg-[#1152d4] text-white"
                            : t.badge === "POPULAR"
                              ? "bg-green-500 text-white"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {t.badge}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Card Info */}
              {t.id !== "custom" && (
                <div className="p-4">
                  <h3 className="text-sm font-bold text-slate-800">{t.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.description}
                  </p>
                  <div className="flex gap-1.5 mt-3">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 bg-white py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1152d4] rounded-md flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <span className="text-sm font-medium text-slate-600">Aarannu</span>
            <span className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
        </div>
      </footer>

      {/* ─── Organization Config Modal ─── */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                Organization Details
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Configure your organization info for the{" "}
                <span className="font-medium text-slate-700">
                  {selectedTemplate?.name}
                </span>{" "}
                template.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={orgConfig.orgName}
                  onChange={(e) =>
                    setOrgConfig((prev) => ({
                      ...prev,
                      orgName: e.target.value,
                    }))
                  }
                  placeholder="e.g. TinkerSpace Academy"
                  className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2.5 px-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={orgConfig.logoUrl}
                  onChange={(e) =>
                    setOrgConfig((prev) => ({
                      ...prev,
                      logoUrl: e.target.value,
                    }))
                  }
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2.5 px-3 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Direct link to your organization&apos;s logo (PNG/SVG
                  recommended)
                </p>
              </div>

              {orgConfig.logoUrl && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <img
                    src={orgConfig.logoUrl}
                    alt="Logo preview"
                    className="w-10 h-10 object-contain rounded"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <span className="text-xs text-slate-500">Logo preview</span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowOrgModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={!orgConfig.orgName.trim()}
                className="px-6 py-2 text-sm font-medium text-white bg-[#1152d4] rounded-lg hover:bg-[#1152d4]/90 transition-colors shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
