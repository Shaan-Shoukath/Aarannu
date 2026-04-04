import { FONT_FAMILIES } from "../hooks/useCardStyles";

export default function StyleCustomizer({
  cardStyles,
  handleStyleChange,
  orientation,
  setOrientation,
  fieldVisibility,
  toggleFieldVisibility,
  validityText,
  setValidityText,
  gradientOpacity,
  setGradientOpacity,
  fullGradientBg,
  setFullGradientBg,
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Colors */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">Foreground Colors</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="color"
                value={cardStyles.bgColor}
                onChange={(e) => handleStyleChange("bgColor", e.target.value)}
                className="w-full h-8 rounded-lg cursor-pointer flex-shrink-0"
              />
              <span className="text-[10px] text-slate-500 mt-1 block text-center">Base Bg</span>
            </div>
            <div className="flex-1">
              <input
                type="color"
                value={cardStyles.fontColor}
                onChange={(e) => handleStyleChange("fontColor", e.target.value)}
                className="w-full h-8 rounded-lg cursor-pointer flex-shrink-0"
              />
              <span className="text-[10px] text-slate-500 mt-1 block text-center">Text</span>
            </div>
            <div className="flex-1">
              <input
                type="color"
                value={cardStyles.accentColor}
                onChange={(e) => handleStyleChange("accentColor", e.target.value)}
                className="w-full h-8 rounded-lg cursor-pointer flex-shrink-0"
              />
              <span className="text-[10px] text-slate-500 mt-1 block text-center">Accent</span>
            </div>
          </div>
        </div>

        {/* Orientation */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">Orientation</label>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            className="w-full h-8 rounded-lg border border-slate-300 bg-white text-xs px-2 outline-none focus:border-[#2563EB]"
          >
            <option value="horizontal">Horizontal (CR-80)</option>
            <option value="vertical">Vertical</option>
          </select>
          <span className="text-[10px] text-transparent mt-1 block text-center select-none">-</span>
        </div>
      </div>

      {/* Typography */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">Font Family</label>
          <select
            value={cardStyles.fontFamily}
            onChange={(e) => handleStyleChange("fontFamily", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white text-xs py-2 px-2 outline-none focus:border-[#2563EB]"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">Border Radius: {cardStyles.borderRadius}px</label>
          <input
            type="range"
            min="0"
            max="32"
            value={cardStyles.borderRadius}
            onChange={(e) => handleStyleChange("borderRadius", Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-3"
          />
        </div>
      </div>

      {/* Font Sizes */}
      <div className="grid grid-cols-3 gap-3">
         <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Name Size: {cardStyles.nameFontSize}px</label>
            <input type="range" min="14" max="36" value={cardStyles.nameFontSize} onChange={(e)=>handleStyleChange('nameFontSize', Number(e.target.value))} className="w-full h-1.5" />
         </div>
         <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Value Size: {cardStyles.valueFontSize}px</label>
            <input type="range" min="8" max="24" value={cardStyles.valueFontSize} onChange={(e)=>handleStyleChange('valueFontSize', Number(e.target.value))} className="w-full h-1.5" />
         </div>
         <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Label Size: {cardStyles.labelFontSize}px</label>
            <input type="range" min="6" max="16" value={cardStyles.labelFontSize} onChange={(e)=>handleStyleChange('labelFontSize', Number(e.target.value))} className="w-full h-1.5" />
         </div>
      </div>

      <div className="space-y-1">
         <label className="text-[10px] font-semibold text-slate-500 uppercase block">Photo Scale: {cardStyles.photoScale}%</label>
         <input type="range" min="50" max="150" value={cardStyles.photoScale} onChange={(e)=>handleStyleChange('photoScale', Number(e.target.value))} className="w-full h-1.5" />
      </div>

      {/* Field Visibility Toggles */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-600 block">Visible Fields (Front & Back)</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(fieldVisibility).map(([key, isVis]) => (
            <button
              key={key}
              onClick={() => toggleFieldVisibility(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                isVis
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isVis ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                )}
                {key.replace("_", " ").toUpperCase()}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-2 pt-4 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-600 block">Card Back Validity Text</label>
          <input
            type="text"
            value={validityText}
            onChange={(e) => setValidityText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white text-xs focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
            placeholder="e.g. Valid until Dec 2026"
          />
      </div>

      <div className="space-y-2 pt-4 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={fullGradientBg}
            onChange={(e) => setFullGradientBg(e.target.checked)}
            className="rounded text-[#2563EB] border-slate-300 focus:ring-[#2563EB] h-4 w-4"
          />
          Use Full Gradient Background (Front)
        </label>
        {fullGradientBg && (
          <div className="space-y-1 pl-6">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Gradient Opacity: {gradientOpacity}</label>
            <input type="range" min="0.1" max="1" step="0.1" value={gradientOpacity} onChange={(e)=>setGradientOpacity(Number(e.target.value))} className="w-full h-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}
