import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
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

  return (
    <div ref={ref} className="flex flex-col items-center gap-8">
      {/* ═══════════════════════════════════════════
          FRONT SIDE
          ═══════════════════════════════════════════ */}
      <div
        className="relative w-125 bg-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5"
        style={{ aspectRatio: "85.6 / 53.98" }}
      >
        {/* Geometric Background */}
        <div className="absolute inset-0 z-0">
          {/* Top-right gradient blob */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-linear-to-bl from-[#1152d4] to-blue-600 rounded-full blur-2xl opacity-20" />
          {/* Top-right triangle */}
          <div className="absolute top-0 right-0 w-40 h-40">
            <svg
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="idcard-grad-front-tr"
                  x1="0"
                  y1="0"
                  x2="100"
                  y2="100"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#1152d4" />
                  <stop offset="1" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <path
                d="M0 0H100V100L50 50L0 0Z"
                fill="url(#idcard-grad-front-tr)"
                fillOpacity="0.9"
              />
            </svg>
          </div>
          {/* Bottom-left gradient blob */}
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-linear-to-tr from-red-500 to-orange-400 rounded-full blur-2xl opacity-10" />
          {/* Bottom-left triangle */}
          <div className="absolute bottom-0 left-0 w-32 h-32 rotate-180">
            <svg
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="idcard-grad-front-bl"
                  x1="0"
                  y1="0"
                  x2="100"
                  y2="100"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#1152d4" />
                  <stop offset="1" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <path
                d="M0 0H100V100L50 50L0 0Z"
                fill="url(#idcard-grad-front-bl)"
                fillOpacity="0.8"
              />
            </svg>
          </div>
        </div>

        {/* Hologram overlay */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-white/20 z-20 opacity-30 mix-blend-overlay pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)",
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
        <div className="absolute top-4 left-6 right-6 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#1152d4] to-blue-800 flex items-center justify-center text-white shadow-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold text-[#1152d4] uppercase tracking-wide">
              Community ID
            </span>
            <span className="text-[8px] text-slate-500 font-medium">
              Digital Identity Card
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="absolute top-16 left-6 right-6 bottom-6 flex gap-6 z-10">
          {/* Photo */}
          <div className="w-28 h-32 shrink-0 relative">
            {photo_url ? (
              <img
                src={photoSrc}
                alt={`${name} profile`}
                className="w-full h-full object-cover rounded-md shadow-md border-2 border-white ring-1 ring-[#1152d4]/20"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full rounded-md shadow-md border-2 border-white ring-1 ring-[#1152d4]/20 bg-slate-100 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-slate-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
            <div className="absolute bottom-0 w-full bg-black/50 backdrop-blur-[1px] text-center py-0.5 rounded-b-md">
              <span className="text-[8px] text-white font-mono">VERIFIED</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div>
              <h3 className="text-xl font-bold text-slate-800">{name}</h3>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mt-0.5">
                {role}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div>
                <p className="text-[9px] text-slate-400 uppercase font-semibold">
                  Date of Birth
                </p>
                <p className="text-xs font-semibold text-slate-700">{dob}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 uppercase font-semibold">
                  Gender
                </p>
                <p className="text-xs font-semibold text-slate-700">{gender}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-[9px] text-slate-400 uppercase font-semibold mb-0.5">
                ID Number
              </p>
              <p className="text-lg font-mono font-bold text-[#1152d4] tracking-widest">
                {id_number}
              </p>
            </div>
            {/* Front custom fields */}
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

      {/* ═══════════════════════════════════════════
          BACK SIDE (optional)
          ═══════════════════════════════════════════ */}
      {showBack && (
        <div
          className="relative w-125 bg-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5"
          style={{ aspectRatio: "85.6 / 53.98" }}
        >
          {/* Background  */}
          <div className="absolute inset-0 z-0 opacity-50">
            <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-[#1152d4] via-red-500 to-[#1152d4]" />
            <div className="absolute bottom-0 right-0 w-40 h-40 rotate-90">
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient
                    id="idcard-grad-back"
                    x1="0"
                    y1="0"
                    x2="100"
                    y2="100"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#1152d4" />
                    <stop offset="1" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 0H100V100L50 50L0 0Z"
                  fill="url(#idcard-grad-back)"
                  fillOpacity="0.1"
                />
              </svg>
            </div>
          </div>

          <div className="absolute inset-0 p-6 flex flex-col z-10">
            <div className="flex-1 flex gap-6">
              {/* Address block */}
              <div className="flex-1 space-y-4">
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
              <div className="w-32 flex flex-col justify-center items-end">
                <div className="w-28 h-28 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-center">
                  <QRCodeSVG value={id_number} size={96} level="M" />
                </div>
                <span className="text-[9px] text-slate-400 mt-2 text-right">
                  Scan for verification
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="h-6 border-t border-slate-100 flex items-center justify-between mt-auto">
              <span className="text-[8px] text-slate-400">
                community-id-platform
              </span>
              <span className="text-[8px] text-slate-400">
                Valid for 15 days from issue
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
