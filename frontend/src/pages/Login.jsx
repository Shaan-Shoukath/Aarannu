import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Login Page
 * --------------------------------------------------
 * Design: Split-screen layout from the Figma / design file.
 * Left half  – decorative ID card preview (hidden on mobile).
 * Right half – login form with email + password OR email OTP.
 *
 * Security notes:
 *  • Supabase handles password hashing (bcrypt) server-side.
 *  • We never store or log the raw password.
 *  • Error messages are intentionally vague ("Invalid credentials")
 *    to avoid user-enumeration attacks.
 *  • OTP is sent via Supabase's built-in email OTP (6-digit code).
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [loginMethod, setLoginMethod] = useState("password"); // "password" | "otp"
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    // Basic client-side validation
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        // Vague message to prevent user enumeration
        setError("Invalid email or password. Please try again.");
        return;
      }

      // Successful login → redirect to dashboard
      navigate("/dashboard", { replace: true });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** Send a 6-digit OTP to the user's email */
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setOtpMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });

      if (otpError) {
        setError(otpError.message || "Failed to send OTP. Please try again.");
        return;
      }

      setOtpSent(true);
      setOtpMessage("A 6-digit code has been sent to your email.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** Verify the 6-digit OTP code */
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setOtpMessage("");

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: "email",
      });

      if (verifyError) {
        setError("Invalid or expired code. Please try again.");
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-['Public_Sans',sans-serif]">
      {/* ─── Left Panel: Decorative (hidden on mobile) ─── */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-900 items-center justify-center">
        {/* Gradient blobs */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-20 -left-20 w-150 h-150 bg-linear-to-br from-[#1152d4] via-blue-600 to-transparent rounded-full blur-[100px] opacity-60" />
          <div className="absolute -bottom-20 -right-20 w-150 h-150 bg-linear-to-tl from-[#ef4444] via-red-500 to-transparent rounded-full blur-[100px] opacity-40" />
          <div
            className="absolute inset-0 bg-slate-900/40 z-10"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        {/* Floating ID card preview */}
        <div className="relative z-20 transform -rotate-[5deg] hover:rotate-0 transition-all duration-700 ease-in-out hover:scale-105">
          <div
            className="w-105 bg-white rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10 relative"
            style={{ aspectRatio: "85.6 / 53.98" }}
          >
            {/* Card background accents */}
            <div className="absolute inset-0 z-0">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-linear-to-bl from-[#1152d4] to-blue-600 rounded-full blur-2xl opacity-20" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-linear-to-tr from-[#ef4444] to-orange-400 rounded-full blur-2xl opacity-10" />
            </div>

            {/* Card header */}
            <div className="absolute top-4 left-6 right-6 flex items-center gap-2 z-10">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#1152d4] to-blue-800 flex items-center justify-center text-white shadow-sm">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold text-[#1152d4] uppercase tracking-wide">
                  Aarannu
                </span>
                <span className="text-[8px] text-slate-500 font-medium">
                  Community Edition
                </span>
              </div>
            </div>

            {/* Card body */}
            <div className="absolute top-16 left-6 right-6 bottom-6 flex gap-5 z-10">
              <div className="w-24 h-28 shrink-0 relative rounded-md overflow-hidden bg-slate-200 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-slate-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div className="flex-1 flex flex-col justify-center space-y-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Alex Morgan
                  </h3>
                  <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">
                    Senior Developer
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">
                      EMP ID
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-700">
                      DEV-8842
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">
                      Join Date
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700">
                      Oct 2023
                    </span>
                  </div>
                </div>
                <div className="pt-1">
                  <div className="w-full h-8 bg-slate-50 border border-slate-100 rounded flex items-center justify-center">
                    <div className="h-4 w-32 bg-slate-300 rounded-sm opacity-50" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating icons */}
          <div className="absolute -right-12 top-20 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-lg shadow-xl animate-pulse">
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 11h2v2H3v-2zm0-4h2v2H3V7zm0 8h2v2H3v-2zm4-4h2v2H7v-2zm0-4h2v2H7V7zm0 8h2v2H7v-2zm4-4h2v2h-2v-2zm0-4h2v2h-2V7zm0 8h2v2h-2v-2zm4-4h2v2h-2v-2zm0-4h2v2h-2V7zm0 8h2v2h-2v-2z" />
            </svg>
          </div>
          <div className="absolute -left-8 bottom-10 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-lg shadow-xl">
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39s-4.66 1.97-4.66 4.39c0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-4.91-1.31-7.78-6.46-7.78-11.31 0-2.92 2.46-5.3 5.01-5.3s5.01 2.38 5.01 5.3c0 1.89-1.57 .43-3.43 3.43-.28 0-.5-.22-.5-.5s.22-.5.5-.5c1.29 0 2.43-1.09 2.43-2.43 0-2.35-1.96-4.3-4.01-4.3s-4.01 1.95-4.01 4.3c0 4.41 2.64 9.08 7.04 10.26.27.07.42.35.35.62-.06.22-.25.37-.48.37z" />
            </svg>
          </div>
        </div>

        {/* Bottom text */}
        <div className="absolute bottom-12 left-12 z-20 text-white max-w-md">
          <h2 className="text-3xl font-bold mb-2">
            Bulk Generation Made Simple
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Create secure digital ID cards instantly. Streamlined workflow for
            modern communities.
          </p>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-110 space-y-8">
          {/* Brand */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center justify-center lg:justify-start gap-2 mb-6">
              <div className="w-10 h-10 bg-[#1152d4] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-[#1152d4]/30">
                A
              </div>
              <span className="text-2xl font-bold text-slate-900 tracking-tight">
                Aarannu
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back
            </h1>
            <p className="text-slate-500">
              Please enter your details to access your dashboard.
            </p>
          </div>

          {/* Form */}
          {/* ── Login Method Tabs ── */}
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("password");
                setError("");
                setOtpSent(false);
                setOtpCode("");
                setOtpMessage("");
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                loginMethod === "password"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod("otp");
                setError("");
                setOtpMessage("");
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                loginMethod === "otp"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Email OTP
            </button>
          </div>

          {/* ── Password Login Form ── */}
          {loginMethod === "password" && (
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="pl-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 pr-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-[#1152d4] focus:ring-[#1152d4] border-slate-300 rounded"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-slate-600"
                  >
                    Remember me
                  </label>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          )}

          {/* ── OTP Login Form ── */}
          {loginMethod === "otp" && (
            <>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Email */}
                    <div>
                      <label
                        htmlFor="otp-email"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </span>
                        <input
                          id="otp-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="pl-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    We&apos;ll send a 6-digit verification code to your email.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      "Send Code"
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}
                  {otpMessage && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                      {otpMessage}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="otp-code"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Verification Code
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </span>
                        <input
                          id="otp-code"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          required
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          placeholder="Enter 6-digit code"
                          className="pl-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none tracking-widest text-center font-mono text-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Code sent to <span className="font-medium">{email}</span>.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode("");
                        setError("");
                        setOtpMessage("");
                      }}
                      className="text-[#1152d4] hover:underline font-medium"
                    >
                      Change email
                    </button>{" "}
                    or{" "}
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="text-[#1152d4] hover:underline font-medium"
                    >
                      Resend code
                    </button>
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      "Verify & Sign in"
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
          </div>

          {/* Switch to Signup */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-[#1152d4] hover:text-[#1152d4]/80 transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
