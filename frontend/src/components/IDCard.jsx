import { forwardRef, useId } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { proxyImageUrl } from "../lib/proxyImage";
import {
  DEFAULT_CARD_FONT_FAMILY,
  getAdaptiveIdFontFamily,
  uppercaseLatinOnly,
  withMalayalamFontFallback,
} from "../utils/textSupport";

/**
 * IDCard Component
 * --------------------------------------------------
 * Renders a single ID card matching the "Geometric Gradient" design
 * extracted from the Figma / HTML design files.
 *
 * Design tokens (from attachments):
 *  Primary:    #2563EB
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
    gradientColors = { start: "#2563EB", end: "#ef4444" },
    cardStyles = {
      bgColor: "#ffffff",
      fontColor: "#1e293b",
      fontFamily: DEFAULT_CARD_FONT_FAMILY,
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
    fullGradientBg = false,
    gradientOpacity = 0.55,
    template = "",
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
  const fv = fieldVisibility;
  const resolvedFontFamily = withMalayalamFontFallback(
    cs.fontFamily || DEFAULT_CARD_FONT_FAMILY,
  );
  const primaryTextColor = "#111111";
  const secondaryTextColor = "#1a1a1a";
  const labelTextColor = "#2f2f2f";
  const mutedTextColor = "#3f3f46";
  const orgDisplayName = uppercaseLatinOnly(orgName || "Community ID");
  const displayName = uppercaseLatinOnly(name);
  const displayRole = uppercaseLatinOnly(role);
  const displayDob = uppercaseLatinOnly(dob);
  const displayGender = uppercaseLatinOnly(gender);
  const displayMembershipId = uppercaseLatinOnly(id_number);
  const displayAddress = uppercaseLatinOnly(address || "Address not provided");
  const displayValidityText = uppercaseLatinOnly(validityText);
  const getCustomFieldDisplayValue = (label) =>
    uppercaseLatinOnly(customValues[label] || "—");
  const membershipIdFontFamily = getAdaptiveIdFontFamily(
    displayMembershipId,
    resolvedFontFamily,
  );

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
            backgroundColor: fullGradientBg ? "#ffffff" : cs.bgColor,
            fontFamily: resolvedFontFamily,
            borderRadius: `${cs.borderRadius}px`,
          }}
        >
          {/* Background – full gradient or corner triangles */}
          <div className="absolute inset-0 z-0">
            {fullGradientBg ? (
              /* Full vertical gradient background with round decorations */
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${gc.start}, ${gc.end})`,
                    opacity: gradientOpacity,
                  }}
                />
                {/* Decorative circles */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: '120px',
                    height: '120px',
                    top: '-30px',
                    right: '-30px',
                    background: `radial-gradient(circle, ${gc.end}66 0%, transparent 70%)`,
                    opacity: gradientOpacity,
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: '80px',
                    height: '80px',
                    bottom: '10%',
                    left: '-20px',
                    background: `radial-gradient(circle, ${gc.start}44 0%, transparent 70%)`,
                    opacity: gradientOpacity,
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: '60px',
                    height: '60px',
                    top: '40%',
                    right: '10%',
                    background: `radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)`,
                    opacity: gradientOpacity,
                  }}
                />
              </>
            ) : (
              (() => {
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
              })()
            )}
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
                  className="text-sm font-bold"
                  style={{
                    color: primaryTextColor,
                    fontFamily: resolvedFontFamily,
                  }}
                >
                  {orgDisplayName}
                </span>
                <span
                  className="text-[9px] font-medium tracking-wide"
                  style={{ color: mutedTextColor }}
                >
                  DIGITAL IDENTITY CARD
                </span>
              </div>
            </div>
          </div>

          {/* Main content – standard top-to-bottom flow */}
          <div
            className="absolute inset-0 flex flex-col z-10"
            style={{ paddingTop: "60px", paddingBottom: "8px" }}
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
                  <div className="text-center space-y-1">
                    <h3
                      className="font-bold leading-snug"
                      style={{
                        color: primaryTextColor,
                        fontSize: `${cs.nameFontSize || 20}px`,
                      }}
                    >
                      {displayName}
                    </h3>
                    {fv.role !== false && template !== "event" && (
                      <p
                        className="font-semibold uppercase tracking-widest"
                        style={{
                          color: secondaryTextColor,
                          fontSize: `${(cs.labelFontSize || 9) + 1}px`,
                        }}
                      >
                        {displayRole}
                      </p>
                    )}
                  </div>

                  {/* Details – centered 2-col grid */}
                  <div className="w-full max-w-60 space-y-3">
                    <div className="text-center pt-1">
                      <p
                        className="uppercase font-bold tracking-[0.28em] mb-1"
                        style={{
                          color: labelTextColor,
                          fontSize: `${cs.labelFontSize || 9}px`,
                        }}
                      >
                        Membership ID
                      </p>
                      <p
                        className="font-black tracking-[0.18em]"
                        style={{
                          color: primaryTextColor,
                          fontSize: `${(cs.valueFontSize || 14) + 3}px`,
                          fontFamily: membershipIdFontFamily,
                        }}
                      >
                        {displayMembershipId}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-center">
                      {fv.dob && (
                        <div>
                          <p
                            className="uppercase font-semibold"
                            style={{
                              color: labelTextColor,
                              fontSize: `${cs.labelFontSize || 9}px`,
                            }}
                          >
                            Date of Birth
                          </p>
                          <p
                            className="font-semibold"
                            style={{
                              color: secondaryTextColor,
                              fontSize: `${cs.valueFontSize || 14}px`,
                            }}
                          >
                            {displayDob}
                          </p>
                        </div>
                      )}
                      {fv.gender && (
                        <div>
                          <p
                            className="uppercase font-semibold"
                            style={{
                              color: labelTextColor,
                              fontSize: `${cs.labelFontSize || 9}px`,
                            }}
                          >
                            Gender
                          </p>
                          <p
                            className="font-semibold"
                            style={{
                              color: secondaryTextColor,
                              fontSize: `${cs.valueFontSize || 14}px`,
                            }}
                          >
                            {displayGender}
                          </p>
                        </div>
                      )}
                    </div>
                    {frontFields.length > 0 && (
                      <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-center">
                        {frontFields.map((f) => (
                          <div key={f.label}>
                            <p
                              className="uppercase font-semibold"
                              style={{
                                color: labelTextColor,
                                fontSize: `${cs.labelFontSize || 9}px`,
                              }}
                            >
                              {uppercaseLatinOnly(f.label)}
                            </p>
                            <p
                              className="font-semibold"
                              style={{
                                color: secondaryTextColor,
                                fontSize: `${cs.valueFontSize || 14}px`,
                              }}
                            >
                              {getCustomFieldDisplayValue(f.label)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── BODY (horizontal – Aadhaar-style) ── */}
                <div className="flex-1 flex flex-row gap-5 items-center px-8">
                  {/* Photo – left side */}
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

                  {/* Details – stacked vertically on the right */}
                  <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
                    <div className="space-y-1 min-w-0">
                      <p
                        className="uppercase font-semibold tracking-[0.24em]"
                        style={{
                          color: labelTextColor,
                          fontSize: `${cs.labelFontSize || 9}px`,
                        }}
                      >
                        Full Name
                      </p>
                      <h3
                        className="font-bold leading-snug break-words"
                        style={{
                          color: primaryTextColor,
                          fontSize: `${cs.nameFontSize || 20}px`,
                        }}
                      >
                        {displayName}
                      </h3>
                      {fv.role !== false && template !== "event" && (
                        <div>
                          <p
                            className="uppercase font-semibold tracking-[0.24em]"
                            style={{
                              color: labelTextColor,
                              fontSize: `${cs.labelFontSize || 9}px`,
                            }}
                          >
                            Role
                          </p>
                          <p
                            className="font-semibold"
                            style={{
                              color: secondaryTextColor,
                              fontSize: `${cs.valueFontSize || 14}px`,
                            }}
                          >
                            {displayRole}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-center py-1">
                      <p
                        className="uppercase font-bold tracking-[0.28em] mb-1"
                        style={{
                          color: labelTextColor,
                          fontSize: `${cs.labelFontSize || 9}px`,
                        }}
                      >
                        Membership ID
                      </p>
                      <p
                        className="font-black tracking-[0.18em]"
                        style={{
                          color: primaryTextColor,
                          fontSize: `${(cs.valueFontSize || 14) + 5}px`,
                          fontFamily: membershipIdFontFamily,
                        }}
                      >
                        {displayMembershipId}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    {fv.dob && (
                      <div>
                        <p
                          className="uppercase font-semibold"
                          style={{
                            color: labelTextColor,
                            fontSize: `${cs.labelFontSize || 9}px`,
                          }}
                        >
                          Date of Birth
                        </p>
                        <p
                          className="font-semibold"
                          style={{
                            color: secondaryTextColor,
                            fontSize: `${cs.valueFontSize || 14}px`,
                          }}
                        >
                          {displayDob}
                        </p>
                      </div>
                    )}
                    {fv.gender && (
                      <div>
                        <p
                          className="uppercase font-semibold"
                          style={{
                            color: labelTextColor,
                            fontSize: `${cs.labelFontSize || 9}px`,
                          }}
                        >
                          Gender
                        </p>
                        <p
                          className="font-semibold"
                          style={{
                            color: secondaryTextColor,
                            fontSize: `${cs.valueFontSize || 14}px`,
                          }}
                        >
                          {displayGender}
                        </p>
                      </div>
                    )}
                    {frontFields.map((f) => (
                        <div key={f.label}>
                          <p
                            className="uppercase font-semibold"
                            style={{
                              color: labelTextColor,
                              fontSize: `${cs.labelFontSize || 9}px`,
                            }}
                          >
                            {uppercaseLatinOnly(f.label)}
                          </p>
                          <p
                            className="font-semibold"
                            style={{
                              color: secondaryTextColor,
                              fontSize: `${cs.valueFontSize || 14}px`,
                            }}
                          >
                            {getCustomFieldDisplayValue(f.label)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>

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
            fontFamily: resolvedFontFamily,
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
                {fv.address && (
                  <div>
                    <h4
                      className="text-xs font-bold mb-1 uppercase tracking-wide border-b pb-1 inline-block"
                      style={{ color: primaryTextColor, borderColor: `${gc.start}33` }}
                    >
                      Address
                    </h4>
                    <p
                      className="text-[11px] leading-relaxed font-medium"
                      style={{ color: secondaryTextColor }}
                    >
                      {displayAddress}
                    </p>
                  </div>
                )}
                <div className="pt-2">
                  <h4
                    className="text-xs font-bold mb-1 uppercase tracking-wide border-b pb-1 inline-block"
                    style={{ color: primaryTextColor, borderColor: `${gc.start}33` }}
                  >
                    Issuing Authority
                  </h4>
                  <p
                    className="text-[11px] leading-relaxed font-medium"
                    style={{ color: secondaryTextColor }}
                  >
                    {uppercaseLatinOnly(orgName || "Community ID Platform")}
                  </p>
                </div>
                {/* Back custom fields */}
                {backFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-y-1 gap-x-4 pt-1">
                    {backFields.map((f) => (
                      <div key={f.label}>
                        <p
                          className="text-[8px] uppercase font-semibold"
                          style={{ color: labelTextColor }}
                        >
                          {uppercaseLatinOnly(f.label)}
                        </p>
                        <p
                          className="text-[11px] font-semibold"
                          style={{ color: secondaryTextColor }}
                        >
                          {getCustomFieldDisplayValue(f.label)}
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
                <span
                  className="text-[9px] mt-2 text-center"
                  style={{ color: mutedTextColor }}
                >
                  SCAN FOR VERIFICATION
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="h-6 border-t border-slate-100 flex items-center justify-between mt-auto">
              <span className="text-[8px]" style={{ color: mutedTextColor }}>
                {uppercaseLatinOnly(orgName || "aarannu")}
              </span>
              <span className="text-[8px]" style={{ color: mutedTextColor }}>
                {displayValidityText}
              </span>
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
