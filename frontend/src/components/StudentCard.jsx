import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { proxyImageUrl } from "../lib/proxyImage";

/**
 * StudentCard – Modern Academic Vertical-ish template
 * Bright gradient card for educational institutions.
 */
const StudentCard = forwardRef(function StudentCard(
  {
    data,
    showBack = false,
    orgName = "",
    logoUrl = "",
    customFields = [],
    watermark = {},
  },
  ref,
) {
  const {
    name = "Full Name",
    role = "Student",
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

  return (
    <div ref={ref} className="flex flex-col items-center gap-8">
      {/* ═══ FRONT ═══ */}
      <div
        className="relative w-125 bg-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5"
        style={{ aspectRatio: "85.6 / 53.98" }}
      >
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-orange-400 via-pink-500 to-purple-600" />
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-linear-to-bl from-orange-400/15 via-pink-400/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-linear-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl" />
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
        <div className="absolute top-5 left-6 right-6 flex items-center gap-3 z-10">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="w-10 h-10 object-contain rounded-lg"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-orange-400 to-purple-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
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

        {/* Content */}
        <div className="absolute top-18 left-6 right-6 bottom-5 flex gap-5 z-10">
          <div className="w-26 h-30 shrink-0 relative mt-1">
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
          <div className="flex-1 flex flex-col justify-center space-y-2.5">
            <div>
              <h3 className="text-lg font-bold text-slate-800">{name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-linear-to-r from-orange-100 to-purple-100 text-purple-700 border border-purple-200/50">
                  {role}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              <div>
                <p className="text-[8px] text-slate-400 uppercase font-semibold">
                  DOB
                </p>
                <p className="text-[11px] font-semibold text-slate-700">
                  {dob}
                </p>
              </div>
              <div>
                <p className="text-[8px] text-slate-400 uppercase font-semibold">
                  Gender
                </p>
                <p className="text-[11px] font-semibold text-slate-700">
                  {gender}
                </p>
              </div>
            </div>
            <div className="pt-1.5 border-t border-slate-100">
              <p className="text-[8px] text-slate-400 uppercase font-semibold mb-0.5">
                Student ID
              </p>
              <p className="text-base font-mono font-bold bg-linear-to-r from-orange-500 to-purple-600 bg-clip-text text-transparent tracking-widest">
                {id_number}
              </p>
            </div>
            {frontFields.length > 0 && (
              <div className="grid grid-cols-2 gap-y-1 gap-x-4 mt-1">
                {frontFields.map((f) => (
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
        </div>
      </div>

      {/* ═══ BACK ═══ */}
      {showBack && (
        <div
          className="relative w-125 bg-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5"
          style={{ aspectRatio: "85.6 / 53.98" }}
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-orange-400 via-pink-500 to-purple-600" />
          <div className="absolute inset-0 p-6 pt-5 flex flex-col z-10">
            <div className="flex-1 flex gap-6 mt-2">
              <div className="flex-1 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide border-b border-orange-400/30 pb-1 inline-block">
                    Address
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    {address || "Address not provided"}
                  </p>
                </div>
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wide border-b border-orange-400/30 pb-1 inline-block">
                    Institution
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                    {orgName || "Academy"}
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
              <div className="w-32 flex flex-col justify-center items-end">
                <div className="w-28 h-28 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-center">
                  <QRCodeSVG value={id_number} size={96} level="M" />
                </div>
                <span className="text-[9px] text-slate-400 mt-2 text-right">
                  Scan to verify
                </span>
              </div>
            </div>
            <div className="h-6 border-t border-slate-100 flex items-center justify-between mt-auto">
              <span className="text-[8px] text-slate-400">
                {orgName || "aarannu"}
              </span>
              <span className="text-[8px] text-slate-400">
                Valid for current academic session
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

export default StudentCard;
