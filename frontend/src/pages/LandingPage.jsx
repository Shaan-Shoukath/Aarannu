import { Link } from "react-router-dom";
import HolographicCardScene from "../components/HolographicCardScene";
import BrandLogoLink from "../components/BrandLogoLink";

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
                  to="/signup"
                  className="inline-flex min-h-14 items-center justify-center rounded-lg bg-white px-7 py-4 text-lg font-black text-black transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
                >
                  Start Now
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
                to="/signup"
                className="inline-flex min-h-14 items-center justify-center rounded-lg bg-cyan-300 px-7 py-4 text-lg font-black text-black transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
              >
                Create Account
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/28 px-7 py-4 text-lg font-black text-white transition hover:border-rose-300 hover:text-rose-100 focus:outline-none focus:ring-4 focus:ring-white/25"
              >
                Sign In
              </Link>
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
