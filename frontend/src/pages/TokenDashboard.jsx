import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ── Tiny SVG-based line / area chart ──────────────────────── */
function MiniChart({ data, width = 600, height = 160, color = "#1152d4" }) {
  if (!data?.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const pad = { top: 20, right: 10, bottom: 30, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const pts = data.map((d, i) => ({
    x: pad.left + (i / Math.max(1, data.length - 1)) * w,
    y: pad.top + h - (d.count / max) * h,
    ...d,
  }));

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1].x},${pad.top + h} L${pts[0].x},${pad.top + h} Z`;

  // Y-axis ticks (5 steps)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = Math.round((max / 4) * i);
    const y = pad.top + h - (val / max) * h;
    return { val, y };
  });

  // X-axis labels (show ~6 evenly spaced)
  const xStep = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter(
    (_, i) => i % xStep === 0 || i === data.length - 1,
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxHeight: height }}
    >
      {/* Grid lines */}
      {yTicks.map((t) => (
        <g key={t.val}>
          <line
            x1={pad.left}
            y1={t.y}
            x2={width - pad.right}
            y2={t.y}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <text
            x={pad.left - 6}
            y={t.y + 4}
            textAnchor="end"
            className="fill-slate-400"
            style={{ fontSize: 10 }}
          >
            {t.val}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <path d={area} fill={color} opacity="0.08" />
      {/* Line */}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r="3"
            fill="white"
            stroke={color}
            strokeWidth="1.5"
          />
          <title>{`${p.date}: ${p.count}`}</title>
        </g>
      ))}
      {/* X-axis labels */}
      {xLabels.map((d) => {
        const i = data.indexOf(d);
        const x = pad.left + (i / Math.max(1, data.length - 1)) * w;
        return (
          <text
            key={d.date}
            x={x}
            y={height - 6}
            textAnchor="middle"
            className="fill-slate-400"
            style={{ fontSize: 9 }}
          >
            {d.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Bar chart variant ─────────────────────────────────────── */
function BarChart({ data, width = 600, height = 160, color = "#1152d4" }) {
  if (!data?.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const pad = { top: 20, right: 10, bottom: 30, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const barW = Math.max(4, w / data.length - 2);

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = Math.round((max / 4) * i);
    const y = pad.top + h - (val / max) * h;
    return { val, y };
  });

  const xStep = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxHeight: height }}
    >
      {yTicks.map((t) => (
        <g key={t.val}>
          <line
            x1={pad.left}
            y1={t.y}
            x2={width - pad.right}
            y2={t.y}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <text
            x={pad.left - 6}
            y={t.y + 4}
            textAnchor="end"
            className="fill-slate-400"
            style={{ fontSize: 10 }}
          >
            {t.val}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = pad.left + (i / data.length) * w + 1;
        const barH = (d.count / max) * h;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={pad.top + h - barH}
              width={barW}
              height={Math.max(1, barH)}
              rx="2"
              fill={color}
              opacity="0.75"
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
          </g>
        );
      })}
      {data
        .filter((_, i) => i % xStep === 0 || i === data.length - 1)
        .map((d) => {
          const i = data.indexOf(d);
          const x = pad.left + (i / data.length) * w + barW / 2;
          return (
            <text
              key={d.date}
              x={x}
              y={height - 6}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 9 }}
            >
              {d.date.slice(5)}
            </text>
          );
        })}
    </svg>
  );
}

/**
 * TokenDashboard — Token balance, usage analytics & transaction history.
 *
 * Sections:
 *   1. Balance + lifetime stats
 *   2. Tokens-per-day graph  (line chart, 30 days)
 *   3. Cards-generated-per-day graph (bar chart, 30 days)
 *   4. Transaction history (paginated + filterable)
 */
export default function TokenDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);

  // Balance state
  const [balance, setBalance] = useState(0);
  const [lifetimePurchased, setLifetimePurchased] = useState(0);
  const [lifetimeUsed, setLifetimeUsed] = useState(0);

  // Analytics state
  const [analytics, setAnalytics] = useState(null);

  // Cards-per-day state (from generated_ids)
  const [cardsPerDay, setCardsPerDay] = useState({});

  // Transaction state
  const [transactions, setTransactions] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnFilter, setTxnFilter] = useState("all");
  const [txnLoading, setTxnLoading] = useState(false);

  // Chart view toggle
  const [chartView, setChartView] = useState("line"); // "line" | "bar"

  const TXN_LIMIT = 15;

  // ── Fetch helpers ────────────────────────────────────────
  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  /** Parse API error JSON, detect "table not found" → setupRequired */
  const parseApiError = async (res, fallbackMsg) => {
    try {
      const body = await res.json();
      const msg = body?.error || fallbackMsg;
      if (
        msg.includes("schema cache") ||
        msg.includes("does not exist") ||
        msg.includes("token_wallets") ||
        msg.includes("token_transactions") ||
        msg.includes("token_packages")
      ) {
        setSetupRequired(true);
        return "Token system tables not found. Please run migration 003_token_system.sql in your Supabase SQL Editor.";
      }
      return msg;
    } catch {
      return fallbackMsg;
    }
  };

  const fetchBalance = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API}/api/tokens/balance`, { headers });
    if (!res.ok)
      throw new Error(await parseApiError(res, "Failed to fetch balance"));
    const data = await res.json();
    setBalance(data.is_unlimited ? Infinity : data.balance);
    setLifetimePurchased(data.lifetime_purchased);
    setLifetimeUsed(data.lifetime_used);
  }, [getAuthHeaders]);

  const fetchAnalytics = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API}/api/tokens/analytics`, { headers });
    if (!res.ok)
      throw new Error(await parseApiError(res, "Failed to fetch analytics"));
    setAnalytics(await res.json());
  }, [getAuthHeaders]);

  const fetchCardsPerDay = useCallback(async () => {
    // Query generated_ids from Supabase directly for cards-per-day stats
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error: qErr } = await supabase
      .from("generated_ids")
      .select("created_at")
      .eq("user_id", session.user.id)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (qErr) {
      console.warn("Could not fetch cards-per-day:", qErr.message);
      return;
    }

    const daily = {};
    for (const row of data || []) {
      const day = row.created_at?.slice(0, 10);
      if (day) daily[day] = (daily[day] || 0) + 1;
    }
    setCardsPerDay(daily);
  }, []);

  const fetchTransactions = useCallback(
    async (page = 1, type = "all") => {
      setTxnLoading(true);
      try {
        const headers = await getAuthHeaders();
        const typeParam = type !== "all" ? `&type=${type}` : "";
        const res = await fetch(
          `${API}/api/tokens/transactions?page=${page}&limit=${TXN_LIMIT}${typeParam}`,
          { headers },
        );
        if (!res.ok)
          throw new Error(
            await parseApiError(res, "Failed to fetch transactions"),
          );
        const data = await res.json();
        setTransactions(data.transactions);
        setTxnTotal(data.pagination.total);
      } finally {
        setTxnLoading(false);
      }
    },
    [getAuthHeaders],
  );

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // fetchCardsPerDay doesn't depend on token tables, so always try it
        const results = await Promise.allSettled([
          fetchBalance(),
          fetchAnalytics(),
          fetchTransactions(),
          fetchCardsPerDay(),
        ]);
        // Only show error if ALL token-related calls failed
        const tokenFailures = results
          .slice(0, 3)
          .filter((r) => r.status === "rejected");
        if (tokenFailures.length > 0) {
          setError(
            tokenFailures[0].reason?.message || "Failed to load token data",
          );
        }
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
    if (!loading && !setupRequired) fetchTransactions(txnPage, txnFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnPage, txnFilter]);

  // ── 30-day daily data for charts ─────────────────────────
  const last30Days = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);

  const tokensPerDayData = useMemo(
    () =>
      last30Days.map((date) => ({
        date,
        count: analytics?.daily_usage?.[date] || 0,
      })),
    [analytics, last30Days],
  );

  const cardsPerDayData = useMemo(
    () =>
      last30Days.map((date) => ({
        date,
        count: cardsPerDay[date] || 0,
      })),
    [cardsPerDay, last30Days],
  );

  const totalTokens30d = useMemo(
    () => tokensPerDayData.reduce((s, d) => s + d.count, 0),
    [tokensPerDayData],
  );
  const totalCards30d = useMemo(
    () => cardsPerDayData.reduce((s, d) => s + d.count, 0),
    [cardsPerDayData],
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
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
              {balance === Infinity ? "∞" : balance.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {balance === Infinity ? (
                <span className="text-purple-600 font-medium">
                  Admin · Unlimited
                </span>
              ) : (
                "tokens available"
              )}
            </p>
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

        {/* ─── Setup Required Banner ─── */}
        {setupRequired && (
          <div className="p-5 rounded-xl bg-amber-50 border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-2">
              Setup Required
            </h3>
            <p className="text-sm text-amber-700 mb-3">
              The token system tables have not been created yet. Run the
              following migration in your{" "}
              <strong>Supabase Dashboard → SQL Editor</strong>:
            </p>
            <code className="block bg-amber-100 rounded-lg px-4 py-2 text-xs text-amber-900 font-mono">
              backend/migrations/003_token_system.sql
            </code>
            <p className="text-xs text-amber-600 mt-2">
              Or run:{" "}
              <code className="font-mono">
                node scripts/run-migration.js 003
              </code>{" "}
              to view the SQL.
            </p>
          </div>
        )}

        {/* ─── Tokens Per Day — Line Chart (30 days) ─── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Tokens Used Per Day
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {totalTokens30d} tokens in the last 30 days
                {analytics ? ` · avg ${analytics.avg_daily}/day` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setChartView("line")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === "line" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                Line
              </button>
              <button
                onClick={() => setChartView("bar")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === "bar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                Bar
              </button>
            </div>
          </div>
          {chartView === "line" ? (
            <MiniChart data={tokensPerDayData} color="#1152d4" />
          ) : (
            <BarChart data={tokensPerDayData} color="#1152d4" />
          )}
        </div>

        {/* ─── Cards Generated Per Day — Bar Chart (30 days) ─── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Cards Generated Per Day
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {totalCards30d} cards in the last 30 days
                {totalCards30d > 0
                  ? ` · avg ${Math.round(totalCards30d / 30)}/day`
                  : ""}
              </p>
            </div>
          </div>
          <BarChart data={cardsPerDayData} color="#059669" />
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
