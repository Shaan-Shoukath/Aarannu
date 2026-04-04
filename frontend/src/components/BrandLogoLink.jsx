import { Link } from "react-router-dom";

export default function BrandLogoLink({
  to = "/",
  className = "",
  imageClassName = "h-10 w-auto",
  textClassName = "text-2xl font-bold text-slate-900 tracking-tight",
  showText = true,
  label = "Aarannu",
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 transition-opacity hover:opacity-90 ${className}`}
      aria-label={`${label} home`}
    >
      <img
        src="/aarannu.png"
        alt={showText ? "" : label}
        className={imageClassName}
      />
      {showText && <span className={textClassName}>{label}</span>}
    </Link>
  );
}
