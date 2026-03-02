import { forwardRef, useId } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { proxyImageUrl } from "../lib/proxyImage";

/**
 * IDCard Component
 * --------------------------------------------------
 * Renders a single ID card matching the "Geometric Gradient" design
 * extracted from the Figma / HTML design files.
 *
 * Design tokens (from attachments):
 *  Primary:    #1152d4
 *  Secondary:  #ef4444
 *  Font:       Public Sans
 *  Card ratio: 85.6 : 53.98 (standard CR-80)
 *
 * Props:
 *  - data: { name, role, id_number, dob, gender, photo_url, address }
 *  - showBack: boolean (render back side)
 *
 * The component is wrapped in forwardRef so html2canvas can capture it.
 */
const IDCard = forwardRef(function IDCard(
  {
    data,
    showBack = false,
    orgName = "",
    logoUrl = "",
    customFields = [],
    watermark = {},
    renderSide,
    gradientColors = { start: "#1152d4", end: "#ef4444" },
    cardStyles = {
      bgColor: "#ffffff",
      fontColor: "#1e293b",
      fontFamily: "'Public Sans', sans-serif",
      accentColor: "#64748b",
      borderRadius: 12,
    },
    orientation = "horizontal",
    validityText = "Valid for 15 days from issue",
  },
  ref,
) {
  const {
    name = "Full Name",
    role = "Member",
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

  // Unique suffix for SVG gradient IDs – prevents collisions when
  // multiple card instances exist in the DOM simultaneously
  const uid = useId().replace(/:/g, "");

  return (
    <div ref={ref} className="flex flex-col items-center gap-8">
      {/* ═══════════════════════════════════════════
          FRONT SIDE
          ═══════════════════════════════════════════ */}
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
          {/* Geometric Background – triangle sizes adjust dynamically to stay
              proportional to the photo scale so content never overlaps */}
          <div className="absolute inset-0 z-0">
            {(() => {
              // Dynamic gradient size: base 36 (w-36=144px) scaled with photo
              const scale = (cs.photoScale || 100) / 100;
              const triSize = Math.round(
                Math.max(20, 36 * (1 - (scale - 1) * 0.6)),
              );
              return (
                <>
                  {/* Top-right gradient blob */}
                  <div
                    className="absolute -top-14 -right-14 w-56 h-56 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${gc.start}33 0%, ${gc.start}15 40%, transparent 70%)`,
                    }}
                  />
                  {/* Top-right triangle */}
                  <div
                    className="absolute top-0 right-0"
                    style={{
                      width: `${triSize * 4}px`,
                      height: `${triSize * 4}px`,
                    }}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <linearGradient
                          id={`idcard-grad-front-tr-${uid}`}
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
                        fill={`url(#idcard-grad-front-tr-${uid})`}
                        fillOpacity="0.9"
                      />
                    </svg>
                  </div>
                  {/* Bottom-left gradient blob */}
                  <div
                    className="absolute -bottom-14 -left-14 w-56 h-56 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${gc.end}1a 0%, ${gc.end}0d 40%, transparent 70%)`,
                    }}
                  />
                  {/* Bottom-left triangle */}
                  <div
                    className="absolute bottom-0 left-0 rotate-180"
                    style={{
                      width: `${triSize * 4}px`,
                      height: `${triSize * 4}px`,
                    }}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <linearGradient
                          id={`idcard-grad-front-bl-${uid}`}
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
                        fill={`url(#idcard-grad-front-bl-${uid})`}
                        fillOpacity="0.8"
                      />
                    </svg>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Hologram overlay – no mix-blend-mode (unsupported by html2canvas) */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-white/10 z-20 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%)",
            }}
          />

          {/* Text Watermark */}
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

          {/* Image Watermark */}
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

          {/* Header bar */}
          <div className="absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-2.5 px-5 py-2.5">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-9 h-9 object-contain rounded-lg shadow-sm"
                  crossOrigin="anonymous"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${gc.start}, ${gc.end})`,
                  }}
                >
                  <svg
                    className="w-4.5 h-4.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col leading-tight">
                <span
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: gc.start }}
                >
                  {orgName || "Community ID"}
                </span>
                <span className="text-[9px] text-slate-400 font-medium tracking-wide">
                  Digital Identity Card
                </span>
              </div>
            </div>
          </div>

          {/* Main content – standard top-to-bottom flow */}
          <div
            className="absolute inset-0 flex flex-col z-10"
            style={{ paddingTop: "48px" }}
          >
            {isVertical ? (
              <>
                {/* ── BODY (vertical) ── */}
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                  {/* Photo – centered */}
                  {(() => {
                    const scale = (cs.photoScale || 100) / 100;
                    const pw = Math.round(100 * scale);
                    const ph = Math.round(125 * scale);
                    return (
                      <div
                        className="shrink-0 rounded-lg p-0.5 shadow-md"
                        style={{
                          background: `linear-gradient(135deg, ${gc.start}40, ${gc.end}40)`,
                        }}
                      >
                        <div
                          className="relative overflow-hidden rounded-[5px]"
                          style={{ width: `${pw}px`, height: `${ph}px` }}
                        >
                          {photo_url ? (
                            <img
                              src={photoSrc}
                              alt={`${name} profile`}
                              className="w-full h-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                              <svg
                                className="w-10 h-10 text-slate-300"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Name & Role – centered */}
                  <div className="text-center">
                    <h3
                      className="font-bold leading-snug"
                      style={{
                        color: cs.fontColor,
                        fontSize: `${cs.nameFontSize || 20}px`,
                      }}
                    >
                      {name}
                    </h3>
                    <p
                      className="font-semibold uppercase tracking-widest mt-0.5"
                      style={{
                        color: cs.accentColor,
                        fontSize: `${(cs.labelFontSize || 9) + 1}px`,
                      }}
                    >
                      {role}
                    </p>
                  </div>

                  {/* Details – centered 2-col grid */}
                  <div className="w-full max-w-[240px] space-y-2">
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-center">
                      <div>
                        <p
                          className="text-slate-400 uppercase font-semibold"
                          style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                        >
                          Date of Birth
                        </p>
                        <p
                          className="font-semibold text-slate-700"
                          style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                        >
                          {dob}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-slate-400 uppercase font-semibold"
                          style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                        >
                          Gender
                        </p>
                        <p
                          className="font-semibold text-slate-700"
                          style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                        >
                          {gender}
                        </p>
                      </div>
                    </div>
                    {frontFields.length > 0 && (
                      <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-center">
                        {frontFields.map((f) => (
                          <div key={f.label}>
                            <p
                              className="text-slate-400 uppercase font-semibold"
                              style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                            >
                              {f.label}
                            </p>
                            <p
                              className="font-semibold text-slate-700"
                              style={{
                                fontSize: `${cs.valueFontSize || 14}px`,
                              }}
                            >
                              {customValues[f.label] || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── FOOTER (vertical): Membership ID – pinned bottom center ── */}
                <div className="text-center py-3 mx-5 mt-auto">
                  <p
                    className="text-slate-400 uppercase font-bold tracking-widest mb-0.5"
                    style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                  >
                    Membership ID
                  </p>
                  <p
                    className="font-mono font-bold tracking-widest"
                    style={{
                      color: gc.start,
                      fontSize: `${(cs.valueFontSize || 14) + 2}px`,
                    }}
                  >
                    {id_number}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* ── BODY (horizontal) ── */}
                <div className="flex-1 flex items-center justify-center px-8 gap-6">
                  {/* Photo – centered */}
                  {(() => {
                    const scale = (cs.photoScale || 100) / 100;
                    const pw = Math.round(105 * scale);
                    const ph = Math.round(130 * scale);
                    return (
                      <div
                        className="shrink-0 rounded-lg p-0.5 shadow-md"
                        style={{
                          background: `linear-gradient(135deg, ${gc.start}40, ${gc.end}40)`,
                        }}
                      >
                        <div
                          className="relative overflow-hidden rounded-[5px]"
                          style={{ width: `${pw}px`, height: `${ph}px` }}
                        >
                          {photo_url ? (
                            <img
                              src={photoSrc}
                              alt={`${name} profile`}
                              className="w-full h-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                              <svg
                                className="w-10 h-10 text-slate-300"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Details – centered */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-2.5 min-w-0 text-center">
                    <div>
                      <h3
                        className="font-bold leading-snug"
                        style={{
                          color: cs.fontColor,
                          fontSize: `${cs.nameFontSize || 20}px`,
                        }}
                      >
                        {name}
                      </h3>
                      <p
                        className="font-semibold uppercase tracking-widest mt-0.5"
                        style={{
                          color: cs.accentColor,
                          fontSize: `${(cs.labelFontSize || 9) + 1}px`,
                        }}
                      >
                        {role}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 text-center">
                      <div>
                        <p
                          className="text-slate-400 uppercase font-semibold"
                          style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                        >
                          Date of Birth
                        </p>
                        <p
                          className="font-semibold text-slate-700"
                          style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                        >
                          {dob}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-slate-400 uppercase font-semibold"
                          style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                        >
                          Gender
                        </p>
                        <p
                          className="font-semibold text-slate-700"
                          style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                        >
                          {gender}
                        </p>
                      </div>
                    </div>

                    {frontFields.length > 0 && (
                      <div className="grid grid-cols-2 gap-y-1 gap-x-6 text-center">
                        {frontFields.map((f) => (
                          <div key={f.label}>
                            <p
                              className="text-slate-400 uppercase font-semibold"
                              style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                            >
                              {f.label}
                            </p>
                            <p
                              className="font-semibold text-slate-700 truncate"
                              style={{
                                fontSize: `${cs.valueFontSize || 14}px`,
                              }}
                            >
                              {customValues[f.label] || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── FOOTER (horizontal): Membership ID – pinned bottom center ── */}
                <div className="text-center py-3 mx-6 mt-auto">
                  <p
                    className="text-slate-400 uppercase font-bold tracking-widest mb-0.5"
                    style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                  >
                    Membership ID
                  </p>
                  <p
                    className="font-mono font-bold tracking-widest"
                    style={{
                      color: gc.start,
                      fontSize: `${(cs.valueFontSize || 14) + 2}px`,
                    }}
                  >
                    {id_number}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          BACK SIDE (optional)
          ═══════════════════════════════════════════ */}
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
          {/* Background  */}
          <div className="absolute inset-0 z-0 opacity-50">
            <div
              className="absolute top-0 left-0 w-full h-2"
              style={{
                background: `linear-gradient(to right, ${gc.start}, ${gc.end}, ${gc.start})`,
              }}
            />
            <div className="absolute bottom-0 right-0 w-40 h-40 rotate-90">
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient
                    id={`idcard-grad-back-${uid}`}
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
                  fill={`url(#idcard-grad-back-${uid})`}
                  fillOpacity="0.1"
                />
              </svg>
            </div>
          </div>

          <div className="absolute inset-0 p-6 flex flex-col z-10">
            <div
              className={`flex-1 flex ${isVertical ? "flex-col gap-4" : "gap-6"}`}
            >
              {/* Address block */}
              <div className={`${isVertical ? "" : "flex-1"} space-y-4`}>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide border-b border-[#1152d4]/20 pb-1 inline-block">
                    Address
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    {address || "Address not provided"}
                  </p>
                </div>
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide border-b border-[#1152d4]/20 pb-1 inline-block">
                    Issuing Authority
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    {orgName || "Community ID Platform"}
                  </p>
                </div>
                {/* Back custom fields */}
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

              {/* QR Code */}
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

            {/* Footer */}
            <div className="h-6 border-t border-slate-100 flex items-center justify-between mt-auto">
              <span className="text-[8px] text-slate-400">aarannu</span>
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

export default IDCard;
