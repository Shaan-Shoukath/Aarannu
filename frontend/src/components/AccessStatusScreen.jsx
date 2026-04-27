import { Link } from "react-router-dom";
import BrandLogoLink from "./BrandLogoLink";

const TONE_STYLES = {
  pending: {
    iconBg: "bg-amber-900/30",
    iconFg: "text-amber-300",
    primary:
      "bg-cyan-300 text-black font-bold hover:bg-white shadow-lg shadow-cyan-300/20",
  },
  blocked: {
    iconBg: "bg-zinc-800",
    iconFg: "text-zinc-300",
    primary:
      "bg-zinc-700 text-white font-bold hover:bg-zinc-600 shadow-lg",
  },
  error: {
    iconBg: "bg-red-900/30",
    iconFg: "text-red-400",
    primary:
      "bg-red-500 text-white font-bold hover:bg-red-400 shadow-lg shadow-red-500/20",
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
    : "inline-flex items-center justify-center rounded-lg border border-white/12 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10";
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
    <div className="min-h-screen flex items-center justify-center bg-black font-['Public_Sans',sans-serif] px-4 py-8 sm:p-8">
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-white/12 bg-zinc-950 p-6 sm:p-8 text-center shadow-xl shadow-black/60">
        <BrandLogoLink
          className="mx-auto mb-6 sm:mb-8"
          imageClassName="h-12 sm:h-14 w-auto"
          showText={false}
        />

        <div
          className={`mx-auto mb-4 sm:mb-5 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full ${styles.iconBg} ${styles.iconFg}`}
        >
          <StatusIcon tone={tone} />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{message}</p>
        {details && <p className="mt-3 text-xs leading-5 text-zinc-500">{details}</p>}

        <div className="mt-6 sm:mt-8 flex flex-col gap-3">
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
