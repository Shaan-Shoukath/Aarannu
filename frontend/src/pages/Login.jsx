import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccessStatusScreen from "../components/AccessStatusScreen";
import BrandLogoLink from "../components/BrandLogoLink";
import { getMemberApprovalRecord } from "../lib/memberApproval";
import { ensureStarterTokens } from "../lib/starterTokens";
import { supabase } from "../lib/supabaseClient";

/**
 * Login Page
 * --------------------------------------------------
 * Design: Split-screen layout.
 * Left half  - decorative ID card preview (hidden on mobile).
 * Right half - email + password, then email OTP (2FA).
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [approvalScreen, setApprovalScreen] = useState(null);

  // forgotStep: false | 'email' | 'otp' | 'newpass'
  const [forgotStep, setForgotStep] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotOtpMessage, setForgotOtpMessage] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotShowPass, setForgotShowPass] = useState(false);
  const [forgotShowConfirm, setForgotShowConfirm] = useState(false);

  // Handle magic link callbacks — Supabase sets the session in the URL hash
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard", { replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/dashboard", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setApprovalScreen(null);

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
        setError("Invalid email or password. Please try again.");
        return;
      }

      await supabase.auth.signOut();

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });

      if (otpError) {
        setError("Failed to send verification code. Please try again.");
        return;
      }

      setOtpMessage("A verification code has been sent to your email.");
      setOtpStep(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setOtpMessage("");

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError("Please enter the full verification code from your email.");
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

      const userId = verifyData?.user?.id;
      if (!userId) {
        await supabase.auth.signOut();
        setError(
          "We verified your email, but couldn't confirm your account. Please try again.",
        );
        return;
      }

      const { member, error: memberError } = await getMemberApprovalRecord(
        userId,
      );

      if (memberError) {
        console.error("Approval lookup failed:", memberError);
        await supabase.auth.signOut();
        setError(
          "We verified your email, but couldn't confirm your approval status. Please try again.",
        );
        return;
      }

      if (!member) {
        await supabase.auth.signOut();
        setOtpStep(false);
        setOtpCode("");
        setApprovalScreen("missing");
        return;
      }

      if (!member.approved) {
        await supabase.auth.signOut();
        setOtpStep(false);
        setOtpCode("");
        setApprovalScreen("pending");
        return;
      }

      const accessToken =
        verifyData?.session?.access_token ||
        (await supabase.auth.getSession()).data.session?.access_token;
      await ensureStarterTokens(accessToken);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setOtpMessage("");
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });

      if (otpError) {
        setError(otpError.message || "Failed to resend code.");
      } else {
        setOtpMessage("A new code has been sent to your email.");
      }
    } catch {
      setError("Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!forgotEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: forgotEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (otpError) {
        setError("Failed to send verification code. Please try again.");
        return;
      }
      setForgotOtpMessage("A verification code has been sent to your email.");
      setForgotStep("otp");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setForgotOtpMessage("");
    if (!forgotOtp.trim() || forgotOtp.trim().length < 6) {
      setError("Please enter the full verification code from your email.");
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: forgotEmail.trim(),
        token: forgotOtp.trim(),
        type: "email",
      });
      if (verifyError) {
        setError("Invalid or expired code. Please try again.");
        return;
      }
      setForgotStep("newpass");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResendOtp = async () => {
    setError("");
    setForgotOtpMessage("");
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: forgotEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (otpError) {
        setError(otpError.message || "Failed to resend code.");
      } else {
        setForgotOtpMessage("A new code has been sent to your email.");
      }
    } catch {
      setError("Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (forgotPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: forgotPassword,
      });
      if (updateError) {
        setError(updateError.message || "Failed to update password. Please try again.");
        return;
      }
      await supabase.auth.signOut();
      setForgotStep(false);
      setForgotEmail("");
      setForgotOtp("");
      setForgotPassword("");
      setForgotConfirm("");
      setError("");
      setSuccessMessage("Password updated successfully. Please sign in with your new password.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (approvalScreen === "pending") {
    return (
      <AccessStatusScreen
        title="Account Pending Approval"
        message="Your email is verified, but an organization admin still needs to approve your membership before you can sign in."
        details="You'll receive an email once your account is approved and your ID card is ready."
        tone="pending"
        primaryLabel="Back to Login"
        primaryAction={() => setApprovalScreen(null)}
        secondaryLabel="Create Another Account"
        secondaryTo="/signup"
      />
    );
  }

  if (approvalScreen === "missing") {
    return (
      <AccessStatusScreen
        title="Membership Record Not Found"
        message="We couldn't find your member profile after sign-in, so access has been blocked for safety."
        details="Please contact your administrator if this keeps happening."
        tone="blocked"
        primaryLabel="Back to Login"
        primaryAction={() => setApprovalScreen(null)}
        secondaryLabel="Go Home"
        secondaryTo="/"
      />
    );
  }

  const forgotBackToLogin = () => {
    setForgotStep(false);
    setForgotEmail("");
    setForgotOtp("");
    setForgotOtpMessage("");
    setForgotPassword("");
    setForgotConfirm("");
    setError("");
    setSuccessMessage("");
  };

  // ── Step 1: enter email ──────────────────────────────────────────────────
  if (forgotStep === "email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8] font-['Public_Sans',sans-serif] px-4 py-8 sm:p-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="text-center">
            <BrandLogoLink className="justify-center mb-6" imageClassName="h-12 w-auto" />
            <div className="w-14 h-14 bg-[#1152d4]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#1152d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset your password</h1>
            <p className="text-slate-500 text-sm">Enter your email and we&apos;ll send you a verification code.</p>
          </div>

          <form onSubmit={handleForgotSendOtp} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1">
                Email address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="pl-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] sm:text-sm py-2.5 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Send verification code"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            <button type="button" onClick={forgotBackToLogin} className="text-[#1152d4] hover:underline font-medium">
              Back to login
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: enter OTP ────────────────────────────────────────────────────
  if (forgotStep === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8] font-['Public_Sans',sans-serif] px-4 py-8 sm:p-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="text-center">
            <BrandLogoLink className="justify-center mb-6" imageClassName="h-12 w-auto" />
            <div className="w-14 h-14 bg-[#1152d4]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#1152d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
            <p className="text-slate-500 text-sm">
              Enter the verification code sent to{" "}
              <span className="font-medium text-slate-700">{forgotEmail}</span>
            </p>
          </div>

          <form onSubmit={handleForgotVerifyOtp} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}
            {forgotOtpMessage && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{forgotOtpMessage}</div>
            )}
            <div>
              <label htmlFor="forgot-otp" className="block text-sm font-medium text-slate-700 mb-1">
                Verification Code
              </label>
              <input
                id="forgot-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6,8}"
                maxLength={8}
                required
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="000000"
                className="block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] sm:text-sm py-3 outline-none tracking-[0.5em] text-center font-mono text-xl"
              />
            </div>
            <p className="text-xs text-slate-500 text-center">
              Didn&apos;t receive the code?{" "}
              <button
                type="button"
                onClick={handleForgotResendOtp}
                disabled={loading}
                className="text-[#1152d4] hover:underline font-medium"
              >
                Resend code
              </button>
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Verify code"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            <button
              type="button"
              onClick={() => { setForgotStep("email"); setForgotOtp(""); setError(""); setForgotOtpMessage(""); }}
              className="text-[#1152d4] hover:underline font-medium"
            >
              Back
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 3: set new password ─────────────────────────────────────────────
  if (forgotStep === "newpass") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8] font-['Public_Sans',sans-serif] px-4 py-8 sm:p-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="text-center">
            <BrandLogoLink className="justify-center mb-6" imageClassName="h-12 w-auto" />
            <div className="w-14 h-14 bg-[#1152d4]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#1152d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Set new password</h1>
            <p className="text-slate-500 text-sm">Choose a strong password for your account.</p>
          </div>

          <form onSubmit={handleForgotSetPassword} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
                New password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="new-password"
                  type={forgotShowPass ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="pl-10 pr-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] sm:text-sm py-2.5 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setForgotShowPass(!forgotShowPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {forgotShowPass ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                Confirm password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="confirm-password"
                  type={forgotShowConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={forgotConfirm}
                  onChange={(e) => setForgotConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  className="pl-10 pr-10 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] sm:text-sm py-2.5 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setForgotShowConfirm(!forgotShowConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {forgotShowConfirm ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (otpStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8] font-['Public_Sans',sans-serif] px-4 py-8 sm:p-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="text-center">
            <BrandLogoLink
              className="justify-center mb-6"
              imageClassName="h-12 w-auto"
            />
            <div className="w-14 h-14 bg-[#1152d4]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-[#1152d4]"
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
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Two-Factor Verification
            </h1>
            <p className="text-slate-500 text-sm">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-slate-700">{email}</span>
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
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6,8}"
                maxLength={8}
                required
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="000000"
                className="block w-full rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm focus:border-[#1152d4] sm:text-sm py-3 outline-none tracking-[0.5em] text-center font-mono text-xl"
              />
            </div>

            <p className="text-xs text-slate-500 text-center">
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
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
                "Verify and Sign in"
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
              Back to login
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
    .card-float { animation: cardFloat 7s ease-in-out infinite; transition: transform 2.5s ease-in-out; }
    .card-float:hover { animation: none; transform: rotate(0deg) scale(1.05); transition: transform 2.5s ease-in-out; }
  `}</style>
  <div className="min-h-screen flex bg-black font-['Public_Sans',sans-serif]">
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-900 items-center justify-center">
        {/* Back to home */}
        <a href="/" className="absolute top-6 left-6 z-30 flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to home
        </a>
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-20 -left-20 w-150 h-150 bg-linear-to-br from-[#1152d4] via-blue-600 to-transparent rounded-full blur-[100px] opacity-60" />
          <div className="absolute -bottom-20 -right-20 w-150 h-150 bg-linear-to-tl from-[#1152d4] via-blue-800 to-transparent rounded-full blur-[100px] opacity-40" />
          <div
            className="absolute inset-0 bg-slate-900/40 z-10"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        <div className="card-float relative z-20">
          <div
            className="w-105 bg-white rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10 relative"
            style={{ aspectRatio: "85.6 / 53.98" }}
          >
            <div className="absolute inset-0 z-0">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-linear-to-bl from-[#1152d4] to-blue-600 rounded-full blur-2xl opacity-20" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-linear-to-tr from-[#7C3AED] to-purple-400 rounded-full blur-2xl opacity-10" />
            </div>

            <div className="absolute top-4 left-6 right-6 flex items-center gap-2 z-10">
              <img src="/aarannu.png" alt="" className="h-8 w-auto" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold text-[#1152d4] uppercase tracking-wide">
                  Aarannu
                </span>
                <span className="text-[8px] text-slate-500 font-medium">
                  Community Edition
                </span>
              </div>
            </div>

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
                    Shaan Shoukath
                  </h3>
                  <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">
                    Inventory Manager
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">
                      EMP ID
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-700">
                      INV-2026
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">
                      Join Date
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700">
                      Jan 2026
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
              <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39s-4.66 1.97-4.66 4.39c0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12z" />
            </svg>
          </div>
        </div>

        <div className="absolute bottom-12 left-12 z-20 text-white max-w-md">
          <h2 className="text-3xl font-bold mb-2">
            Identity Verification Made Simple
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Secure thousands of digital assets instantly. Streamlined identity
            management for modern enterprises.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-4 py-6 sm:p-8 lg:p-12 bg-black relative">
        {/* Mobile back to home */}
        <a href="/" className="lg:hidden absolute top-4 left-4 flex items-center gap-1 text-zinc-400 hover:text-[#1152d4] text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Home
        </a>
        <div className="w-full max-w-md lg:max-w-110 space-y-6 sm:space-y-8 mt-8 lg:mt-0">
          <div className="text-center lg:text-left">
            <BrandLogoLink
              className="justify-center lg:justify-start mb-6"
              imageClassName="h-12 w-auto"
            />
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back
            </h1>
            <p className="text-zinc-400">
              Log in to your secure identity dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {successMessage && (
              <div className="p-3 rounded-lg bg-green-900/30 border border-green-700 text-green-400 text-sm">{successMessage}</div>
            )}
            {error && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-400 text-sm">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1">Email address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                    className="pl-10 block w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 shadow-sm focus:border-[#1152d4] focus:ring-[#1152d4] sm:text-sm py-2.5 outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="pl-10 pr-10 block w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder-zinc-500 shadow-sm focus:border-[#1152d4] sm:text-sm py-2.5 outline-none"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300">
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
              <div className="flex items-center">
                <input id="remember-me" type="checkbox" className="h-4 w-4 text-[#1152d4] focus:ring-[#1152d4] border-zinc-600 rounded bg-zinc-900" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-zinc-400">Keep me logged in for 30 days</label>
              </div>
              <button type="button" onClick={() => { setForgotEmail(email); setError(""); setSuccessMessage(""); setForgotStep("email"); }} className="text-sm font-medium text-[#1152d4] hover:text-[#1152d4]/80 transition-colors text-left sm:text-right py-2 px-1">
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-[#1152d4] hover:bg-[#1152d4]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1152d4] focus:ring-offset-black transition-all duration-200 shadow-lg shadow-[#1152d4]/25 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : (<><span>Sign in</span><span>&rarr;</span></>)}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-semibold text-[#1152d4] hover:text-[#1152d4]/80 transition-colors">Get started for free</Link>
          </p>

          <div className="flex items-center justify-center gap-4 pt-2">
            <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Security</a>
            <span className="text-zinc-700">.</span>
            <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <span className="text-zinc-700">.</span>
            <a href="#" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
