import { forwardRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { proxyImageUrl } from "../lib/proxyImage";

/**
 * StudentCard – Academic Institution Identity Card
 * Matches real college ID card format (reference: Cochin University style).
 *
 * FRONT (vertical): Logo → Org Name → Photo → Name → Student ID → Program → Blood Group → Custom fields
 * FRONT (horizontal): Photo LEFT → Details RIGHT (Name, Student ID, DOB, Gender, Blood Group) → ID at bottom
 * BACK (both): "PERSONAL DETAILS" → Address, DOB, custom fields → QR Code → Validity → Signature line
 */
const StudentCard = forwardRef(function StudentCard(
  {
    data,
    showBack = false,
    orgName = "",
    logoUrl = "",
    customFields = [],
    watermark = {},
    renderSide,
    gradientColors = { start: "#f97316", end: "#9333ea" },
    cardStyles = {
      bgColor: "#ffffff",
      fontColor: "#1e293b",
      fontFamily: "'Public Sans', sans-serif",
      accentColor: "#64748b",
      borderRadius: 12,
    },
    orientation = "horizontal",
    validityText = "Valid for current academic session",
    fieldVisibility = {
      dob: true,
      gender: true,
      blood_group: true,
      role: true,
      address: true,
    },
    signatureUrl = "",
  },
  ref,
) {
  const {
    name = "Full Name",
    role = "Student",
    id_number = "0000 0000 0000",
    dob = "01/01/2000",
    gender = "N/A",
    blood_group = "",
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
          className={`relative ${isVertical ? "w-80" : "w-125"} shadow-2xl overflow-hidden ring-1 ring-slate-900/5`}
          style={{
            aspectRatio: isVertical ? "53.98 / 85.6" : "85.6 / 53.98",
            backgroundColor: cs.bgColor,
            fontFamily: cs.fontFamily,
            borderRadius: `${cs.borderRadius}px`,
          }}
        >
          {/* Background */}
          <div className="absolute inset-0 z-0">
            <div
              className="absolute top-0 left-0 w-full h-2"
              style={{
                background: `linear-gradient(to right, ${gc.start}, ${gc.end})`,
              }}
            />
            <div
              className="absolute -top-16 -right-16 w-72 h-72 rounded-full"
              style={{
                background: `radial-gradient(circle, ${gc.start}26 0%, ${gc.start}10 40%, transparent 70%)`,
              }}
            />
            <div
              className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full"
              style={{
                background: `radial-gradient(circle, ${gc.end}1a 0%, ${gc.end}0d 40%, transparent 70%)`,
              }}
            />
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

          {/* ── FRONT CONTENT ── */}
          {isVertical ? (
            /* ━━━ VERTICAL FRONT ━━━ */
            <div className="absolute inset-0 flex flex-col items-center z-10 pt-4 pb-3 px-5">
              {/* Logo + Org Name */}
              <div className="flex flex-col items-center gap-1.5 mb-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-12 h-12 object-contain rounded-lg"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-linear-to-br from-orange-400 to-purple-600 flex items-center justify-center text-white shadow-md">
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                    </svg>
                  </div>
                )}
                <h2
                  className="text-center font-bold uppercase leading-tight"
                  style={{
                    color: cs.fontColor,
                    fontSize: `${(cs.nameFontSize || 20) - 6}px`,
                  }}
                >
                  {orgName || "Academy"}
                </h2>
              </div>

              {/* Photo */}
              <div className="w-24 h-28 shrink-0 mb-2">
                {photo_url ? (
                  <img
                    src={photoSrc}
                    alt={name}
                    className="w-full h-full object-cover rounded-lg shadow-md border-2 border-white ring-1 ring-orange-400/20"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg shadow-md border-2 border-white ring-1 ring-orange-400/20 bg-linear-to-br from-orange-50 to-purple-50 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-orange-300"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Name */}
              <h3
                className="font-bold text-center leading-snug"
                style={{
                  color: cs.fontColor,
                  fontSize: `${cs.nameFontSize || 20}px`,
                }}
              >
                {name}
              </h3>

              {/* Student ID */}
              <p
                className="text-center mt-1"
                style={{ fontSize: `${cs.valueFontSize || 14}px` }}
              >
                <span
                  className="text-slate-400 uppercase font-semibold"
                  style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                >
                  Student Id:{" "}
                </span>
                <span className="font-semibold" style={{ color: gc.start }}>
                  {id_number}
                </span>
              </p>

              {/* Program / Role */}
              {fv.role && (
                <p
                  className="text-center font-semibold mt-0.5"
                  style={{
                    color: cs.fontColor,
                    fontSize: `${(cs.valueFontSize || 14) - 2}px`,
                  }}
                >
                  {role}
                </p>
              )}

              {/* Blood Group */}
              {fv.blood_group && blood_group && (
                <p
                  className="text-center mt-0.5"
                  style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                >
                  <span
                    className="text-slate-400 uppercase font-semibold"
                    style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                  >
                    Blood Group:{" "}
                  </span>
                  <span className="font-bold" style={{ color: gc.end }}>
                    {blood_group}
                  </span>
                </p>
              )}

              {/* Custom front fields */}
              {frontFields.length > 0 &&
                frontFields.map((f) => (
                  <p
                    key={f.label}
                    className="text-center mt-0.5"
                    style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                  >
                    <span
                      className="text-slate-400 uppercase font-semibold"
                      style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                    >
                      {f.label}:{" "}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {customValues[f.label] || "—"}
                    </span>
                  </p>
                ))}
            </div>
          ) : (
            /* ━━━ HORIZONTAL FRONT (Aadhaar-style) ━━━ */
            <div className="absolute top-5 left-6 right-6 bottom-4 flex flex-col z-10">
              {/* Header: Logo + Org Name */}
              <div className="flex items-center gap-2 mb-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-8 h-8 object-contain rounded"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-orange-400 to-purple-600 flex items-center justify-center text-white shadow-sm">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-bold text-slate-800">
                    {orgName || "Academy"}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">
                    Student Identity Card
                  </span>
                </div>
              </div>

              {/* Top row: Photo LEFT + Details RIGHT */}
              <div className="flex-1 flex flex-row gap-5 items-start">
                <div className="w-28 h-32 shrink-0 relative">
                  {photo_url ? (
                    <img
                      src={photoSrc}
                      alt={name}
                      className="w-full h-full object-cover rounded-lg shadow-md border-2 border-white ring-1 ring-orange-400/20"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full rounded-lg shadow-md border-2 border-white ring-1 ring-orange-400/20 bg-linear-to-br from-orange-50 to-purple-50 flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-orange-300"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Details – stacked vertically */}
                <div className="flex-1 flex flex-col justify-center space-y-1.5 min-w-0">
                  <h3
                    className="font-bold leading-snug"
                    style={{
                      color: cs.fontColor,
                      fontSize: `${cs.nameFontSize || 20}px`,
                    }}
                  >
                    {name}
                  </h3>
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
                  {fv.blood_group && blood_group && (
                    <p
                      className="text-slate-700"
                      style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                    >
                      <span
                        className="text-slate-400 uppercase font-semibold"
                        style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                      >
                        Blood Group:{" "}
                      </span>
                      <span className="font-bold" style={{ color: gc.end }}>
                        {blood_group}
                      </span>
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
          )}
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
          <div
            className="absolute top-0 left-0 w-full h-2"
            style={{
              background: `linear-gradient(to right, ${gc.start}, ${gc.end})`,
            }}
          />

          <div className="absolute inset-0 p-6 pt-5 flex flex-col z-10">
            {/* PERSONAL DETAILS heading */}
            <div className="text-center mb-3 mt-1">
              <h4
                className="text-xs font-bold uppercase tracking-widest border-b border-slate-300 pb-1 inline-block"
                style={{ color: cs.fontColor }}
              >
                Personal Details
              </h4>
            </div>

            <div
              className={`flex-1 flex ${isVertical ? "flex-col gap-3" : "gap-6"}`}
            >
              {/* Details column */}
              <div className={`${isVertical ? "" : "flex-1"} space-y-2.5`}>
                {/* Address */}
                {fv.address && (
                  <div>
                    <p
                      className="text-slate-700"
                      style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                    >
                      <span
                        className="text-slate-400 uppercase font-semibold"
                        style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                      >
                        Address:{" "}
                      </span>
                      <span className="font-medium text-slate-600">
                        {address || "Address not provided"}
                      </span>
                    </p>
                  </div>
                )}

                {/* DOB */}
                {fv.dob && (
                  <p
                    className="text-slate-700"
                    style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                  >
                    <span
                      className="text-slate-400 uppercase font-semibold"
                      style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                    >
                      DOB:{" "}
                    </span>
                    <span className="font-semibold">{dob}</span>
                  </p>
                )}

                {/* Custom back fields */}
                {backFields.length > 0 &&
                  backFields.map((f) => (
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

                {/* Validity */}
                <p
                  className="text-slate-700"
                  style={{ fontSize: `${cs.valueFontSize || 14}px` }}
                >
                  <span
                    className="text-slate-400 uppercase font-semibold"
                    style={{ fontSize: `${cs.labelFontSize || 9}px` }}
                  >
                    Valid up to:{" "}
                  </span>
                  <span className="font-semibold">{validityText}</span>
                </p>
              </div>

              {/* QR Code column */}
              <div
                className={`${isVertical ? "w-full" : "w-32"} flex flex-col justify-center items-center`}
              >
                <div className="w-24 h-24 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-center">
                  <QRCodeCanvas value={id_number} size={80} level="M" />
                </div>
                <span className="text-[9px] text-slate-400 mt-1.5 text-center">
                  Admission No.
                </span>
              </div>
            </div>

            {/* Footer: Signature line */}
            <div className="flex items-end justify-between mt-auto pt-2 border-t border-slate-100">
              <span className="text-[8px] text-slate-400">
                {orgName || "aarannu"}
              </span>
              {signatureUrl ? (
                <div className="text-center">
                  <img
                    src={signatureUrl}
                    alt="Registrar"
                    className="h-6 object-contain mb-0.5"
                    crossOrigin="anonymous"
                  />
                  <span className="text-[7px] text-slate-500 font-medium block">
                    Registrar
                  </span>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-24 border-t border-slate-400 mb-0.5" />
                  <span className="text-[8px] text-slate-500 font-medium">
                    Signature of the Student
                  </span>
                </div>
              )}
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

export default StudentCard;
