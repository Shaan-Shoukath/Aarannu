import { forwardRef, useId } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { proxyImageUrl } from "../lib/proxyImage";

/**
 * CorporateCard – Red & Blue Dynamic Gradient template
 * Standard CR-80 landscape card with corporate styling.
 */
const CorporateCard = forwardRef(function CorporateCard(
  {
    data,
    showBack = false,
    orgName = "",
    logoUrl = "",
    customFields = [],
    watermark = {},
    renderSide,
    gradientColors = { start: "#2563EB", end: "#ef4444" },
    cardStyles = {
      bgColor: "#ffffff",
      fontColor: "#1e293b",
      fontFamily: "'Public Sans', sans-serif",
      accentColor: "#64748b",
      borderRadius: 12,
    },
    orientation = "horizontal",
    validityText = "Valid as per subscription plan",
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
    role = "Employee",
    id_number = "0000 0000 0000",
    dob = "01/01/2000",
    gender = "N/A",
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

  const uid = useId().replace(/:/g, "");

  return (
    <div ref={ref} className="flex flex-col items-center gap-8">
      {/* ═══ FRONT ═══ */}
      {showFront && (
        <div
          className={`relative ${isVertical ? "w-80" : "w-125"} shadow-2xl overflow-hidden ring-1 ring-slate-900/5`}
          style={{
            aspectRatio: isVertical ? "53.98 / 85.6" : "85.6 / 53.98",
            backgroundColor: cs.bgColor,
            fontFamily: cs.fontFamily,
            borderRadius: `${cs.borderRadius}px`,
          }}
        >
          {/* Background gradients */}
          <div className="absolute inset-0 z-0">
            <div
              className="absolute -top-14 -right-14 w-64 h-64 rounded-full"
              style={{
                background: `radial-gradient(circle, ${gc.start}33 0%, ${gc.start}15 40%, transparent 70%)`,
              }}
            />
            <div
              className="absolute -bottom-14 -left-14 w-56 h-56 rounded-full"
              style={{
                background: `radial-gradient(circle, ${gc.end}26 0%, ${gc.end}0d 40%, transparent 70%)`,
              }}
            />
            <div className="absolute top-0 right-0 w-40 h-40">
              <svg viewBox="0 0 100 100" fill="none">
                <defs>
                  <linearGradient
                    id={`corp-tr-${uid}`}
                    x1="0"
                    y1="0"
                    x2="100"
                    y2="100"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor={gc.start} />
                    <stop offset="1" stopColor={gc.end} />
                  </linearGradient>
                </defs>
                <path
                  d="M0 0H100V100L50 50L0 0Z"
                  fill={`url(#corp-tr-${uid})`}
                  fillOpacity="0.85"
                />
              </svg>
            </div>
            <div className="absolute bottom-0 left-0 w-32 h-32 rotate-180">
              <svg viewBox="0 0 100 100" fill="none">
                <defs>
                  <linearGradient
                    id={`corp-bl-${uid}`}
                    x1="0"
                    y1="0"
                    x2="100"
                    y2="100"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor={gc.start} />
                    <stop offset="1" stopColor={gc.end} />
                  </linearGradient>
                </defs>
                <path
                  d="M0 0H100V100L50 50L0 0Z"
                  fill={`url(#corp-bl-${uid})`}
                  fillOpacity="0.7"
                />
              </svg>
            </div>
          </div>

          {/* Watermarks */}
          {watermark?.text && (
            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden flex items-center justify-center">
              <span
                className="text-4xl font-bold text-slate-900 uppercase tracking-widest whitespace-nowrap select-none"
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
          <div className="absolute top-4 left-6 right-6 flex items-center gap-2 z-10">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-8 h-8 object-contain rounded"
                crossOrigin="anonymous"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm"
                style={{
                  background: `linear-gradient(to bottom right, ${gc.start}, ${gc.start}cc)`,
                }}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              </div>
            )}
            <div className="flex flex-col leading-tight">
              <span
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: gc.start }}
              >
                {orgName || "Organization"}
              </span>
              <span className="text-[8px] text-slate-500 font-medium">
                Employee ID Card
              </span>
            </div>
          </div>

          {/* Content */}
          <div
            className={`absolute ${isVertical ? "top-14 left-4 right-4 bottom-4" : "top-16 left-6 right-6 bottom-4"} flex flex-col z-10`}
          >
            {/* Top row: Photo LEFT + Details RIGHT (Aadhaar-style) */}
            <div
              className={`flex-1 flex ${isVertical ? "flex-col items-center gap-3" : "flex-row gap-5 items-start"}`}
            >
              {/* Photo */}
              <div
                className={`${isVertical ? "w-28 h-32 mt-1" : "w-28 h-32 mt-1"} shrink-0 relative`}
              >
                {photo_url ? (
                  <img
                    src={photoSrc}
                    alt={name}
                    className="w-full h-full object-cover rounded-md shadow-md border-2 border-white ring-1 ring-[#2563EB]/20"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full rounded-md shadow-md border-2 border-white ring-1 ring-[#2563EB]/20 bg-slate-100 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-slate-300"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Details – stacked vertically, left-aligned */}
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
                {fv.role && (
                  <p
                    className="uppercase font-semibold tracking-wide"
                    style={{
                      color: cs.accentColor || gc.start,
                      fontSize: `${cs.labelFontSize || 9}px`,
                    }}
                  >
                    {role}
                  </p>
                )}
                {fv.dob && (
                  <p
                    className="text-slate-700"
                    style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                  >
                    <span
                      className="text-slate-400 uppercase font-semibold"
                      style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                    >
                      Date of Birth:{" "}
                    </span>
                    <span className="font-semibold">{dob}</span>
                  </p>
                )}
                {fv.gender && (
                  <p
                    className="text-slate-700"
                    style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                  >
                    <span
                      className="text-slate-400 uppercase font-semibold"
                      style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                    >
                      Gender:{" "}
                    </span>
                    <span className="font-semibold uppercase">{gender}</span>
                  </p>
                )}
                {frontFields.length > 0 &&
                  frontFields.map((f) => (
                    <p
                      key={f.label}
                      className="text-slate-700"
                      style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                    >
                      <span
                        className="text-slate-400 uppercase font-semibold"
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
                className="text-slate-400 uppercase font-semibold mb-0.5"
                style={{ fontSize: `${cs.labelFontSize || 9}px` }}
              >
                Membership ID
              </p>
              <p
                className="font-mono font-bold tracking-widest"
                style={{
                  color: gc.start,
                  fontSize: `${(cs.valueFontSize || 14) + 6}px`,
                }}
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
          className={`relative ${isVertical ? "w-80" : "w-125"} shadow-2xl overflow-hidden ring-1 ring-slate-900/5`}
          style={{
            aspectRatio: isVertical ? "53.98 / 85.6" : "85.6 / 53.98",
            backgroundColor: cs.bgColor,
            fontFamily: cs.fontFamily,
            borderRadius: `${cs.borderRadius}px`,
          }}
        >
          <div className="absolute inset-0 z-0 opacity-50">
            <div
              className="absolute top-0 left-0 w-full h-2"
              style={{
                background: `linear-gradient(to right, ${gc.start}, ${gc.end}, ${gc.start})`,
              }}
            />
          </div>
          <div className="absolute inset-0 p-6 flex flex-col z-10">
            <div
              className={`flex-1 flex ${isVertical ? "flex-col gap-4" : "gap-6"}`}
            >
              <div className={`${isVertical ? "" : "flex-1"} space-y-4`}>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide border-b border-[#2563EB]/20 pb-1 inline-block">
                    Address
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    {address || "Address not provided"}
                  </p>
                </div>
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide border-b border-[#2563EB]/20 pb-1 inline-block">
                    Issuing Authority
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    {orgName || "Organization"}
                  </p>
                </div>
                {backFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-y-1 gap-x-4 pt-1">
                    {backFields.map((f) => (
                      <div key={f.label}>
                        <p className="text-[8px] text-slate-400 uppercase font-semibold">
                          {f.label}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-700">
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
                <div className="w-28 h-28 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-center">
                  <QRCodeCanvas value={id_number} size={96} level="M" />
                </div>
                <span className="text-[9px] text-slate-400 mt-2 text-center">
                  Scan for verification
                </span>
              </div>
            </div>
            <div className="h-6 border-t border-slate-100 flex items-center justify-between mt-auto">
              <span className="text-[8px] text-slate-400">
                {orgName || "aarannu"}
              </span>
              <span className="text-[8px] text-slate-400">{validityText}</span>
            </div>
          </div>

          {/* Back Watermarks */}
          {watermark?.text && (
            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden flex items-center justify-center">
              <span
                className="text-4xl font-bold text-slate-900 uppercase tracking-widest whitespace-nowrap select-none"
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

export default CorporateCard;
