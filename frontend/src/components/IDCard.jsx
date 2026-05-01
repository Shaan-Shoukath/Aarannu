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
  const primaryTextColor = cs.fontColor || "#0f172a";
  const accentColor = cs.accentColor || gc.start || "#2563EB";
  const subtleTextColor = primaryTextColor === "#ffffff" ? "#e2e8f0" : "#64748b";
  const secondaryTextColor = primaryTextColor;
  const labelTextColor = subtleTextColor;
  const mutedTextColor = subtleTextColor;
  const panelBg = fullGradientBg ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.9)";
  const softPanelBg = fullGradientBg ? "rgba(255,255,255,0.74)" : "#f8fafc";
  const gradientLayerOpacity = Math.max(0.08, Math.min(1, Number(gradientOpacity) || 0.55));
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
  const verificationId =
    data?.card_id || data?.cardId || data?.delivery_card_id || id_number;
  const verificationPath = `/members/${encodeURIComponent(verificationId || "unknown")}`;
  const verificationUrl =
    data?.verification_url ||
    data?.verificationUrl ||
    data?.delivery_verification_url ||
    (typeof window !== "undefined"
      ? `${window.location.origin}${verificationPath}`
      : verificationPath);
  const logoSrc = proxyImageUrl(logoUrl);
  const cardRadius = Math.max(10, Number(cs.borderRadius) || 14);
  const cardWidth = isVertical ? 340 : 540;
  const cardHeight = isVertical ? 540 : 340;
  const orgInitial = orgDisplayName.replace(/[^A-Z0-9]/g, "").charAt(0) || "A";
  const photoScale = Math.max(0.65, Math.min(1.25, (Number(cs.photoScale) || 100) / 100));
  const photoWidth = Math.round(Math.min(isVertical ? 138 : 126, Math.max(96, (isVertical ? 116 : 112) * photoScale)));
  const photoHeight = Math.round(Math.min(isVertical ? 168 : 148, Math.max(118, photoWidth * 1.18)));
  const labelFontSize = Number(cs.labelFontSize) || 9;
  const valueFontSize = Number(cs.valueFontSize) || 14;
  const nameFontSize = Math.min(Number(cs.nameFontSize) || 22, 28);
  const gradientStyle = cs.gradientStyle || "diagonal";
  const gradientBackgrounds = {
    diagonal: `linear-gradient(135deg, ${gc.start} 0%, ${gc.end} 100%)`,
    split: `linear-gradient(115deg, ${gc.start} 0 42%, rgba(255,255,255,0.9) 42% 58%, ${gc.end} 58% 100%)`,
    ribbon: `linear-gradient(90deg, ${gc.start} 0%, ${accentColor} 45%, ${gc.end} 100%)`,
    glass: `linear-gradient(145deg, ${gc.start}55 0%, rgba(255,255,255,0.95) 48%, ${gc.end}55 100%)`,
  };
  const activeGradient = gradientBackgrounds[gradientStyle] || gradientBackgrounds.diagonal;
  const quietBackground = `linear-gradient(135deg, ${cs.bgColor || "#ffffff"} 0%, rgba(255,255,255,0.95) 52%, ${gc.end}12 100%)`;
  const renderGradientGeometry = (reverse = false) => (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: fullGradientBg ? activeGradient : quietBackground,
          opacity: fullGradientBg ? gradientLayerOpacity : 1,
        }}
      />
      <div
        className="absolute"
        style={{
          width: "280px",
          height: "144px",
          top: reverse ? "72px" : "34px",
          right: reverse ? "-120px" : "-92px",
          left: reverse ? "auto" : "auto",
          transform: reverse ? "rotate(18deg)" : "rotate(-16deg)",
          background: `linear-gradient(135deg, rgba(255,255,255,0.72), ${gc.start}24)`,
          clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)",
          opacity: fullGradientBg ? 0.75 : 0.9,
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: "-48px",
          width: "328px",
          height: "104px",
          left: reverse ? "auto" : "-92px",
          right: reverse ? "-92px" : "auto",
          transform: reverse ? "rotate(-11deg)" : "rotate(11deg)",
          background: `linear-gradient(90deg, ${gc.end}18, rgba(255,255,255,0.78), ${gc.start}18)`,
          clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)",
        }}
      />
    </>
  );
  const frontDetailItems = [
    fv.dob && { label: "Date of Birth", value: displayDob || "N/A" },
    fv.gender && { label: "Gender", value: displayGender || "N/A" },
    ...frontFields.slice(0, 2).map((field) => ({
      label: field.label,
      value: getCustomFieldDisplayValue(field.label),
    })),
  ].filter(Boolean);
  const imagePlaceholder = (label = "Image") => {
    const safeLabel = String(label).slice(0, 16);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420"><rect width="320" height="420" rx="24" fill="#f1f5f9"/><rect x="26" y="26" width="268" height="368" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/><circle cx="160" cy="158" r="52" fill="#cbd5e1"/><path d="M72 330c20-58 56-86 88-86s68 28 88 86" fill="#cbd5e1"/><text x="160" y="378" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#64748b">${safeLabel}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };
  const imageFallback = (rawUrl, label) => (event) => {
    const img = event.currentTarget;
    if (!rawUrl || img.dataset.directFallback === "true") {
      img.removeAttribute("crossorigin");
      img.src = imagePlaceholder(label);
      return;
    }
    img.dataset.directFallback = "true";
    img.removeAttribute("crossorigin");
    img.src = rawUrl;
  };

  // Unique suffix for SVG gradient IDs – prevents collisions when
  // multiple card instances exist in the DOM simultaneously
  const uid = useId().replace(/:/g, "");

  if (template !== "__legacy") {
    return (
      <div ref={ref} className="flex flex-col items-center gap-5">
        {showFront && (
          <div
            className="relative overflow-hidden border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
            style={{
              width: `${cardWidth}px`,
              height: `${cardHeight}px`,
              borderRadius: `${cardRadius}px`,
              color: primaryTextColor,
              fontFamily: resolvedFontFamily,
              backgroundColor: cs.bgColor || "#ffffff",
            }}
          >
            {renderGradientGeometry(false)}

            <div className="relative flex h-full flex-col px-7 py-6">
              <header className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-4 border-b border-white/45 pb-3">
                <div className="flex justify-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {logoUrl ? (
                      <img
                        src={logoSrc}
                        alt={`${orgName || "Organization"} logo`}
                        className="max-h-10 max-w-10 object-contain"
                        crossOrigin="anonymous"
                        onError={imageFallback(logoUrl, orgInitial)}
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-sm font-black text-white"
                        style={{
                          background: `linear-gradient(135deg, ${gc.start}, ${gc.end})`,
                          color: "#ffffff",
                        }}
                      >
                        {orgInitial}
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-w-0 text-center">
                  <p className="truncate text-xl font-black leading-tight" style={{ color: primaryTextColor }}>
                    {orgDisplayName}
                  </p>
                  <p
                    className="mt-1 font-black uppercase tracking-[0.26em]"
                    style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize)}px` }}
                  >
                    Digital Identity Card
                  </p>
                </div>

                <div />
              </header>

              <main className="grid flex-1 grid-cols-[144px_minmax(0,1fr)] items-stretch gap-5 py-4">
                <section
                  className="flex min-h-0 flex-col items-center justify-center rounded-xl border border-slate-200 p-3 shadow-sm"
                  style={{ background: panelBg }}
                >
                  <div
                    className="overflow-hidden rounded-xl border-[3px] border-white bg-slate-100 shadow-md ring-1 ring-slate-300"
                    style={{ width: `${photoWidth}px`, height: `${photoHeight}px` }}
                  >
                    {photo_url ? (
                      <img
                        src={photoSrc}
                        alt={`${name} profile`}
                        className="h-full w-full object-cover"
                        crossOrigin="anonymous"
                        onError={imageFallback(photo_url, "No Photo")}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-100 to-slate-200 text-center text-xs font-semibold text-slate-500">
                        No Photo
                      </div>
                    )}
                  </div>
                  {fv.role !== false && (
                    <div
                      className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center"
                      style={{ background: softPanelBg }}
                    >
                      <p
                        className="font-black uppercase tracking-[0.18em]"
                        style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                      >
                        Role
                      </p>
                      <p
                        className="truncate font-black uppercase"
                        style={{ color: accentColor, fontSize: `${Math.max(10, valueFontSize - 3)}px` }}
                      >
                        {displayRole}
                      </p>
                    </div>
                  )}
                </section>

                <div className="flex min-w-0 flex-col justify-center">
                  <section
                    className="flex h-full flex-col justify-center rounded-xl border border-slate-200 p-4 shadow-sm"
                    style={{ background: panelBg }}
                  >
                    <p
                      className="font-black uppercase tracking-[0.22em]"
                      style={{ color: accentColor, fontSize: `${labelFontSize}px` }}
                    >
                      Full Name
                    </p>
                    <h3
                      className="mt-1 break-words font-black leading-tight"
                      style={{ color: primaryTextColor, fontSize: `${nameFontSize}px` }}
                    >
                      {displayName}
                    </h3>

                    <div
                      className="mt-4 rounded-lg border px-4 py-2.5"
                      style={{
                        background: fullGradientBg ? "rgba(255,255,255,0.82)" : `${accentColor}12`,
                        borderColor: `${accentColor}2e`,
                      }}
                    >
                      <p
                        className="font-black uppercase tracking-[0.2em]"
                        style={{ color: accentColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                      >
                        Member ID
                      </p>
                      <p
                        className="mt-1 font-black tracking-[0.09em]"
                        style={{
                          color: primaryTextColor,
                          fontFamily: membershipIdFontFamily,
                          fontSize: `${Math.max(15, valueFontSize + 4)}px`,
                        }}
                      >
                        {displayMembershipId}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {frontDetailItems.slice(0, 4).map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-slate-200 px-3 py-2"
                          style={{ background: softPanelBg }}
                        >
                          <p
                            className="font-black uppercase tracking-[0.14em]"
                            style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                          >
                            {uppercaseLatinOnly(item.label)}
                          </p>
                          <p
                            className="mt-0.5 truncate font-black"
                            style={{ color: primaryTextColor, fontSize: `${Math.max(10, valueFontSize - 2)}px` }}
                          >
                            {item.value}
                          </p>
                        </div>
                      ))}
                      {frontDetailItems.length === 0 && (
                        <div className="col-span-2 h-12 rounded-lg border border-slate-200 bg-slate-50" />
                      )}
                    </div>
                  </section>
                </div>
              </main>

              <footer className="grid grid-cols-2 items-center border-t border-white/45 pt-2.5">
                <span
                  className="truncate font-bold uppercase tracking-[0.14em]"
                  style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                >
                  {displayValidityText}
                </span>
                <span
                  className="text-right font-black uppercase tracking-[0.14em]"
                  style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                >
                  Verify on back
                </span>
              </footer>
            </div>
          </div>
        )}

        {showBackSide && (
          <div
            className="relative overflow-hidden border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
            style={{
              width: `${cardWidth}px`,
              height: `${cardHeight}px`,
              borderRadius: `${cardRadius}px`,
              fontFamily: resolvedFontFamily,
              color: primaryTextColor,
              backgroundColor: cs.bgColor || "#ffffff",
            }}
          >
            {renderGradientGeometry(true)}
            <div className="relative flex h-full flex-col px-7 py-6">
              <header className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-4 border-b border-white/45 pb-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black"
                  style={{ color: accentColor }}
                >
                  {orgInitial}
                </div>
                <div className="min-w-0 text-center">
                  <p className="truncate text-lg font-black" style={{ color: primaryTextColor }}>
                    {orgDisplayName}
                  </p>
                  <p
                    className="mt-1 font-black uppercase tracking-[0.24em]"
                    style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                  >
                    Verification Details
                  </p>
                </div>
                <div />
              </header>

              <main className="grid flex-1 grid-cols-[minmax(0,1fr)_144px] items-stretch gap-5 py-4">
                <section
                  className="flex min-w-0 flex-col justify-center rounded-xl border border-slate-200 p-4 shadow-sm"
                  style={{ background: panelBg }}
                >
                  {fv.address && (
                    <div>
                      <p
                        className="font-black uppercase tracking-[0.2em]"
                        style={{ color: accentColor, fontSize: `${labelFontSize}px` }}
                      >
                        Address
                      </p>
                      <p
                        className="mt-1 line-clamp-3 font-semibold leading-relaxed"
                        style={{ color: primaryTextColor, fontSize: `${Math.max(10, valueFontSize - 2)}px` }}
                      >
                        {displayAddress}
                      </p>
                    </div>
                  )}

                  <div className="my-4 h-px bg-slate-200" />

                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="col-span-2 rounded-lg border border-slate-200 px-3 py-2"
                      style={{ background: softPanelBg }}
                    >
                      <p
                        className="font-black uppercase tracking-[0.16em]"
                        style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                      >
                        Issuing Authority
                      </p>
                      <p
                        className="mt-0.5 truncate font-black"
                        style={{ color: primaryTextColor, fontSize: `${valueFontSize}px` }}
                      >
                        {orgDisplayName}
                      </p>
                    </div>
                    {backFields.slice(0, 3).map((f) => (
                      <div
                        key={f.label}
                        className="rounded-lg border border-slate-200 px-3 py-2"
                        style={{ background: softPanelBg }}
                      >
                        <p
                          className="font-black uppercase tracking-[0.14em]"
                          style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                        >
                          {uppercaseLatinOnly(f.label)}
                        </p>
                        <p
                          className="mt-0.5 truncate font-black"
                          style={{ color: primaryTextColor, fontSize: `${Math.max(10, valueFontSize - 2)}px` }}
                        >
                          {getCustomFieldDisplayValue(f.label)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section
                  className="flex flex-col items-center justify-center rounded-xl border p-3"
                  style={{
                    background: fullGradientBg ? "rgba(255,255,255,0.78)" : `${accentColor}12`,
                    borderColor: `${accentColor}2e`,
                  }}
                >
                  <div className="flex h-[122px] w-[122px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <QRCodeCanvas
                      value={verificationUrl}
                      size={108}
                      level="H"
                      marginSize={1}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <p
                    className="mt-2 text-center font-bold uppercase tracking-[0.16em]"
                    style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                  >
                    Scan for verification
                  </p>
                  <p
                    className="mt-2 max-w-full truncate text-center font-bold uppercase tracking-[0.08em]"
                    style={{ color: accentColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                  >
                    {displayMembershipId}
                  </p>
                </section>
              </main>

              <footer className="grid grid-cols-2 items-center border-t border-white/45 pt-2.5">
                <span
                  className="truncate font-bold uppercase tracking-[0.14em]"
                  style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                >
                  {orgDisplayName}
                </span>
                <span
                  className="truncate text-right font-bold uppercase tracking-[0.1em]"
                  style={{ color: subtleTextColor, fontSize: `${Math.max(7, labelFontSize - 1)}px` }}
                >
                  {verificationPath}
                </span>
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  }

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
