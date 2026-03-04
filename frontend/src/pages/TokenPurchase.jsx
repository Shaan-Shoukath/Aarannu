import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * TokenPurchase — Browse token packages and purchase credits.
 *
 * In production, the "Purchase" button would redirect to a
 * Stripe / Razorpay checkout. For now it calls the backend
 * directly which auto-credits the tokens (design-phase mock).
 */
export default function TokenPurchase() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null); // packageId being purchased
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        // Packages are public — no auth needed
        const pkgRes = await fetch(`${API}/api/tokens/packages`);
        if (!pkgRes.ok) throw new Error("Failed to load packages");
        const pkgData = await pkgRes.json();
        setPackages(pkgData.packages || []);

        // Fetch balance (authenticated)
        const headers = await getAuthHeaders();
        const balRes = await fetch(`${API}/api/tokens/balance`, { headers });
        if (balRes.ok) {
          const balData = await balRes.json();
          setBalance(balData.balance);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePurchase = async (pkg) => {
    try {
      setError("");
      setSuccess("");
      setPurchasing(pkg.id);

      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/api/tokens/purchase`, {
        method: "POST",
        headers,
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Purchase failed");
      }

      setBalance(data.new_balance);
      setSuccess(
        `${pkg.tokens} tokens added! New balance: ${data.new_balance}`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (cents, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const pricePerToken = (cents, tokens) => {
    return (cents / 100 / tokens).toFixed(3);
  };

  // Badge for "best value" on the middle package
  const bestValueIdx = packages.length >= 2 ? 1 : -1;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Header ─── */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center">
          <h1 className="text-3xl font-bold text-slate-800">
            Buy Token Credits
          </h1>
          <p className="text-slate-500 mt-2 max-w-xl mx-auto">
            Each token generates one ID card. Purchase a package below to get
            started. Tokens never expire.
          </p>
          {balance !== null && (
            <p className="mt-3 text-sm">
              Current balance:{" "}
              <span className="font-bold text-[#1152d4]">
                {balance.toLocaleString()} tokens
              </span>
            </p>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* ─── Package Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg, idx) => {
            const isBestValue = idx === bestValueIdx;
            return (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-2xl border-2 p-8 shadow-sm transition-all hover:shadow-md ${
                  isBestValue
                    ? "border-[#1152d4] shadow-[#1152d4]/10"
                    : "border-slate-200"
                }`}
              >
                {isBestValue && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#1152d4] text-white text-xs font-bold rounded-full uppercase tracking-wide">
                    Best Value
                  </span>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">
                    {pkg.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {pkg.description}
                  </p>
                </div>

                <div className="text-center mb-6">
                  <span className="text-4xl font-extrabold text-slate-800">
                    {formatPrice(pkg.price_cents, pkg.currency)}
                  </span>
                  <p className="text-sm text-slate-400 mt-1">
                    ${pricePerToken(pkg.price_cents, pkg.tokens)} per token
                  </p>
                </div>

                <div className="text-center mb-6">
                  <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    <svg
                      className="w-4 h-4 text-[#1152d4]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                    {pkg.tokens.toLocaleString()} tokens
                  </span>
                </div>

                <button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing !== null}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    isBestValue
                      ? "bg-[#1152d4] hover:bg-[#1152d4]/90 text-white shadow-lg shadow-[#1152d4]/20"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {purchasing === pkg.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Processing…
                    </span>
                  ) : (
                    `Purchase ${pkg.tokens} Tokens`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* ─── Custom / Enterprise CTA ─── */}
        <div className="mt-10 text-center bg-white rounded-2xl border border-slate-200 p-8">
          <h3 className="text-lg font-bold text-slate-800">
            Need a custom amount?
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            For enterprise volumes or custom pricing, reach out to our team.
            We offer volume discounts for 5 000+ tokens.
          </p>
          <button className="mt-4 px-6 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            Contact Sales
          </button>
        </div>

        {/* ─── Back to Tokens ─── */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/tokens")}
            className="text-sm text-[#1152d4] hover:underline"
          >
            ← Back to Token Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
