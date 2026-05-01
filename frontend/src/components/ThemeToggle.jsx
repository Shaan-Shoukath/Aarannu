import { useTheme } from "../contexts/useTheme";

export default function ThemeToggle({
  className = "",
  compact = false,
  variant = "inline",
}) {
  const { isLightTheme, toggleTheme } = useTheme();
  const label = isLightTheme ? "Switch to dark theme" : "Switch to light theme";

  const variantClass =
    variant === "floating"
      ? "fixed bottom-4 right-4 z-50 shadow-2xl"
      : "shadow-sm";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition focus:outline-none focus:ring-4 ${variantClass} ${className}`}
      aria-label={label}
      title={label}
    >
      {isLightTheme ? (
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          />
        </svg>
      ) : (
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      )}
      {!compact && (
        <span className="hidden sm:inline">{isLightTheme ? "Dark" : "Light"}</span>
      )}
    </button>
  );
}
