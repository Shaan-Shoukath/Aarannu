import { Link } from "react-router-dom";
import BrandLogoLink from "./BrandLogoLink";

const TONE_STYLES = {
  pending: {
    iconBg: "bg-amber-100",
    iconFg: "text-amber-600",
    primary:
      "bg-[#2563EB] text-white hover:bg-[#2563EB]/90 shadow-lg shadow-[#2563EB]/20",
  },
  blocked: {
    iconBg: "bg-slate-100",
    iconFg: "text-slate-600",
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10",
  },
  error: {
    iconBg: "bg-red-100",
    iconFg: "text-red-600",
    primary:
      "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20",
  },
};

function StatusIcon({ tone }) {
  if (tone === "error") {
    return (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.29 3.86l-7.5 13A1.5 1.5 0 0 0 4.09 19.5h15.82a1.5 1.5 0 0 0 1.3-2.64l-7.5-13a1.5 1.5 0 0 0-2.6 0Z"
        />
      </svg>
    );
  }

  if (tone === "blocked") {
    return (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-1.5 0h12A1.5 1.5 0 0 1 19.5 12v7.5A1.5 1.5 0 0 1 18 21H6A1.5 1.5 0 0 1 4.5 19.5V12A1.5 1.5 0 0 1 6 10.5Z"
        />
      </svg>
    );
  }

  return (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 6v6l3.75 3.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function Action({ label, to, onClick, primary = false, className = "" }) {
  if (!label) return null;

  const baseClassName = primary
    ? "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition"
    : "inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50";
  const resolvedClassName = `${baseClassName} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={resolvedClassName}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={resolvedClassName}>
      {label}
    </button>
  );
}

export default function AccessStatusScreen({
  title,
  message,
  details = "",
  tone = "pending",
  primaryLabel,
  primaryTo,
  primaryAction,
  secondaryLabel,
  secondaryTo,
  secondaryAction,
}) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.pending;
  const primaryClassName = styles.primary;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-['Public_Sans',sans-serif] p-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <BrandLogoLink
          className="mx-auto mb-8"
          imageClassName="h-14 w-auto"
          showText={false}
        />

        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${styles.iconBg} ${styles.iconFg}`}
        >
          <StatusIcon tone={tone} />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        {details && <p className="mt-3 text-xs leading-5 text-slate-400">{details}</p>}

        <div className="mt-8 flex flex-col gap-3">
          <Action
            label={primaryLabel}
            to={primaryTo}
            onClick={primaryAction}
            primary
            className={primaryClassName}
          />
          <Action
            label={secondaryLabel}
            to={secondaryTo}
            onClick={secondaryAction}
          />
        </div>
      </div>
    </div>
  );
}
