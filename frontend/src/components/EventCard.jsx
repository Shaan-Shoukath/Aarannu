import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
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

  return (
    <div ref={ref} className="flex flex-col items-center gap-8">
      {/* ═══ FRONT ═══ */}
      <div
        className="relative w-125 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10"
        style={{
          aspectRatio: "85.6 / 53.98",
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e1b4b 100%)",
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-amber-500/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-linear-to-tr from-purple-500/20 to-transparent rounded-full blur-2xl" />
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-amber-400 via-yellow-300 to-amber-400 opacity-80" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-amber-400 via-yellow-300 to-amber-400 opacity-40" />
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
        <div className="absolute top-16 left-6 right-6 bottom-6 flex gap-6 z-10">
          <div className="w-28 h-32 shrink-0 relative">
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
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div>
              <h3 className="text-xl font-bold text-white">{name}</h3>
              {dob && (
                <p className="text-[10px] text-indigo-300 font-medium mt-0.5">
                  DOB: {dob}
                </p>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-indigo-500/30">
              <p className="text-[9px] text-indigo-400 uppercase font-semibold mb-0.5">
                Pass ID
              </p>
              <p className="text-lg font-mono font-bold text-amber-300 tracking-widest">
                {id_number}
              </p>
            </div>
            {frontFields.length > 0 && (
              <div className="grid grid-cols-2 gap-y-1 gap-x-4 mt-1">
                {frontFields.map((f) => (
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
        </div>
      </div>

      {/* ═══ BACK ═══ */}
      {showBack && (
        <div
          className="relative w-125 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10"
          style={{
            aspectRatio: "85.6 / 53.98",
            background:
              "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e1b4b 100%)",
          }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-amber-400 via-yellow-300 to-amber-400 opacity-60" />
          <div className="absolute inset-0 p-6 flex flex-col z-10">
            <div className="flex-1 flex gap-6">
              <div className="flex-1 space-y-4">
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
              <div className="w-32 flex flex-col justify-center items-end">
                <div className="w-28 h-28 bg-white p-2 rounded-lg shadow-sm flex items-center justify-center">
                  <QRCodeSVG value={id_number} size={96} level="M" />
                </div>
                <span className="text-[9px] text-indigo-400 mt-2 text-right">
                  Scan for entry
                </span>
              </div>
            </div>
            <div className="h-6 border-t border-indigo-500/30 flex items-center justify-between mt-auto">
              <span className="text-[8px] text-indigo-400">
                {orgName || "aarannu"}
              </span>
              <span className="text-[8px] text-indigo-400">
                Valid for event duration only
              </span>
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
