import { Link } from "react-router-dom";

export default function BrandLogoLink({
  to = "/",
  className = "",
  imageClassName = "h-10 w-auto",
  textClassName = "text-2xl font-bold text-white tracking-tight",
  showText = true,
  label = "Aarannu",
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 transition-opacity hover:opacity-90 ${className}`}
      aria-label={`${label} home`}
    >
      {/* Squircle wrapper — rounded-[22%] mimics iOS superellipse / squircle shape */}
      <span
        className="inline-flex shrink-0 overflow-hidden rounded-[22%]"
        style={{ lineHeight: 0 }}
      >
        <img
          src="/aarannu.png"
          alt={showText ? "" : label}
          className={imageClassName}
        />
      </span>
      {showText && <span className={textClassName}>{label}</span>}
    </Link>
  );
}
