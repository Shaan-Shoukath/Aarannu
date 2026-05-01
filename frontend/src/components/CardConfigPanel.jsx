import { useState } from "react";

/**
 * CardConfigPanel — Card Design & Branding configuration
 * Used in ProjectCreate to configure all card generation settings.
 */

const TEMPLATE_DATA = [
  {
    id: "custom",
    name: "Corporate / Custom",
    description: "Professional ID card with logo, photo, member details, and a verification QR.",
    bestFor: "Teams",
    tags: ["Professional", "QR"],
    gradient: "from-[#2563EB] via-blue-500 to-red-400",
  },
  {
    id: "corporate",
    name: "Corporate / Custom Plus",
    description: "Same professional structure with stronger brand gradient controls.",
    bestFor: "Companies",
    tags: ["Branding", "Export"],
    badge: "PRO",
    gradient: "from-[#2563EB] via-blue-500 to-red-400",
  },
];

/* ── Type selector cards ─── */
export function TypeSelector({ value, onChange }) {
  const types = [
    {
      id: "service",
      title: "Service",
      subtitle: "Registration Form",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      description: "Create a registration form link. People sign up, you approve, and cards are generated automatically.",
      examples: "Memberships, Student IDs, Ongoing Enrollment",
    },
    {
      id: "bulk",
      title: "Bulk",
      subtitle: "Spreadsheet Import",
      icon: "M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M9 11h6M9 15h4",
      description: "Import members from a spreadsheet or Google Sheets. Generate all cards at once in bulk.",
      examples: "Events, One-time Batches, Pre-existing Lists",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {types.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`relative text-left p-4 rounded-xl border-2 transition-all cursor-pointer group ${
            value === t.id
              ? "border-cyan-300 bg-cyan-300/5 shadow-lg shadow-cyan-300/10"
              : "border-zinc-700/50 bg-zinc-900/60 hover:border-zinc-500"
          }`}
        >
          {value === t.id && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-cyan-300 flex items-center justify-center">
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              value === t.id ? "bg-cyan-300/20 text-cyan-300" : "bg-zinc-800 text-zinc-400"
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold ${value === t.id ? "text-cyan-300" : "text-white"}`}>
                {t.title}
                <span className="text-xs font-normal text-zinc-500 ml-1.5">{t.subtitle}</span>
              </p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t.description}</p>
              <p className="text-[10px] text-zinc-500 mt-1.5">
                <span className="text-zinc-600 font-medium">Best for:</span> {t.examples}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Template selector grid ─── */
export function TemplateSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {TEMPLATE_DATA.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`group text-left rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
            value === t.id
              ? "border-cyan-300 shadow-lg shadow-cyan-300/10"
              : "border-zinc-700/50 hover:border-zinc-500"
          }`}
        >
          {/* Preview area */}
          <div className={`${t.id === "custom" ? "h-full" : "h-32"} relative overflow-hidden`}>
            {t.id === "custom" ? (
              <div className="h-full min-h-32 border-b-0 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-2 bg-zinc-900 group-hover:bg-zinc-800/80 transition-colors text-center px-3 py-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  value === t.id ? "bg-cyan-300/20" : "bg-zinc-800"
                }`}>
                  <svg className="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-zinc-300">{t.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400">{t.bestFor}</span>
              </div>
            ) : (
              <>
                <div className={`h-full bg-gradient-to-br ${t.gradient} flex items-center justify-center p-3`}>
                  {/* Mini card preview skeleton */}
                  <div className="w-full max-w-32 rounded-lg border border-white/30 bg-white/20 p-2 shadow-xl backdrop-blur-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="h-4 w-4 rounded bg-white/40" />
                      <div className="h-1.5 w-8 rounded bg-white/35" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-10 w-8 rounded bg-white/50" />
                      <div className="flex-1 space-y-1.5 pt-0.5">
                        <div className="h-2 w-4/5 rounded bg-white/50" />
                        <div className="h-1 w-2/3 rounded bg-white/30" />
                        <div className="h-1 w-1/2 rounded bg-white/25" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="h-1.5 w-10 rounded bg-white/30" />
                      <div className="grid h-5 w-5 grid-cols-3 gap-px rounded bg-white/30 p-0.5">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <span key={i} className="rounded-[1px] bg-white/40" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {t.badge && (
                  <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                    t.badge === "PRO" ? "bg-[#2563EB] text-white" : "bg-green-500 text-white"
                  }`}>
                    {t.badge}
                  </span>
                )}
                {value === t.id && (
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-cyan-300 flex items-center justify-center">
                    <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Info */}
          {t.id !== "custom" && (
            <div className="p-3 bg-zinc-950">
              <h3 className="text-xs font-bold text-white">{t.name}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{t.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-300 font-semibold">{t.bestFor}</span>
                {t.tags.map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Card Design & Branding config panel ─── */
export default function CardConfigPanel({ config, onChange }) {
  const [showWatermark, setShowWatermark] = useState(
    !!(config.watermark?.text || config.watermark?.imageUrl)
  );

  const update = (key, val) => onChange({ ...config, [key]: val });
  const updateNested = (parent, key, val) =>
    onChange({ ...config, [parent]: { ...(config[parent] || {}), [key]: val } });

  const ic = "w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 focus:border-cyan-300 transition-all";

  return (
    <div className="space-y-5">
      {/* Logo URL */}
      <div>
        <label className="block text-sm text-zinc-300 mb-1">Organization Logo URL</label>
        <input type="url" value={config.logoUrl || ""} onChange={(e) => update("logoUrl", e.target.value)}
          placeholder="https://example.com/logo.png" className={ic} />
        <p className="text-[10px] text-zinc-500 mt-1">Direct link to your logo (PNG/SVG). Appears on card header.</p>
        {config.logoUrl && (
          <div className="flex items-center gap-3 p-2.5 mt-2 bg-zinc-900/80 rounded-lg border border-white/8">
            <img src={config.logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded"
              onError={(e) => { e.target.style.display = "none"; }} />
            <span className="text-[10px] text-zinc-500">Logo preview</span>
          </div>
        )}
      </div>

      {/* Gradient Colors */}
      <div>
        <label className="block text-sm text-zinc-300 mb-2">Card Gradient Colors</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <input type="color" value={config.gradientStart || "#2563EB"}
              onChange={(e) => update("gradientStart", e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border border-zinc-700 bg-zinc-900 p-1" />
            <div>
              <p className="text-xs text-zinc-300">Start</p>
              <p className="text-[10px] text-zinc-500 font-mono">{config.gradientStart || "#2563EB"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={config.gradientEnd || "#ef4444"}
              onChange={(e) => update("gradientEnd", e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border border-zinc-700 bg-zinc-900 p-1" />
            <div>
              <p className="text-xs text-zinc-300">End</p>
              <p className="text-[10px] text-zinc-500 font-mono">{config.gradientEnd || "#ef4444"}</p>
            </div>
          </div>
        </div>
        {/* Gradient preview bar */}
        <div className="mt-2 h-3 rounded-full"
          style={{ background: `linear-gradient(to right, ${config.gradientStart || "#2563EB"}, ${config.gradientEnd || "#ef4444"})` }} />
      </div>

      {/* Full Gradient Background toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-300">Full Gradient Background</p>
          <p className="text-[10px] text-zinc-500">Covers entire card instead of just corner accents</p>
        </div>
        <button type="button" onClick={() => update("fullGradientBg", !config.fullGradientBg)}
          className={`relative w-11 h-6 rounded-full transition-colors ${config.fullGradientBg ? "bg-cyan-300" : "bg-zinc-700"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.fullGradientBg ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {/* Gradient Opacity */}
      {config.fullGradientBg && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-zinc-300">Gradient Opacity</label>
            <span className="text-xs text-zinc-500">{Math.round((config.gradientOpacity ?? 0.55) * 100)}%</span>
          </div>
          <input type="range" min="0.1" max="1" step="0.05" value={config.gradientOpacity ?? 0.55}
            onChange={(e) => update("gradientOpacity", parseFloat(e.target.value))}
            className="w-full h-1.5 accent-cyan-300" />
        </div>
      )}

      {/* Orientation */}
      <div>
        <label className="block text-sm text-zinc-300 mb-2">Card Orientation</label>
        <div className="grid grid-cols-2 gap-3">
          {[{ id: "horizontal", label: "Horizontal", icon: "▬" }, { id: "vertical", label: "Vertical", icon: "▮" }].map((o) => (
            <button key={o.id} type="button" onClick={() => update("orientation", o.id)}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition cursor-pointer flex items-center gap-2 justify-center ${
                config.orientation === o.id
                  ? "border-cyan-300 bg-cyan-300/5 text-cyan-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
              }`}>
              <span className="text-lg">{o.icon}</span> {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Validity Text */}
      <div>
        <label className="block text-sm text-zinc-300 mb-1">Validity Text</label>
        <input type="text" value={config.validityText || ""} onChange={(e) => update("validityText", e.target.value)}
          placeholder="e.g. Valid for current academic session" className={ic} />
      </div>

      {/* Signature URL */}
      <div>
        <label className="block text-sm text-zinc-300 mb-1">Signature Image URL <span className="text-zinc-600">(optional)</span></label>
        <input type="url" value={config.signatureUrl || ""} onChange={(e) => update("signatureUrl", e.target.value)}
          placeholder="https://example.com/signature.png" className={ic} />
      </div>

      {/* Watermark Section */}
      <div className="pt-3 border-t border-white/8 space-y-4">
        <button type="button" onClick={() => setShowWatermark((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold text-zinc-300 hover:text-cyan-300 transition-colors">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Watermark <span className="text-[10px] text-zinc-500 font-normal">(optional)</span>
          </span>
          <svg className={`w-4 h-4 text-zinc-500 transition-transform ${showWatermark ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showWatermark && (
          <>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Text Watermark</label>
              <input type="text" value={config.watermark?.text || ""}
                onChange={(e) => updateNested("watermark", "text", e.target.value)}
                placeholder="e.g. CONFIDENTIAL" className={ic} />
              {config.watermark?.text && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[10px] text-zinc-500 shrink-0">Opacity</label>
                  <input type="range" min="0.02" max="0.3" step="0.01"
                    value={config.watermark?.textOpacity || 0.08}
                    onChange={(e) => updateNested("watermark", "textOpacity", parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-cyan-300" />
                  <span className="text-[10px] text-zinc-500 w-8 text-right">
                    {Math.round((config.watermark?.textOpacity || 0.08) * 100)}%
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Image Watermark URL</label>
              <input type="url" value={config.watermark?.imageUrl || ""}
                onChange={(e) => updateNested("watermark", "imageUrl", e.target.value)}
                placeholder="https://example.com/watermark.png" className={ic} />
              {config.watermark?.imageUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[10px] text-zinc-500 shrink-0">Opacity</label>
                  <input type="range" min="0.02" max="0.3" step="0.01"
                    value={config.watermark?.imageOpacity || 0.06}
                    onChange={(e) => updateNested("watermark", "imageOpacity", parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-cyan-300" />
                  <span className="text-[10px] text-zinc-500 w-8 text-right">
                    {Math.round((config.watermark?.imageOpacity || 0.06) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
