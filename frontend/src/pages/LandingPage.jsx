import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HolographicCardScene from "../components/HolographicCardScene";
import BrandLogoLink from "../components/BrandLogoLink";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../contexts/useAuth";
import { useTheme } from "../contexts/useTheme";

const benefits = [
  ["Easy import", "Bring members from Google Sheets without retyping."],
  ["Clear preview", "Check the card before generating the full batch."],
  ["QR verify", "Every issued card can be checked from a phone."],
];

const steps = [
  ["1", "Create your workspace"],
  ["2", "Choose a card template"],
  ["3", "Import or add members"],
  ["4", "Generate and verify IDs"],
];

export default function LandingPage() {
  const navigate = useNavigate();
  const accountMenuRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { user: sessionUser, displayName, signOut } = useAuth();
  const { theme, isLightTheme } = useTheme();

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handleClickOutside = (event) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuOpen]);

  const displayInitial = (displayName || sessionUser?.email || "U")
    .charAt(0)
    .toUpperCase();

  const isSignedIn = Boolean(sessionUser);
  const primaryCtaTo = isSignedIn ? "/dashboard" : "/signup";
  const primaryCtaLabel = isSignedIn ? "Go to Dashboard" : "Start Now";

  const themeClasses = isLightTheme
    ? {
        page: "bg-white text-zinc-950",
        header: "border-zinc-200 bg-white/95",
        logoText: "text-zinc-950",
        quietLink:
          "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus:ring-zinc-300",
        navPrimary:
          "bg-blue-600 text-white shadow-[0_0_24px_rgba(37,99,235,0.18)] hover:bg-zinc-950 focus:ring-blue-300/55",
        accountButton:
          "border-zinc-300 bg-white text-zinc-950 shadow-sm hover:border-blue-500 hover:bg-blue-50 focus:ring-blue-300/45",
        avatar: "bg-blue-600 text-white",
        userName: "text-zinc-950",
        mutedText: "text-zinc-600",
        chevron: "text-zinc-500",
        menu: "border-zinc-200 bg-white shadow-2xl shadow-zinc-900/12",
        menuBorder: "border-zinc-200",
        menuEyebrow: "text-zinc-500",
        menuAction:
          "text-zinc-800 hover:bg-blue-50 hover:text-blue-800 focus:ring-blue-300/45",
        menuSignOut:
          "text-zinc-600 hover:bg-rose-50 hover:text-rose-700 focus:ring-rose-300/45",
        themeButton:
          "border-zinc-300 bg-white text-zinc-800 shadow-sm hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800 focus:ring-blue-300/45",
        sectionBorder: "border-zinc-200",
        heroBg: "bg-white",
        gridOpacity: "opacity-[0.18]",
        scanOpacity: "opacity-[0.08]",
        badge: "border-blue-500/35 bg-blue-50 text-blue-950",
        heading: "text-zinc-950",
        bodyText: "text-zinc-700",
        primaryCta:
          "bg-zinc-950 text-white hover:bg-blue-700 focus:ring-blue-300/55",
        secondaryCta:
          "border-zinc-300 bg-white text-zinc-950 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-800 focus:ring-zinc-300",
        benefitCard: "border-zinc-200 bg-white shadow-sm shadow-zinc-900/5",
        benefitText: "text-zinc-700",
        workflowBg: "bg-zinc-50",
        workflowEyebrow: "text-rose-700",
        stepCard: "border-zinc-200 bg-white shadow-sm shadow-zinc-900/5",
        finalBand: "bg-white",
        finalCard: "border-zinc-200 bg-zinc-50",
        readyText: "text-amber-700",
        outlineCta:
          "border-zinc-300 text-zinc-950 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 focus:ring-zinc-300",
        footer: "border-zinc-200 bg-white",
        footerText: "text-zinc-600",
        footerLogoText: "text-zinc-950",
      }
    : {
        page: "bg-black text-white",
        header: "border-white/12 bg-black/90",
        logoText: "text-white",
        quietLink:
          "text-zinc-200 hover:bg-white/10 hover:text-white focus:ring-white/25",
        navPrimary:
          "bg-cyan-300 text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] hover:bg-white focus:ring-cyan-300/40",
        accountButton:
          "border-white/15 bg-zinc-950 text-white hover:border-cyan-300/60 hover:bg-white/10 focus:ring-cyan-300/30",
        avatar: "bg-cyan-300 text-black",
        userName: "text-white",
        mutedText: "text-zinc-400",
        chevron: "text-zinc-400",
        menu: "border-white/12 bg-zinc-950 shadow-2xl",
        menuBorder: "border-white/10",
        menuEyebrow: "text-zinc-500",
        menuAction:
          "text-white hover:bg-cyan-300/10 hover:text-cyan-200 focus:ring-cyan-300/40",
        menuSignOut:
          "text-zinc-400 hover:bg-rose-400/10 hover:text-rose-200 focus:ring-rose-300/40",
        themeButton:
          "border-white/15 bg-zinc-950 text-zinc-100 hover:border-cyan-300/60 hover:bg-white/10 hover:text-white focus:ring-cyan-300/30",
        sectionBorder: "border-white/12",
        heroBg: "bg-black",
        gridOpacity: "opacity-[0.12]",
        scanOpacity: "opacity-[0.12]",
        badge: "border-cyan-300/45 bg-black/80 text-cyan-100",
        heading: "text-white",
        bodyText: "text-zinc-200",
        primaryCta:
          "bg-white text-black hover:bg-cyan-200 focus:ring-cyan-300/40",
        secondaryCta:
          "border-white/28 bg-black/70 text-white hover:border-cyan-300 hover:text-cyan-100 focus:ring-white/25",
        benefitCard: "border-white/12 bg-black/75",
        benefitText: "text-zinc-300",
        workflowBg: "bg-black",
        workflowEyebrow: "text-rose-200",
        stepCard: "border-white/12 bg-zinc-950",
        finalBand: "bg-black",
        finalCard: "border-white/12 bg-zinc-950",
        readyText: "text-yellow-100",
        outlineCta:
          "border-white/28 text-white hover:border-rose-300 hover:text-rose-100 focus:ring-white/25",
        footer: "border-white/12 bg-black",
        footerText: "text-zinc-400",
        footerLogoText: "text-zinc-100",
      };

  const handleSignOut = async () => {
    await signOut();
    setAccountMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <div
      className={`min-h-screen overflow-x-hidden font-['Public_Sans',sans-serif] transition-colors duration-300 ${themeClasses.page}`}
    >
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-300 ${themeClasses.header}`}
      >
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandLogoLink
            imageClassName="h-10 w-auto"
            textClassName={`truncate text-xl font-black tracking-[0.2em] sm:text-2xl ${themeClasses.logoText}`}
            className="rounded-lg focus:outline-none focus:ring-4 focus:ring-cyan-300/40 min-w-0"
            label="AARANNU"
          />

          {isSignedIn ? (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <ThemeToggle className={themeClasses.themeButton} />

              <div ref={accountMenuRef} className="relative min-w-0 shrink-0">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  className={`flex min-w-0 max-w-[210px] items-center gap-2 rounded-lg border px-2 py-2 text-left transition focus:outline-none focus:ring-4 sm:max-w-xs sm:pr-3 ${themeClasses.accountButton}`}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${themeClasses.avatar}`}
                  >
                    {displayInitial}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm font-black sm:text-base ${themeClasses.userName}`}
                    >
                      {displayName}
                    </span>
                    <span
                      className={`hidden truncate text-xs font-semibold sm:block ${themeClasses.mutedText}`}
                    >
                      Signed in
                    </span>
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 transition ${themeClasses.chevron} ${
                      accountMenuOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {accountMenuOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border ${themeClasses.menu}`}
                    role="menu"
                  >
                    <div className={`border-b px-4 py-3 ${themeClasses.menuBorder}`}>
                      <p
                        className={`text-xs font-black uppercase tracking-[0.16em] ${themeClasses.menuEyebrow}`}
                      >
                        Signed in as
                      </p>
                      <p
                        className={`mt-1 truncate text-sm font-bold ${themeClasses.userName}`}
                      >
                        {displayName}
                      </p>
                      {sessionUser?.email && displayName !== sessionUser.email && (
                        <p
                          className={`mt-0.5 truncate text-xs ${themeClasses.mutedText}`}
                        >
                          {sessionUser.email}
                        </p>
                      )}
                    </div>
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard")}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition focus:outline-none focus:ring-2 ${themeClasses.menuAction}`}
                        role="menuitem"
                      >
                        <svg
                          className="h-4 w-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                          />
                        </svg>
                        Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition focus:outline-none focus:ring-2 ${themeClasses.menuSignOut}`}
                        role="menuitem"
                      >
                        <svg
                          className="h-4 w-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className={`rounded-lg px-4 py-3 text-base font-bold transition focus:outline-none focus:ring-4 ${themeClasses.quietLink}`}
              >
                Sign In
              </Link>
              <ThemeToggle compact className={themeClasses.themeButton} />
              <Link
                to="/signup"
                className={`rounded-lg px-5 py-3 text-base font-black transition focus:outline-none focus:ring-4 ${themeClasses.navPrimary}`}
              >
                Get Started
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main>
        <section
          className={`relative isolate overflow-hidden border-b transition-colors duration-300 ${themeClasses.sectionBorder} ${themeClasses.heroBg}`}
        >
          <div
            className={`pointer-events-none absolute inset-0 ${themeClasses.gridOpacity}`}
            style={{
              backgroundImage:
                "linear-gradient(rgba(34,211,238,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.2) 1px, transparent 1px)",
              backgroundSize: "96px 96px",
            }}
          />
          <div
            className={`pointer-events-none absolute inset-0 ${themeClasses.scanOpacity}`}
            style={{
              backgroundImage:
                isLightTheme
                  ? "repeating-linear-gradient(to bottom, transparent 0, transparent 12px, rgba(24,24,27,0.38) 13px)"
                  : "repeating-linear-gradient(to bottom, transparent 0, transparent 12px, rgba(255,255,255,0.75) 13px)",
            }}
          />

          <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.78fr)] lg:gap-10 lg:py-12">
            <div className="max-w-3xl">
              <p
                className={`mb-5 inline-flex items-center gap-2 border px-4 py-2 text-sm font-black uppercase tracking-[0.18em] ${themeClasses.badge}`}
              >
                <span className="h-3 w-3 rounded-full bg-rose-300" />
                Simple digital ID cards
              </p>

              <h1
                className={`max-w-4xl text-4xl font-black leading-[1.04] tracking-normal sm:text-6xl lg:text-7xl ${themeClasses.heading}`}
              >
                Make ID cards easier for everyone.
              </h1>

              <p
                className={`mt-6 max-w-2xl text-lg leading-8 sm:text-xl sm:leading-9 ${themeClasses.bodyText}`}
              >
                Aarannu helps teams, schools, events, and communities create,
                send, and verify ID cards without confusing tools or tiny
                screens.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryCtaTo}
                  className={`inline-flex min-h-14 items-center justify-center rounded-lg px-7 py-4 text-lg font-black transition focus:outline-none focus:ring-4 ${themeClasses.primaryCta}`}
                >
                  {primaryCtaLabel}
                </Link>
                <a
                  href="#how-it-works"
                  className={`inline-flex min-h-14 items-center justify-center rounded-lg border px-7 py-4 text-lg font-black transition focus:outline-none focus:ring-4 ${themeClasses.secondaryCta}`}
                >
                  See How It Works
                </a>
              </div>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {benefits.map(([title, copy]) => (
                  <div
                    key={title}
                    className={`border p-4 transition-colors duration-300 ${themeClasses.benefitCard}`}
                  >
                    <h2 className={`text-lg font-black ${themeClasses.heading}`}>
                      {title}
                    </h2>
                    <p className={`mt-2 text-base leading-7 ${themeClasses.benefitText}`}>
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[440px] w-full overflow-visible sm:min-h-[560px] lg:min-h-[650px]">
              <HolographicCardScene theme={theme} />
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className={`border-b px-4 py-12 transition-colors duration-300 sm:px-6 lg:py-16 ${themeClasses.sectionBorder} ${themeClasses.workflowBg}`}
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p
                className={`text-base font-black uppercase tracking-[0.2em] ${themeClasses.workflowEyebrow}`}
              >
                The workflow
              </p>
              <h2
                className={`mt-3 text-3xl font-black leading-tight sm:text-5xl ${themeClasses.heading}`}
              >
                A calm path from member list to verified card.
              </h2>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-4">
              {steps.map(([number, label]) => (
                <div
                  key={number}
                  className={`flex items-center gap-4 border p-5 transition-colors duration-300 ${themeClasses.stepCard}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xl font-black text-black">
                    {number}
                  </span>
                  <p className={`text-lg font-bold leading-7 ${themeClasses.heading}`}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`px-4 py-12 transition-colors duration-300 sm:px-6 lg:py-16 ${themeClasses.finalBand}`}
        >
          <div
            className={`mx-auto grid max-w-7xl gap-8 border p-6 transition-colors duration-300 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center ${themeClasses.finalCard}`}
          >
            <div>
              <p
                className={`text-base font-black uppercase tracking-[0.2em] ${themeClasses.readyText}`}
              >
                Ready when you are
              </p>
              <h2
                className={`mt-3 text-3xl font-black leading-tight sm:text-5xl ${themeClasses.heading}`}
              >
                Try Aarannu with 50 starter tokens.
              </h2>
              <p className={`mt-4 max-w-2xl text-lg leading-8 ${themeClasses.benefitText}`}>
                Create an account, pick a template, and generate your first
                batch from a simple dashboard.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                to={primaryCtaTo}
                className={`inline-flex min-h-14 items-center justify-center rounded-lg px-7 py-4 text-lg font-black transition focus:outline-none focus:ring-4 ${themeClasses.navPrimary}`}
              >
                {isSignedIn ? "Open Dashboard" : "Create Account"}
              </Link>
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`inline-flex min-h-14 items-center justify-center rounded-lg border px-7 py-4 text-lg font-black transition focus:outline-none focus:ring-4 ${themeClasses.outlineCta}`}
                >
                  Log Out
                </button>
              ) : (
                <Link
                  to="/login"
                  className={`inline-flex min-h-14 items-center justify-center rounded-lg border px-7 py-4 text-lg font-black transition focus:outline-none focus:ring-4 ${themeClasses.outlineCta}`}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer
        className={`border-t px-4 py-8 transition-colors duration-300 sm:px-6 ${themeClasses.footer}`}
      >
        <div
          className={`mx-auto flex max-w-7xl flex-col gap-5 text-base md:flex-row md:items-center md:justify-between ${themeClasses.footerText}`}
        >
          <BrandLogoLink
            imageClassName="h-8 w-auto"
            textClassName={`font-black tracking-[0.2em] ${themeClasses.footerLogoText}`}
            className="rounded-lg focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
            label="AARANNU"
          />
          <p>Copyright 2026 Aarannu. Built for clearer identity workflows.</p>
        </div>
      </footer>
    </div>
  );
}
