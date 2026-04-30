import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HolographicCardScene from "../components/HolographicCardScene";
import BrandLogoLink from "../components/BrandLogoLink";
import { useAuth } from "../contexts/useAuth";

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

  const handleSignOut = async () => {
    await signOut();
    setAccountMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-['Public_Sans',sans-serif] text-white">
      <header className="sticky top-0 z-50 border-b border-white/12 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandLogoLink
            imageClassName="h-10 w-auto"
            textClassName="truncate text-xl font-black tracking-[0.2em] text-white sm:text-2xl"
            className="rounded-lg focus:outline-none focus:ring-4 focus:ring-cyan-300/40 min-w-0"
            label="AARANNU"
          />

          {isSignedIn ? (
            <div ref={accountMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                className="flex min-w-0 max-w-[210px] items-center gap-2 rounded-lg border border-white/15 bg-zinc-950 px-2 py-2 text-left transition hover:border-cyan-300/60 hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-cyan-300/30 sm:max-w-xs sm:pr-3"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-sm font-black text-black">
                  {displayInitial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-white sm:text-base">
                    {displayName}
                  </span>
                  <span className="hidden truncate text-xs font-semibold text-zinc-400 sm:block">
                    Signed in
                  </span>
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition ${
                    accountMenuOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
                  className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/12 bg-zinc-950 shadow-2xl"
                  role="menu"
                >
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                      Signed in as
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-white">
                      {displayName}
                    </p>
                    {sessionUser?.email && displayName !== sessionUser.email && (
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {sessionUser.email}
                      </p>
                    )}
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-white transition hover:bg-cyan-300/10 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                      role="menuitem"
                    >
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
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
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-zinc-400 transition hover:bg-rose-400/10 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300/40"
                      role="menuitem"
                    >
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
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
          ) : (
            <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="rounded-lg px-4 py-3 text-base font-bold text-zinc-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/25"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-cyan-300 px-5 py-3 text-base font-black text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
              >
                Get Started
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-white/12 bg-black">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(34,211,238,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.2) 1px, transparent 1px)",
              backgroundSize: "96px 96px",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0, transparent 12px, rgba(255,255,255,0.75) 13px)",
            }}
          />

          <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.78fr)] lg:gap-10 lg:py-12">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex items-center gap-2 border border-cyan-300/45 bg-black/80 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-cyan-100">
                <span className="h-3 w-3 rounded-full bg-rose-300" />
                Simple digital ID cards
              </p>

              <h1 className="max-w-4xl text-4xl font-black leading-[1.04] tracking-normal text-white sm:text-6xl lg:text-7xl">
                Make ID cards easier for everyone.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-200 sm:text-xl sm:leading-9">
                Aarannu helps teams, schools, events, and communities create,
                send, and verify ID cards without confusing tools or tiny
                screens.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryCtaTo}
                  className="inline-flex min-h-14 items-center justify-center rounded-lg bg-white px-7 py-4 text-lg font-black text-black transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
                >
                  {primaryCtaLabel}
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/28 bg-black/70 px-7 py-4 text-lg font-black text-white transition hover:border-cyan-300 hover:text-cyan-100 focus:outline-none focus:ring-4 focus:ring-white/25"
                >
                  See How It Works
                </a>
              </div>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {benefits.map(([title, copy]) => (
                  <div
                    key={title}
                    className="border border-white/12 bg-black/75 p-4"
                  >
                    <h2 className="text-lg font-black text-white">{title}</h2>
                    <p className="mt-2 text-base leading-7 text-zinc-300">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[440px] w-full overflow-visible sm:min-h-[560px] lg:min-h-[650px]">
              <HolographicCardScene />
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-b border-white/12 bg-black px-4 py-12 sm:px-6 lg:py-16"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-base font-black uppercase tracking-[0.2em] text-rose-200">
                The workflow
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                A calm path from member list to verified card.
              </h2>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-4">
              {steps.map(([number, label]) => (
                <div
                  key={number}
                  className="flex items-center gap-4 border border-white/12 bg-zinc-950 p-5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xl font-black text-black">
                    {number}
                  </span>
                  <p className="text-lg font-bold leading-7 text-zinc-100">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-black px-4 py-12 sm:px-6 lg:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 border border-white/12 bg-zinc-950 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-base font-black uppercase tracking-[0.2em] text-yellow-100">
                Ready when you are
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                Try Aarannu with 50 starter tokens.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
                Create an account, pick a template, and generate your first
                batch from a simple dashboard.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                to={primaryCtaTo}
                className="inline-flex min-h-14 items-center justify-center rounded-lg bg-cyan-300 px-7 py-4 text-lg font-black text-black transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
              >
                {isSignedIn ? "Open Dashboard" : "Create Account"}
              </Link>
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/28 px-7 py-4 text-lg font-black text-white transition hover:border-rose-300 hover:text-rose-100 focus:outline-none focus:ring-4 focus:ring-white/25"
                >
                  Log Out
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/28 px-7 py-4 text-lg font-black text-white transition hover:border-rose-300 hover:text-rose-100 focus:outline-none focus:ring-4 focus:ring-white/25"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/12 bg-black px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-base text-zinc-400 md:flex-row md:items-center md:justify-between">
          <BrandLogoLink
            imageClassName="h-8 w-auto"
            textClassName="font-black tracking-[0.2em] text-zinc-100"
            className="rounded-lg focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
            label="AARANNU"
          />
          <p>Copyright 2026 Aarannu. Built for clearer identity workflows.</p>
        </div>
      </footer>
    </div>
  );
}
