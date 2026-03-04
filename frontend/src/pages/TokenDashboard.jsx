import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * TokenDashboard — Token balance, usage analytics & transaction history.
 *
 * Sections:
 *   1. Balance + lifetime stats
 *   2. Usage sparkline (last 30 days)
 *   3. Transaction history (paginated + filterable)
 */
export default function TokenDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Balance state
  const [balance, setBalance] = useState(0);
  const [lifetimePurchased, setLifetimePurchased] = useState(0);
  const [lifetimeUsed, setLifetimeUsed] = useState(0);

  // Analytics state
  const [analytics, setAnalytics] = useState(null);

  // Transaction state
  const [transactions, setTransactions] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnFilter, setTxnFilter] = useState("all");
  const [txnLoading, setTxnLoading] = useState(false);

  const TXN_LIMIT = 15;

  // ── Fetch helpers ────────────────────────────────────────
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

  const fetchBalance = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API}/api/tokens/balance`, { headers });
    if (!res.ok) throw new Error("Failed to fetch balance");
    const data = await res.json();
    setBalance(data.balance);
    setLifetimePurchased(data.lifetime_purchased);
    setLifetimeUsed(data.lifetime_used);
  };

  const fetchAnalytics = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API}/api/tokens/analytics`, { headers });
    if (!res.ok) throw new Error("Failed to fetch analytics");
    setAnalytics(await res.json());
  };

  const fetchTransactions = async (page = 1, type = "all") => {
    setTxnLoading(true);
    try {
      const headers = await getAuthHeaders();
      const typeParam = type !== "all" ? `&type=${type}` : "";
      const res = await fetch(
        `${API}/api/tokens/transactions?page=${page}&limit=${TXN_LIMIT}${typeParam}`,
        { headers },
      );
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      setTransactions(data.transactions);
      setTxnTotal(data.pagination.total);
    } finally {
      setTxnLoading(false);
    }
  };

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchBalance(), fetchAnalytics(), fetchTransactions()]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pagination / filter change ───────────────────────────
  useEffect(() => {
    if (!loading) fetchTransactions(txnPage, txnFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnPage, txnFilter]);

  // ── 30-day sparkline data ────────────────────────────────
  const sparkData = useMemo(() => {
    if (!analytics?.daily_usage) return [];
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: analytics.daily_usage[key] || 0 });
    }
    return days;
  }, [analytics]);

  const sparkMax = useMemo(
    () => Math.max(1, ...sparkData.map((d) => d.count)),
    [sparkData],
  );

  const totalPages = Math.ceil(txnTotal / TXN_LIMIT);

  // ── Type badge colors ────────────────────────────────────
  const typeBadge = (type) => {
    const map = {
      purchase: "bg-green-100 text-green-700",
      usage: "bg-blue-100 text-blue-700",
      refund: "bg-amber-100 text-amber-700",
      bonus: "bg-purple-100 text-purple-700",
      adjustment: "bg-slate-100 text-slate-600",
    };
    return map[type] || "bg-slate-100 text-slate-600";
  };

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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Tokens</h1>
            <p className="text-sm text-slate-500">
              Manage your credits &amp; view usage history
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/tokens/purchase")}
              className="px-5 py-2.5 bg-[#1152d4] hover:bg-[#1152d4]/90 text-white text-sm font-medium rounded-lg shadow-lg shadow-[#1152d4]/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Buy Tokens
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ─── Balance Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Current Balance
            </p>
            <p className="text-3xl font-bold text-slate-800">
              {balance.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">tokens available</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Lifetime Purchased
            </p>
            <p className="text-3xl font-bold text-green-600">
              {lifetimePurchased.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">total tokens bought</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Lifetime Used
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {lifetimeUsed.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">cards generated</p>
          </div>
        </div>

        {/* ─── Usage Sparkline (30 days) ─── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Usage – Last 30 Days
            </h2>
            {analytics && (
              <span className="text-sm text-slate-500">
                {analytics.used_last_30d} tokens · avg{" "}
                {analytics.avg_daily}/day
              </span>
            )}
          </div>
          <div className="flex items-end gap-1 h-24">
            {sparkData.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-t bg-[#1152d4] opacity-80 hover:opacity-100 transition-opacity cursor-default"
                style={{
                  height: `${Math.max(4, (d.count / sparkMax) * 100)}%`,
                }}
                title={`${d.date}: ${d.count} tokens`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>{sparkData[0]?.date}</span>
            <span>{sparkData[sparkData.length - 1]?.date}</span>
          </div>
        </div>

        {/* ─── Transaction History ─── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-slate-800">
              Transaction History
            </h2>
            <div className="flex items-center gap-2">
              {["all", "purchase", "usage", "refund", "bonus"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTxnFilter(t);
                    setTxnPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    txnFilter === t
                      ? "bg-[#1152d4] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {txnLoading ? (
            <div className="p-8 text-center text-slate-400">Loading…</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 bg-slate-50">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Description</th>
                    <th className="px-6 py-3 font-medium text-right">Amount</th>
                    <th className="px-6 py-3 font-medium text-right">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(txn.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge(txn.type)}`}
                        >
                          {txn.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600 max-w-xs truncate">
                        {txn.description || "—"}
                      </td>
                      <td
                        className={`px-6 py-3 text-right font-semibold ${
                          txn.amount > 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {txn.amount > 0 ? "+" : ""}
                        {txn.amount}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500">
                        {txn.balance_after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Page {txnPage} of {totalPages} ({txnTotal} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
                  disabled={txnPage <= 1}
                  className="px-3 py-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setTxnPage((p) => Math.min(totalPages, p + 1))}
                  disabled={txnPage >= totalPages}
                  className="px-3 py-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
