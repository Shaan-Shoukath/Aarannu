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
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-300 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-3 sm:px-4 py-6 sm:py-10 flex items-center justify-center font-['Public_Sans',sans-serif]">
      <div className="w-full max-w-xl rounded-2xl border border-white/12 bg-zinc-950 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/12">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Buy Tokens
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Open a Gmail draft</h1>
          <p className="mt-2 text-sm text-zinc-400">
            We will prefill your token request and redirect you to Gmail so you
            can send it quickly.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-white/12 bg-zinc-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Request Summary
            </p>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <p>
                <span className="font-semibold text-white">Send to:</span>{" "}
                {contactEmail || "Not configured"}
              </p>
              {userEmail && (
                <p>
                  <span className="font-semibold text-white">Account:</span>{" "}
                  {userEmail}
                </p>
              )}
              <p>
                <span className="font-semibold text-white">Balance:</span>{" "}
                {isUnlimited ? "Unlimited" : `${balance.toLocaleString()} tokens`}
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          ) : (
            <div className="rounded-xl border border-white/12 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
              Gmail will open with the subject and message already filled in.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleOpenGmail}
              disabled={!contactEmail}
              className="flex-1 rounded-xl bg-cyan-300 hover:bg-white px-5 py-3 text-sm font-semibold text-black transition shadow-sm shadow-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Open Gmail
            </button>
            <button
              onClick={() => navigate("/tokens")}
              className="flex-1 rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              Back to Tokens
            </button>
          </div>

          {contactEmail && (
            <button
              onClick={handleOpenMailApp}
              className="w-full text-sm font-medium text-cyan-300 transition hover:text-white hover:underline"
            >
              Use the default mail app instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
