import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function buildTokenRequestDraft({ balance, isUnlimited, userEmail }) {
  const balanceLine = isUnlimited
    ? "Current balance: Unlimited"
    : `Current balance: ${balance.toLocaleString()} tokens`;

  return [
    "Hi,",
    "",
    "I would like to purchase more tokens for my account.",
    userEmail ? `Account email: ${userEmail}` : null,
    balanceLine,
    "",
    "Please share the next steps.",
    "",
    "Thanks,",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildGmailComposeUrl(contactEmail, draft) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: contactEmail,
    su: "Token Request - Aarannu",
    body: draft,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildMailtoUrl(contactEmail, draft) {
  const params = new URLSearchParams({
    subject: "Token Request - Aarannu",
    body: draft,
  });

  return `mailto:${contactEmail}?${params.toString()}`;
}

export default function TokenPurchase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [balance, setBalance] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUserEmail(user?.email || "");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("You need to sign in again before requesting more tokens.");
        }

        const res = await fetch(`${API}/api/tokens/balance`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Failed to load token contact details.");
        }

        setBalance(body?.balance || 0);
        setIsUnlimited(Boolean(body?.is_unlimited));
        setContactEmail(body?.contact_email || "");

        if (!body?.contact_email) {
          setError("Token contact email is not configured yet.");
        }
      } catch (err) {
        setError(err.message || "Failed to load token contact details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const draft = useMemo(
    () => buildTokenRequestDraft({ balance, isUnlimited, userEmail }),
    [balance, isUnlimited, userEmail],
  );

  const gmailUrl = useMemo(
    () => (contactEmail ? buildGmailComposeUrl(contactEmail, draft) : ""),
    [contactEmail, draft],
  );

  const mailtoUrl = useMemo(
    () => (contactEmail ? buildMailtoUrl(contactEmail, draft) : ""),
    [contactEmail, draft],
  );

  const handleOpenGmail = () => {
    if (!gmailUrl) return;
    window.location.assign(gmailUrl);
  };

  const handleOpenMailApp = () => {
    if (!mailtoUrl) return;
    window.location.assign(mailtoUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950/70 flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 px-4 py-10 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.35),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(239,68,68,0.2),_transparent_35%)]" />

      <div className="relative w-full max-w-xl rounded-[28px] border border-white/15 bg-white shadow-2xl overflow-hidden">
        <div className="bg-linear-to-r from-[#2563EB] to-[#ef4444] px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
            Buy Tokens
          </p>
          <h1 className="mt-2 text-2xl font-bold">Open a Gmail draft</h1>
          <p className="mt-2 text-sm text-white/85">
            We will prefill your token request and redirect you to Gmail so you
            can send it quickly.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Request Summary
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Send to:</span>{" "}
                {contactEmail || "Not configured"}
              </p>
              {userEmail && (
                <p>
                  <span className="font-semibold text-slate-900">Account:</span>{" "}
                  {userEmail}
                </p>
              )}
              <p>
                <span className="font-semibold text-slate-900">Balance:</span>{" "}
                {isUnlimited ? "Unlimited" : `${balance.toLocaleString()} tokens`}
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Gmail will open with the subject and message already filled in.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleOpenGmail}
              disabled={!contactEmail}
              className="flex-1 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Open Gmail
            </button>
            <button
              onClick={() => navigate("/tokens")}
              className="flex-1 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Tokens
            </button>
          </div>

          {contactEmail && (
            <button
              onClick={handleOpenMailApp}
              className="w-full text-sm font-medium text-[#2563EB] transition hover:underline"
            >
              Use the default mail app instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
