import { Link } from "react-router-dom";

/**
 * LandingPage – Aarannu Marketing Home
 * Matches the provided design: sticky nav, hero, trust bar, features, CTA, footer.
 * "Sign In" → /login  |  "Get Started" / "Create Free Account" → /signup
 */
export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#f6f6f8] font-['Public_Sans',sans-serif] text-slate-900 overflow-x-hidden">
      {/* ── Background Accents ── */}
      <div className="absolute top-0 right-0 -z-10 w-1/2 h-screen bg-linear-to-bl from-[#1152d4]/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-[20%] -left-20 -z-10 w-96 h-96 bg-[#1152d4]/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-[#f6f6f8]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/aarannu.png" alt="Aarannu" className="h-9 w-auto" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Aarannu</span>
          </Link>



          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2 text-sm font-semibold bg-[#1152d4] text-white rounded-lg hover:shadow-lg hover:shadow-[#1152d4]/25 active:scale-95 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="flex flex-col gap-6 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1152d4]/10 border border-[#1152d4]/20 w-fit">
              <span className="w-2 h-2 rounded-full bg-[#1152d4]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#1152d4]">New: Bulk CSV Import</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-black leading-[1.1] tracking-tight text-slate-900">
              Digital Identity,{" "}
              <span className="bg-linear-to-r from-[#1152d4] to-blue-400 bg-clip-text text-transparent">
                Reimagined
              </span>{" "}
              for Modern Teams.
            </h1>

            <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
              Securely generate, manage, and verify digital ID cards in bulk.
              Integration with Google Sheets, custom templates, and instant verification.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                to="/signup"
                className="px-8 py-4 bg-[#1152d4] text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-[#1152d4]/40 active:scale-95 transition-all flex items-center gap-2"
              >
                Get Started Now
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              <a
                href="#features"
                className="px-8 py-4 bg-white border border-slate-200 text-slate-900 font-bold rounded-xl hover:bg-slate-50 transition-all"
              >
                View Features
              </a>
            </div>
          </div>

          {/* Right: ID card mockup */}
          <div className="relative">
            <div className="absolute inset-0 bg-linear-to-tr from-[#1152d4]/20 to-red-500/10 rounded-full blur-[100px] -z-10" />
            <div className="w-full aspect-square relative flex items-center justify-center p-8 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-white/50 shadow-2xl overflow-hidden">
              <div className="relative w-full h-full">
                {/* Card 1 */}
                <div className="absolute top-10 left-10 w-64 h-96 bg-linear-to-br from-[#1152d4] to-blue-800 rounded-2xl shadow-2xl -rotate-12 border border-white/20 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 bg-white/20 rounded-full" />
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Aarannu</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="w-12 h-12 bg-white rounded-lg" />
                    <div className="h-4 w-32 bg-white/40 rounded" />
                    <div className="h-3 w-20 bg-white/20 rounded" />
                  </div>
                  <div className="w-full h-12 bg-white/10 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/50">qr_code_2</span>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="absolute bottom-10 right-10 w-64 h-96 bg-linear-to-br from-red-500 to-[#1152d4] rounded-2xl shadow-2xl rotate-6 border border-white/20 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 bg-white/20 rounded-full" />
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Premium</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="w-12 h-12 bg-white rounded-lg" />
                    <div className="h-4 w-32 bg-white/40 rounded" />
                    <div className="h-3 w-20 bg-white/20 rounded" />
                  </div>
                  <div className="w-full h-12 bg-white/10 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/50">qr_code_2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <div className="w-full border-y border-slate-200 py-10 bg-white/50">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">
            Trusted by 50,000+ organizations worldwide
          </p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-20 opacity-40 grayscale">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-4xl">domain</span>
              <span className="font-bold text-xl">GlobalTech</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-4xl">apartment</span>
              <span className="font-bold text-xl">NexusCorp</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-4xl">account_balance</span>
              <span className="font-bold text-xl">FinStream</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-4xl">school</span>
              <span className="font-bold text-xl">EduBase</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Features Grid ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20 flex flex-col gap-4">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
              Powerful Features for Modern Identity
            </h2>
            <p className="text-slate-600">
              Everything you need to manage your organization's digital presence in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#1152d4]/50 transition-all hover:shadow-xl hover:shadow-[#1152d4]/5">
              <div className="w-12 h-12 bg-[#1152d4]/10 rounded-xl flex items-center justify-center text-[#1152d4] mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">layers</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Bulk Generation</h3>
              <p className="text-slate-600 leading-relaxed">
                Sync with Google Sheets for thousands of cards in seconds. Automated
                workflows ensure data accuracy across your entire team.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#1152d4]/50 transition-all hover:shadow-xl hover:shadow-[#1152d4]/5">
              <div className="w-12 h-12 bg-[#1152d4]/10 rounded-xl flex items-center justify-center text-[#1152d4] mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">verified_user</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Secure Verification</h3>
              <p className="text-slate-600 leading-relaxed">
                Instant QR-based verification for every member. Real-time logging and
                fraud detection built into every card issuance.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="group p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#1152d4]/50 transition-all hover:shadow-xl hover:shadow-[#1152d4]/5">
              <div className="w-12 h-12 bg-[#1152d4]/10 rounded-xl flex items-center justify-center text-[#1152d4] mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">palette</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Custom Templates</h3>
              <p className="text-slate-600 leading-relaxed">
                Pro-grade editor with your brand's gradients and colors. Full control
                over typography, layouts, and dynamic data fields.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-24 relative overflow-hidden bg-[#f6f6f8]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-[#1152d4] rounded-[2.5rem] p-12 md:p-20 relative overflow-hidden text-center flex flex-col items-center gap-8">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <h2 className="text-4xl md:text-5xl font-black text-white max-w-2xl leading-tight relative z-10">
              Ready to modernize your identity system?
            </h2>
            <p className="text-white/80 text-lg md:text-xl max-w-xl relative z-10">
              Join thousands of organizations transforming their digital presence with Aarannu today.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <Link
                to="/signup"
                className="px-10 py-5 bg-white text-[#1152d4] font-black rounded-2xl hover:bg-slate-100 shadow-xl transition-all hover:-translate-y-1"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="px-10 py-5 bg-transparent text-white border-2 border-white/30 font-black rounded-2xl hover:bg-white/10 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-slate-200 py-12 bg-[#f6f6f8]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/aarannu.png" alt="Aarannu" className="h-7 w-auto" />
            <span className="font-bold text-slate-900">Aarannu</span>
          </Link>

          <div className="flex gap-8">
            <a href="#" className="text-sm text-slate-500 hover:text-[#1152d4] transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-[#1152d4] transition-colors">Terms of Service</a>
            <a href="#" className="text-sm text-slate-500 hover:text-[#1152d4] transition-colors">Contact</a>
          </div>

          <p className="text-sm text-slate-400">© 2024 Aarannu Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
