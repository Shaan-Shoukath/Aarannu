import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandLogoLink from "../components/BrandLogoLink";
import { Button, StatusBadge } from "../components/ui";

/**
 * Templates Page
 * --------------------------------------------------
 * Template selection screen shown after clicking "Generate IDs" from Dashboard.
 * User picks a template, configures org details, then proceeds to Generate.
 */

const TEMPLATES = [
  {
    id: "custom",
    name: "Corporate / Custom",
    description: "Professional ID card with organization logo, member photo, details, and verification QR.",
    bestFor: "All organizations",
    tags: ["Professional", "QR"],
    gradient: "from-[#2563EB] via-blue-500 to-red-400",
  },
  {
    id: "corporate",
    name: "Corporate / Custom Plus",
    description: "A stronger branded variant with the same clean verification structure.",
    bestFor: "Companies",
    tags: ["Branding", "Export"],
    badge: "PRO",
    gradient: "from-[#2563EB] via-blue-500 to-red-400",
  },
];

export default function Templates() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgConfig, setOrgConfig] = useState({
    orgName: "",
    logoUrl: "",
  });
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermark, setWatermark] = useState({
    text: "",
    textOpacity: 0.08,
    imageUrl: "",
    imageOpacity: 0.06,
  });

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
        watermark: showWatermark ? watermark : null,
      },
    });
  };

  return (
    <div className="min-h-screen bg-black font-['Public_Sans',sans-serif] flex flex-col text-white">
      {/* ─── Header ─── */}
      <header className="h-14 sm:h-16 bg-black/90 backdrop-blur-md border-b border-white/12 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <BrandLogoLink
            imageClassName="h-8 sm:h-9 w-auto"
            showText={false}
          />
          <h1 className="font-bold text-base sm:text-lg text-white truncate">
            Aarannu
            <span className="text-zinc-500 font-normal ml-1 sm:ml-2 text-xs sm:text-sm">
              | Templates
            </span>
          </h1>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-zinc-400 hover:text-cyan-300 transition-colors border border-white/12 rounded-lg hover:border-cyan-300/30 cursor-pointer shrink-0"
        >
          &larr; <span className="hidden sm:inline">Back to </span>Dashboard
        </button>
      </header>

      {/* ─── Main ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10 flex-1">
        <div className="mb-5 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Select a Template
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-2 max-w-xl">
            Start creating professional ID cards in minutes. Choose from our
            expertly designed templates or build a custom layout from the ground
            up.
          </p>
        </div>

        {/* Template summary */}
        <div className="mb-5 sm:mb-8 flex flex-col gap-3 rounded-xl border border-white/12 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              Template library
            </p>
            <p className="text-xs text-zinc-400">
              Pick the card structure first. Fine tune colors, fields, and
              orientation in the generator.
            </p>
          </div>
          <StatusBadge tone="blue">{TEMPLATES.length} templates</StatusBadge>
        </div>

        {/* ─── Template Grid ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-10 sm:mb-16">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className="group bg-zinc-950 rounded-xl border border-white/12 hover:shadow-lg hover:border-cyan-300/30 transition-all duration-300 overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
            >
              {/* Card Preview */}
              <div
                className={`${t.id === "custom" ? "h-full" : "h-44"} relative overflow-hidden`}
              >
                {t.id === "custom" ? (
                  <div className="h-full min-h-44 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-3 bg-zinc-900 group-hover:border-cyan-300/40 transition-colors text-center px-4">
                    <div className="w-14 h-14 bg-cyan-300/10 rounded-full flex items-center justify-center group-hover:bg-cyan-300/20 transition-colors">
                      <svg
                        className="w-6 h-6 text-cyan-300"
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
                    <span className="text-sm font-semibold text-zinc-300">
                      {t.name}
                    </span>
                    <StatusBadge tone="slate">{t.bestFor}</StatusBadge>
                  </div>
                ) : (
                  <>
                    <div
                      className={`h-full bg-linear-to-br ${t.gradient} flex items-center justify-center p-5`}
                    >
                      {/* Mini card preview */}
                      <div className="w-full max-w-44 rounded-xl border border-white/35 bg-white/20 p-3 shadow-2xl backdrop-blur-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="h-5 w-5 rounded bg-white/45" />
                          <div className="h-2 w-12 rounded bg-white/40" />
                        </div>
                        <div className="flex gap-3">
                          <div className="h-14 w-11 rounded-lg bg-white/55" />
                          <div className="flex-1 space-y-2 pt-1">
                            <div className="h-2.5 w-4/5 rounded bg-white/55" />
                            <div className="h-1.5 w-2/3 rounded bg-white/35" />
                            <div className="h-1.5 w-1/2 rounded bg-white/30" />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="h-2 w-14 rounded bg-white/35" />
                          <div className="grid h-8 w-8 grid-cols-3 gap-0.5 rounded bg-white/35 p-1">
                            {Array.from({ length: 9 }).map((_, index) => (
                              <span
                                key={index}
                                className="rounded-[1px] bg-white/45"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {t.badge && (
                      <span
                        className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          t.badge === "PRO"
                            ? "bg-[#2563EB] text-white"
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
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <StatusBadge tone="blue">{t.bestFor}</StatusBadge>
                    {t.tags.map((tag) => (
                      <StatusBadge key={tag} tone="slate">
                        {tag}
                      </StatusBadge>
                    ))}
                  </div>
                  <div className="mt-4 text-xs font-semibold text-cyan-300 opacity-0 transition group-hover:opacity-100">
                    Use this template
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/12 bg-black py-4 sm:py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogoLink
              imageClassName="h-7 w-auto"
              textClassName="text-sm font-medium text-zinc-300"
            />
            <span className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
        </div>
      </footer>

      {/* ─── Organization Config Modal ─── */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-white/12 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/12">
              <h3 className="text-lg font-bold text-white">
                Organization Details
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                Configure your organization info for the{" "}
                <span className="font-medium text-cyan-300">
                  {selectedTemplate?.name}
                </span>{" "}
                template.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 text-sm focus:border-cyan-300 focus:ring-cyan-300/30 py-2.5 px-3 outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 text-sm focus:border-cyan-300 focus:ring-cyan-300/30 py-2.5 px-3 outline-none focus:ring-2"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Direct link to your organization&apos;s logo (PNG/SVG
                  recommended)
                </p>
              </div>

              {orgConfig.logoUrl && (
                <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-white/12">
                  <img
                    src={orgConfig.logoUrl}
                    alt="Logo preview"
                    className="w-10 h-10 object-contain rounded"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <span className="text-xs text-zinc-400">Logo preview</span>
                </div>
              )}

              {/* ── Watermark Settings (optional, collapsed by default) ── */}
              <div className="pt-3 border-t border-white/12 space-y-4">
                <button
                  type="button"
                  onClick={() => setShowWatermark((v) => !v)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-zinc-300 hover:text-cyan-300 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <svg
                          className="w-4 h-4 text-zinc-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                    Add Watermark
                    <span className="text-[10px] text-zinc-500 font-normal">
                      (optional)
                    </span>
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${showWatermark ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showWatermark && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">
                        Text Watermark
                      </label>
                      <input
                        type="text"
                        value={watermark.text}
                        onChange={(e) =>
                          setWatermark((prev) => ({
                            ...prev,
                            text: e.target.value,
                          }))
                        }
                        placeholder="e.g. CONFIDENTIAL, org name..."
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 text-sm focus:border-cyan-300 focus:ring-cyan-300/30 py-2.5 px-3 outline-none focus:ring-2"
                      />
                      {watermark.text && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-[11px] text-zinc-500 shrink-0">
                            Opacity
                          </label>
                          <input
                            type="range"
                            min="0.02"
                            max="0.3"
                            step="0.01"
                            value={watermark.textOpacity}
                            onChange={(e) =>
                              setWatermark((prev) => ({
                                ...prev,
                                textOpacity: parseFloat(e.target.value),
                              }))
                            }
                            className="flex-1 h-1 accent-[#2563EB]"
                          />
                          <span className="text-[11px] text-zinc-500 w-8 text-right">
                            {Math.round(watermark.textOpacity * 100)}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">
                        Image Watermark URL
                      </label>
                      <input
                        type="url"
                        value={watermark.imageUrl}
                        onChange={(e) =>
                          setWatermark((prev) => ({
                            ...prev,
                            imageUrl: e.target.value,
                          }))
                        }
                        placeholder="https://example.com/watermark.png"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 text-sm focus:border-cyan-300 focus:ring-cyan-300/30 py-2.5 px-3 outline-none focus:ring-2"
                      />
                      {watermark.imageUrl && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-[11px] text-zinc-500 shrink-0">
                            Opacity
                          </label>
                          <input
                            type="range"
                            min="0.02"
                            max="0.3"
                            step="0.01"
                            value={watermark.imageOpacity}
                            onChange={(e) =>
                              setWatermark((prev) => ({
                                ...prev,
                                imageOpacity: parseFloat(e.target.value),
                              }))
                            }
                            className="flex-1 h-1 accent-[#2563EB]"
                          />
                          <span className="text-[11px] text-zinc-500 w-8 text-right">
                            {Math.round(watermark.imageOpacity * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-white/12 flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowOrgModal(false);
                  setSelectedTemplate(null);
                }}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceed}
                disabled={!orgConfig.orgName.trim()}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
