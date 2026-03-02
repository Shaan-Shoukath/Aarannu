import { forwardRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { proxyImageUrl } from "../lib/proxyImage";

/**
 * EventCard – Dark Royal Theme
 * Landscape card with a luxurious dark gradient for event access / VIP passes.
 */
const EventCard = forwardRef(function EventCard(
  {
    data,
    showBack = false,
    orgName = "",
    logoUrl = "",
    customFields = [],
    watermark = {},
    renderSide,
    gradientColors = { start: "#f59e0b", end: "#6366f1" },
    cardStyles = {
      bgColor: "#1e1b4b",
      fontColor: "#e0e7ff",
      fontFamily: "'Public Sans', sans-serif",
      accentColor: "#818cf8",
      borderRadius: 12,
    },
    orientation = "horizontal",
    validityText = "Valid for event duration only",
    fieldVisibility = {
      dob: true,
      gender: true,
      blood_group: true,
      role: true,
      address: true,
    },
  },
  ref,
) {
  const {
    name = "Full Name",
    role = "VIP Guest",
    id_number = "0000 0000 0000",
    dob = "",
    photo_url = "",
    address = "",
    customValues = {},
  } = data || {};

  const photoSrc = proxyImageUrl(photo_url);
  const frontFields = customFields.filter((f) => f.side === "front");
  const backFields = customFields.filter((f) => f.side === "back");

  const showFront = !renderSide || renderSide === "front";
  const showBackSide = renderSide === "back" || (!renderSide && showBack);
  const gc = gradientColors;
  const isVertical = orientation === "vertical";
  const cs = cardStyles;
  const fv = fieldVisibility;

  return (
    <div ref={ref} className="flex flex-col items-center gap-8">
      {/* ═══ FRONT ═══ */}
      {showFront && (
        <div
          className={`relative ${isVertical ? "w-80" : "w-125"} shadow-2xl overflow-hidden ring-1 ring-white/10`}
          style={{
            aspectRatio: isVertical ? "53.98 / 85.6" : "85.6 / 53.98",
            background: cs.bgColor,
            fontFamily: cs.fontFamily,
            borderRadius: `${cs.borderRadius}px`,
          }}
        >
          {/* Decorative elements */}
          <div className="absolute inset-0 z-0">
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full"
              style={{
                background: `radial-gradient(circle, ${gc.start}33 0%, ${gc.start}15 40%, transparent 70%)`,
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-56 h-56 rounded-full"
              style={{
                background: `radial-gradient(circle, ${gc.end}33 0%, ${gc.end}15 40%, transparent 70%)`,
              }}
            />
            <div
              className="absolute top-0 left-0 w-full h-1 opacity-80"
              style={{
                background: `linear-gradient(to right, ${gc.start}, ${gc.end}, ${gc.start})`,
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-full h-1 opacity-40"
              style={{
                background: `linear-gradient(to right, ${gc.start}, ${gc.end}, ${gc.start})`,
              }}
            />
          </div>

          {/* Watermarks */}
          {watermark?.text && (
            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden flex items-center justify-center">
              <span
                className="text-4xl font-bold text-white uppercase tracking-widest whitespace-nowrap select-none"
                style={{
                  opacity: watermark.textOpacity || 0.08,
                  transform: "rotate(-30deg)",
                }}
              >
                {watermark.text}
              </span>
            </div>
          )}
          {watermark?.imageUrl && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              <img
                src={watermark.imageUrl}
                alt=""
                className="w-32 h-32 object-contain select-none"
                style={{ opacity: watermark.imageOpacity || 0.06 }}
                crossOrigin="anonymous"
              />
            </div>
          )}

          {/* Header */}
          <div className="absolute top-4 left-6 right-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-8 h-8 object-contain rounded"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500/30 border border-amber-400/50 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-amber-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                  {orgName || "Event"}
                </span>
                <span className="text-[8px] text-indigo-300 font-medium">
                  Access Pass
                </span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
              {role}
            </span>
          </div>

          {/* Content */}
          <div
            className={`absolute ${isVertical ? "top-14 left-4 right-4 bottom-4" : "top-16 left-6 right-6 bottom-4"} flex flex-col z-10`}
          >
            {/* Top row: Photo LEFT + Details RIGHT */}
            <div
              className={`flex-1 flex ${isVertical ? "flex-col items-center gap-3" : "flex-row gap-5 items-start"}`}
            >
              <div
                className={`${isVertical ? "w-28 h-32 mt-1" : "w-28 h-32 mt-2"} shrink-0 relative`}
              >
                {photo_url ? (
                  <img
                    src={photoSrc}
                    alt={name}
                    className="w-full h-full object-cover rounded-md shadow-lg border-2 border-amber-400/30 ring-1 ring-amber-300/20"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full rounded-md shadow-lg border-2 border-amber-400/30 bg-indigo-900/50 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-indigo-400/50"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Details – stacked vertically */}
              <div
                className={`flex-1 flex flex-col justify-center ${isVertical ? "items-center text-center" : ""} space-y-1.5 min-w-0`}
              >
                <h3
                  className="font-bold leading-snug"
                  style={{
                    color: cs.fontColor,
                    fontSize: `${cs.nameFontSize || 20}px`,
                  }}
                >
                  {name}
                </h3>
                {fv.dob && dob && (
                  <p
                    style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                    className="text-indigo-100"
                  >
                    <span
                      className="text-indigo-400 uppercase font-semibold"
                      style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                    >
                      Date of Birth:{" "}
                    </span>
                    <span className="font-semibold">{dob}</span>
                  </p>
                )}
                {frontFields.length > 0 &&
                  frontFields.map((f) => (
                    <p
                      key={f.label}
                      style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                      className="text-indigo-100"
                    >
                      <span
                        className="text-indigo-400 uppercase font-semibold"
                        style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                      >
                        {f.label}:{" "}
                      </span>
                      <span className="font-semibold">
                        {customValues[f.label] || "—"}
                      </span>
                    </p>
                  ))}
              </div>
            </div>

            {/* Membership ID – large, bottom center */}
            <div className="text-center mt-auto pt-2">
              <p
                className="text-indigo-400 uppercase font-semibold mb-0.5"
                style={{ fontSize: `${cs.labelFontSize || 9}px` }}
              >
                Membership ID
              </p>
              <p
                className="font-mono font-bold text-amber-300 tracking-widest"
                style={{ fontSize: `${(cs.valueFontSize || 14) + 6}px` }}
              >
                {id_number}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BACK ═══ */}
      {showBackSide && (
        <div
          className={`relative ${isVertical ? "w-80" : "w-125"} shadow-2xl overflow-hidden ring-1 ring-white/10`}
          style={{
            aspectRatio: isVertical ? "53.98 / 85.6" : "85.6 / 53.98",
            background: cs.bgColor,
            fontFamily: cs.fontFamily,
            borderRadius: `${cs.borderRadius}px`,
          }}
        >
          <div
            className="absolute top-0 left-0 w-full h-1 opacity-60"
            style={{
              background: `linear-gradient(to right, ${gc.start}, ${gc.end}, ${gc.start})`,
            }}
          />
          <div className="absolute inset-0 p-6 flex flex-col z-10">
            <div
              className={`flex-1 flex ${isVertical ? "flex-col gap-4" : "gap-6"}`}
            >
              <div className={`${isVertical ? "" : "flex-1"} space-y-4`}>
                <div>
                  <h4 className="text-xs font-bold text-amber-300 mb-1 uppercase tracking-wide">
                    Event Details
                  </h4>
                  <p className="text-[11px] leading-relaxed text-indigo-200 font-medium">
                    {address || "Venue details not provided"}
                  </p>
                </div>
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-amber-300 mb-1 uppercase tracking-wide">
                    Organized By
                  </h4>
                  <p className="text-[11px] leading-relaxed text-indigo-200 font-medium">
                    {orgName || "Organization"}
                  </p>
                </div>
                {backFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-y-1 gap-x-4 pt-1">
                    {backFields.map((f) => (
                      <div key={f.label}>
                        <p className="text-[8px] text-indigo-400 uppercase font-semibold">
                          {f.label}
                        </p>
                        <p className="text-[11px] font-semibold text-indigo-100">
                          {customValues[f.label] || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={`${isVertical ? "w-full flex-1" : "w-32"} flex flex-col justify-center items-center`}
              >
                <div className="w-28 h-28 bg-white p-2 rounded-lg shadow-sm flex items-center justify-center">
                  <QRCodeCanvas value={id_number} size={96} level="M" />
                </div>
                <span className="text-[9px] text-indigo-400 mt-2 text-center">
                  Scan for entry
                </span>
              </div>
            </div>
            <div className="h-6 border-t border-indigo-500/30 flex items-center justify-between mt-auto">
              <span className="text-[8px] text-indigo-400">
                {orgName || "aarannu"}
              </span>
              <span className="text-[8px] text-indigo-400">{validityText}</span>
            </div>
          </div>

          {/* Back Watermarks */}
          {watermark?.text && (
            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden flex items-center justify-center">
              <span
                className="text-4xl font-bold text-white uppercase tracking-widest whitespace-nowrap select-none"
                style={{
                  opacity: watermark.textOpacity || 0.08,
                  transform: "rotate(-30deg)",
                }}
              >
                {watermark.text}
              </span>
            </div>
          )}
          {watermark?.imageUrl && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              <img
                src={watermark.imageUrl}
                alt=""
                className="w-32 h-32 object-contain select-none"
                style={{ opacity: watermark.imageOpacity || 0.06 }}
                crossOrigin="anonymous"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default EventCard;
