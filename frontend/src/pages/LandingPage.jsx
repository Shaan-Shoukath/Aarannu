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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/aarannu.png" alt="Aarannu" className="h-8 sm:h-9 w-auto" />
            <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Aarannu</span>
          </Link>

          {/* Auth buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="px-3 sm:px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 sm:px-5 py-2 text-sm font-semibold bg-[#1152d4] text-white rounded-lg hover:shadow-lg hover:shadow-[#1152d4]/25 active:scale-95 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-12 pb-10 sm:pt-16 sm:pb-14 md:pt-24 md:pb-20 lg:pt-32 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left: copy */}
          <div className="flex flex-col gap-4 sm:gap-6 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1152d4]/10 border border-[#1152d4]/20 w-fit">
              <span className="w-2 h-2 rounded-full bg-[#1152d4]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#1152d4]">New: Bulk CSV Import</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-slate-900">
              Digital Identity,{" "}
              <span className="bg-linear-to-r from-[#1152d4] to-blue-400 bg-clip-text text-transparent">
                Reimagined
              </span>{" "}
              for Modern Teams.
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed">
              Securely generate, manage, and verify digital ID cards in bulk.
              Integration with Google Sheets, custom templates, and instant verification.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-2 sm:pt-4">
              <Link
                to="/signup"
                className="px-6 sm:px-8 py-3 sm:py-4 bg-[#1152d4] text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-[#1152d4]/40 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                Get Started Now
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              <a
                href="#features"
                className="px-6 sm:px-8 py-3 sm:py-4 bg-white border border-slate-200 text-slate-900 font-bold rounded-xl hover:bg-slate-50 transition-all text-center text-sm sm:text-base"
              >
                View Features
              </a>
            </div>
          </div>

          {/* Right: ID card mockup */}
          <div className="relative hidden sm:block">
            <div className="absolute inset-0 bg-linear-to-tr from-[#1152d4]/20 to-red-500/10 rounded-full blur-[100px] -z-10" />
            <div className="w-full aspect-square relative flex items-center justify-center p-4 sm:p-6 md:p-8 bg-white/40 backdrop-blur-sm rounded-2xl lg:rounded-[2.5rem] border border-white/50 shadow-2xl overflow-hidden max-w-lg mx-auto lg:max-w-none">
              <div className="relative w-full h-full">
                {/* Card 1 */}
                <div className="absolute top-[5%] left-[5%] w-[45%] h-[65%] bg-linear-to-br from-[#1152d4] to-blue-800 rounded-xl sm:rounded-2xl shadow-2xl -rotate-12 border border-white/20 p-3 sm:p-4 md:p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-white/20 rounded-full" />
                    <span className="text-white/60 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">Aarannu</span>
                  </div>
                  <div className="flex flex-col gap-1 sm:gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white rounded-lg" />
                    <div className="h-3 sm:h-4 w-3/4 bg-white/40 rounded" />
                    <div className="h-2 sm:h-3 w-1/2 bg-white/20 rounded" />
                  </div>
                  <div className="w-full h-8 sm:h-10 md:h-12 bg-white/10 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/50 text-sm sm:text-base">qr_code_2</span>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="absolute bottom-[5%] right-[5%] w-[45%] h-[65%] bg-linear-to-br from-red-500 to-[#1152d4] rounded-xl sm:rounded-2xl shadow-2xl rotate-6 border border-white/20 p-3 sm:p-4 md:p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-white/20 rounded-full" />
                    <span className="text-white/60 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">Premium</span>
                  </div>
                  <div className="flex flex-col gap-1 sm:gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white rounded-lg" />
                    <div className="h-3 sm:h-4 w-3/4 bg-white/40 rounded" />
                    <div className="h-2 sm:h-3 w-1/2 bg-white/20 rounded" />
                  </div>
                  <div className="w-full h-8 sm:h-10 md:h-12 bg-white/10 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/50 text-sm sm:text-base">qr_code_2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <div className="w-full border-y border-slate-200 py-6 sm:py-8 md:py-10 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest mb-5 sm:mb-8">
            Trusted by 50,000+ organizations worldwide
          </p>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-6 sm:gap-10 md:gap-16 lg:gap-20 opacity-40 grayscale">
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-2xl sm:text-3xl md:text-4xl">domain</span>
              <span className="font-bold text-sm sm:text-base md:text-xl">GlobalTech</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-2xl sm:text-3xl md:text-4xl">apartment</span>
              <span className="font-bold text-sm sm:text-base md:text-xl">NexusCorp</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-2xl sm:text-3xl md:text-4xl">account_balance</span>
              <span className="font-bold text-sm sm:text-base md:text-xl">FinStream</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-2xl sm:text-3xl md:text-4xl">school</span>
              <span className="font-bold text-sm sm:text-base md:text-xl">EduBase</span>
            </div>
          </div>
        </div>
      </div>

      {/* ���─ Features Grid ── */}
      <section id="features" className="py-12 sm:py-16 md:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14 md:mb-20 flex flex-col gap-3 sm:gap-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              Powerful Features for Modern Identity
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Everything you need to manage your organization's digital presence in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {/* Feature 1 */}
            <div className="group p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#1152d4]/50 transition-all hover:shadow-xl hover:shadow-[#1152d4]/5 cursor-pointer">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1152d4]/10 rounded-xl flex items-center justify-center text-[#1152d4] mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">layers</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Bulk Generation</h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Sync with Google Sheets for thousands of cards in seconds. Automated
                workflows ensure data accuracy across your entire team.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="group p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#1152d4]/50 transition-all hover:shadow-xl hover:shadow-[#1152d4]/5 cursor-pointer">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1152d4]/10 rounded-xl flex items-center justify-center text-[#1152d4] mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">verified_user</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Secure Verification</h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Instant QR-based verification for every member. Real-time logging and
                fraud detection built into every card issuance.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="group p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#1152d4]/50 transition-all hover:shadow-xl hover:shadow-[#1152d4]/5 sm:col-span-2 md:col-span-1 cursor-pointer">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1152d4]/10 rounded-xl flex items-center justify-center text-[#1152d4] mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">palette</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">Custom Templates</h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Pro-grade editor with your brand's gradients and colors. Full control
                over typography, layouts, and dynamic data fields.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 relative overflow-hidden bg-[#f6f6f8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-[#1152d4] rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] p-6 sm:p-10 md:p-16 lg:p-20 relative overflow-hidden text-center flex flex-col items-center gap-5 sm:gap-6 md:gap-8">
            <div className="absolute top-0 right-0 w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 sm:w-48 md:w-64 h-32 sm:h-48 md:h-64 bg-red-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white max-w-2xl leading-tight relative z-10">
              Ready to modernize your identity system?
            </h2>
            <p className="text-white/80 text-sm sm:text-base md:text-lg lg:text-xl max-w-xl relative z-10">
              Join thousands of organizations transforming their digital presence with Aarannu today.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 relative z-10 w-full sm:w-auto">
              <Link
                to="/signup"
                className="px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 bg-white text-[#1152d4] font-black rounded-xl sm:rounded-2xl hover:bg-slate-100 shadow-xl transition-all hover:-translate-y-1 text-sm sm:text-base"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 bg-transparent text-white border-2 border-white/30 font-black rounded-xl sm:rounded-2xl hover:bg-white/10 transition-all text-sm sm:text-base"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-slate-200 py-8 sm:py-10 md:py-12 bg-[#f6f6f8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:justify-between md:gap-8">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/aarannu.png" alt="Aarannu" className="h-7 w-auto" />
            <span className="font-bold text-slate-900">Aarannu</span>
          </Link>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8">
            <a href="#" className="text-sm text-slate-500 hover:text-[#1152d4] transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-[#1152d4] transition-colors">Terms of Service</a>
            <a href="#" className="text-sm text-slate-500 hover:text-[#1152d4] transition-colors">Contact</a>
          </div>

          <p className="text-xs sm:text-sm text-slate-400">© 2024 Aarannu Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
