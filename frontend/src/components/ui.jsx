const cx = (...classes) => classes.filter(Boolean).join(" ");

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) {
  const variants = {
    primary:
      "bg-cyan-300 text-black hover:bg-white shadow-sm shadow-cyan-300/20",
    secondary:
      "bg-zinc-800 text-zinc-200 border border-white/12 hover:bg-zinc-700",
    dark: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
    danger:
      "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20",
    ghost: "text-zinc-400 hover:text-cyan-300 hover:bg-cyan-300/5",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  };

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="block text-xs font-semibold text-zinc-300">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={cx(
        "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-cyan-300 focus:bg-zinc-900 focus:ring-2 focus:ring-cyan-300/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={cx(
        "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 focus:bg-zinc-900 focus:ring-2 focus:ring-cyan-300/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function StatusBadge({ children, tone = "slate", className = "" }) {
  const tones = {
    slate: "border-zinc-700 bg-zinc-800 text-zinc-300",
    blue: "border-cyan-300/20 bg-cyan-300/10 text-cyan-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    red: "border-red-500/20 bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-zinc-500">{icon}</div>}
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-zinc-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
