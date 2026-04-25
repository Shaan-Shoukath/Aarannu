import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BrandLogoLink from "../components/BrandLogoLink";
import { ensureStarterTokens } from "../lib/starterTokens";

/**
 * Signup Page
 * --------------------------------------------------
 * Flow:
 *  1. User enters name, email, password.
 *  2. Supabase creates the auth user.
 *  3. An OTP is sent to the user's email for verification.
 *  4. User enters the 6-digit code.
 *  5. On successful verification, a row is inserted into `members` with approved = true.
 *  6. The user can access Aarannu immediately and receives 50 free starter tokens.
 */
export default function Signup() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [signupUserId, setSignupUserId] = useState(null);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    // ── Client-side validation ──
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create auth user in Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // Supabase returns { user: null } for already-registered emails (enumeration protection)
      if (!authData?.user) {
        setError(
          "Unable to create account. This email may already be registered.",
        );
        return;
      }

      // Save user ID for member insert after OTP verification
      setSignupUserId(authData.user.id);

      // If email confirmation is disabled (autoconfirm), session is already active.
      // Skip OTP step and insert member directly.
      if (authData.session) {
        const userId = authData.user.id;
        const { error: memberError } = await supabase.from("members").insert({
          user_id: userId,
          name: name.trim(),
          role: role.trim() || "Member",
          approved: true,
        });

        if (memberError && memberError.code !== "23505") {
          setError(
            "Account created but profile setup failed. Please contact admin.",
          );
          console.error("Member insert error:", memberError);
          return;
        }

        await ensureStarterTokens(authData.session.access_token);
        setSuccess(true);
        return;
      }

      // 2. Send OTP to email for verification (when email confirmation is ON)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });

      if (otpError) {
        // If rate limited, still proceed — the signup confirmation email acts as verification
        console.warn("OTP send warning:", otpError.message);
      }

      setOtpStep(true);
      setOtpMessage("A 6-digit verification code has been sent to your email.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** Verify the 6-digit OTP and complete signup */
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
      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpCode.trim(),
          type: "email",
        });

      if (verifyError) {
        setError("Invalid or expired code. Please try again.");
        return;
      }

      // Use the verified user's ID
      const userId = verifyData?.user?.id || signupUserId;

      // Insert member record with immediate access to the Aarannu trial
      const { error: memberError } = await supabase.from("members").insert({
        user_id: userId,
        name: name.trim(),
        role: role.trim() || "Member",
        approved: true,
      });

      if (memberError) {
        // Member might already exist if they retried
        if (memberError.code === "23505") {
          // Duplicate — update existing record
          await supabase
            .from("members")
            .update({
              approved: true,
              name: name.trim(),
              role: role.trim() || "Member",
            })
            .eq("user_id", userId);
        } else {
          setError(
            "Account verified but profile setup failed. Please contact admin.",
          );
          console.error("Member insert error:", memberError);
          return;
        }
      }

      const accessToken =
        verifyData?.session?.access_token ||
        (await supabase.auth.getSession()).data.session?.access_token;
      await ensureStarterTokens(accessToken);
      setSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** Resend OTP */
  const handleResendOtp = async () => {
    setError("");
    setOtpMessage("");
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });
      if (otpError) {
        setError(
          otpError.message ||
            "Failed to resend code. Wait a moment and try again.",
        );
      } else {
        setOtpMessage("A new code has been sent to your email.");
      }
    } catch {
      setError("Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ──
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black font-['Public_Sans',sans-serif] px-4 py-8 sm:p-8">
        <div className="max-w-md text-center space-y-6">
          <BrandLogoLink
            className="justify-center"
            imageClassName="h-14 w-auto"
            showText={false}
          />
          <div className="w-16 h-16 bg-[#1152d4]/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#1152d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Account Ready</h2>
          <p className="text-zinc-400">
            Your Aarannu workspace is ready. You can start exploring immediately, and your 50 free starter tokens have been added to your account.
          </p>
          <Link to="/dashboard" className="inline-flex items-center px-6 py-2.5 bg-[#1152d4] text-white text-sm font-medium rounded-lg hover:bg-[#1152d4]/90 transition-colors shadow-lg shadow-[#1152d4]/25">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── OTP Verification step ──
  if (otpStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black font-['Public_Sans',sans-serif] px-4 py-8 sm:p-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="text-center">
            <BrandLogoLink
              className="justify-center mb-6"
              imageClassName="h-12 w-auto"
              textClassName="text-2xl font-bold text-white tracking-tight"
            />
            <h1 className="text-2xl font-bold text-white mb-2">
              Verify your email
            </h1>
            <p className="text-zinc-400 text-sm">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-zinc-200">{email}</span>
            </p>
          </div>

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
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  className="pl-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none tracking-widest text-center font-mono text-lg"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Didn&apos;t receive the code?{" "}
              <button
                type="button"
                onClick={handleResendOtp}
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
                "Verify & Complete Signup"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            <button
              type="button"
              onClick={() => {
                setOtpStep(false);
                setOtpCode("");
                setError("");
                setOtpMessage("");
              }}
              className="text-[#1152d4] hover:underline font-medium"
            >
              &larr; Back to signup form
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <style>{`
      @keyframes cardFloat {
        0%, 100% { transform: rotate(-5deg) translateY(0px); }
        50% { transform: rotate(-3deg) translateY(-12px); }
      }
      .signup-card-float { animation: cardFloat 7s ease-in-out infinite; transition: transform 2.5s ease-in-out; }
      .signup-card-float:hover { animation: none; transform: rotate(0deg) scale(1.05); transition: transform 2.5s ease-in-out; }
    `}</style>
    <div className="min-h-screen flex bg-black font-['Public_Sans',sans-serif]">
      {/* ─── Left Panel: Animated ID Card ─── */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-900 items-center justify-center">
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-gradient-to-br from-[#1152d4] via-blue-600 to-transparent rounded-full blur-[100px] opacity-60" />
          <div className="absolute -bottom-20 -right-20 w-[600px] h-[600px] bg-gradient-to-tl from-[#1152d4] via-blue-800 to-transparent rounded-full blur-[100px] opacity-40" />
          <div className="absolute inset-0 bg-slate-900/40 z-10" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        </div>

        <div className="signup-card-float relative z-20">
          <div className="w-[420px] bg-white rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10 relative" style={{ aspectRatio: "85.6 / 53.98" }}>
            <div className="absolute inset-0 z-0">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-bl from-[#1152d4] to-blue-600 rounded-full blur-2xl opacity-20" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-gradient-to-tr from-[#7C3AED] to-purple-400 rounded-full blur-2xl opacity-10" />
            </div>
            <div className="absolute top-4 left-6 right-6 flex items-center gap-2 z-10">
              <img src="/aarannu.png" alt="" className="h-8 w-auto" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold text-[#1152d4] uppercase tracking-wide">Aarannu</span>
                <span className="text-[8px] text-slate-500 font-medium">Community Edition</span>
              </div>
            </div>
            <div className="absolute top-16 left-6 right-6 bottom-6 flex gap-5 z-10">
              <div className="w-24 h-28 shrink-0 relative rounded-md overflow-hidden bg-slate-200 flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div className="flex-1 flex flex-col justify-center space-y-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Shaan Shoukath</h3>
                  <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">Inventory Manager</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">EMP ID</span>
                    <span className="text-[10px] font-mono font-bold text-slate-700">INV-2026</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">Join Date</span>
                    <span className="text-[10px] font-semibold text-slate-700">Jan 2026</span>
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
          <div className="absolute -right-12 top-8 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-lg shadow-xl animate-pulse">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 11h2v2H3v-2zm0-4h2v2H3V7zm0 8h2v2H3v-2zm4-4h2v2H7v-2zm0-4h2v2H7V7zm0 8h2v2H7v-2zm4-4h2v2h-2v-2zm0-4h2v2h-2V7zm0 8h2v2h-2v-2zm4-4h2v2h-2v-2zm0-4h2v2h-2V7zm0 8h2v2h-2v-2z" /></svg>
          </div>
          <div className="absolute -left-10 bottom-4 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-lg shadow-xl">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28z" /></svg>
          </div>
        </div>

        <div className="absolute bottom-12 left-12 z-20 text-white max-w-md">
          <h2 className="text-3xl font-bold mb-2">Join Aarannu Today</h2>
          <p className="text-slate-300 text-sm leading-relaxed">Create your digital identity and get 50 free starter tokens instantly.</p>
        </div>
      </div>

      {/* ─── Right Panel: Signup Form ─── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-4 py-6 sm:p-8 lg:p-12 bg-black relative overflow-y-auto">
        {/* Mobile back to home */}
        <a href="/" className="lg:hidden absolute top-4 left-4 flex items-center gap-1 text-zinc-400 hover:text-[#1152d4] text-sm font-medium transition-colors z-10">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Home
        </a>
        <div className="w-full max-w-md lg:max-w-110 space-y-6 sm:space-y-8 mt-8 lg:mt-0">
          {/* Brand */}
          <div className="text-center lg:text-left">
            <BrandLogoLink
              className="justify-center lg:justify-start mb-6"
              imageClassName="h-12 w-auto"
              textClassName="text-2xl font-bold text-white tracking-tight"
            />
            <h1 className="text-3xl font-bold text-white mb-2">
              Create your account
            </h1>
            <p className="text-zinc-400">
              Fill in your details to start your Aarannu trial.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="pl-10 block w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Role / Designation
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
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
                        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <input
                    id="role"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Member (default)"
                    className="pl-10 block w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
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
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="pl-10 block w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="signup-password"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
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
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="pl-10 pr-10 block w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
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

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-zinc-300 mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
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
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </span>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="pl-10 block w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] focus:ring-offset-black transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
                "Create Account"
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <p className="text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-[#1152d4] hover:text-[#1152d4]/80 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
