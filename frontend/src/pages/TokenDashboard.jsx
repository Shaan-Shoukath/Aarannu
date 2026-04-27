import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BrandLogoLink from "../components/BrandLogoLink";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ── Tiny SVG-based line / area chart ──────────────────────── */
function MiniChart({ data, width = 600, height = 160, color = "#2563EB" }) {
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
          stroke="#27272a"
            strokeWidth="1"
          />
          <text
            x={pad.left - 6}
            y={t.y + 4}
            textAnchor="end"
            className="fill-zinc-600"
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
            className="fill-zinc-600"
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
function BarChart({ data, width = 600, height = 160, color = "#2563EB" }) {
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
          stroke="#27272a"
            strokeWidth="1"
          />
          <text
            x={pad.left - 6}
            y={t.y + 4}
            textAnchor="end"
            className="fill-zinc-600"
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-['Public_Sans',sans-serif] text-white">
      {/* ─── Header ─── */}
      <header className="bg-black/90 backdrop-blur-md border-b border-white/12 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <BrandLogoLink
              imageClassName="h-8 sm:h-9 w-auto"
              showText={false}
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-white">Tokens</h1>
              <p className="text-xs sm:text-sm text-zinc-400 hidden sm:block">
                Manage your credits &amp; view usage history
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => navigate("/tokens/purchase")}
              className="px-3 sm:px-5 py-2 sm:py-2.5 bg-cyan-300 hover:bg-white text-black text-xs sm:text-sm font-medium rounded-lg shadow-lg shadow-cyan-300/20 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="hidden sm:inline">Get More Tokens</span>
              <span className="sm:hidden">Buy</span>
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 sm:px-4 py-2 sm:py-2.5 border border-white/12 text-zinc-400 text-xs sm:text-sm font-medium rounded-lg hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-8">
        {error && (
          <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ─── Balance Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-zinc-950 rounded-xl border border-white/12 p-6">
            <p className="text-sm font-medium text-zinc-400 mb-1">
              Current Balance
            </p>
            <p className="text-3xl font-bold text-white">
              {balance === Infinity ? "∞" : balance.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {balance === Infinity ? (
                <span className="text-cyan-300 font-medium">
                  Admin · Unlimited
                </span>
              ) : (
                "tokens available"
              )}
            </p>
          </div>
          <div className="bg-zinc-950 rounded-xl border border-white/12 p-6">
            <p className="text-sm font-medium text-zinc-400 mb-1">
              Lifetime Purchased
            </p>
            <p className="text-3xl font-bold text-emerald-400">
              {lifetimePurchased.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-1">total tokens bought</p>
          </div>
          <div className="bg-zinc-950 rounded-xl border border-white/12 p-6">
            <p className="text-sm font-medium text-zinc-400 mb-1">
              Lifetime Used
            </p>
            <p className="text-3xl font-bold text-cyan-300">
              {lifetimeUsed.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-1">cards generated</p>
          </div>
        </div>

        {/* ─── Setup Required Banner ─── */}
        {setupRequired && (
          <div className="p-5 rounded-xl bg-amber-900/30 border border-amber-700">
            <h3 className="font-semibold text-amber-400 mb-2">
              Setup Required
            </h3>
            <p className="text-sm text-amber-400/80 mb-3">
              The token system tables have not been created yet. Run the
              following migration in your{" "}
              <strong>Supabase Dashboard → SQL Editor</strong>:
            </p>
            <code className="block bg-amber-900/40 rounded-lg px-4 py-2 text-xs text-amber-300 font-mono">
              backend/migrations/003_token_system.sql
            </code>
            <p className="text-xs text-amber-500 mt-2">
              Or run:{" "}
              <code className="font-mono">
                node scripts/run-migration.js 003
              </code>{" "}
              to view the SQL.
            </p>
          </div>
        )}

        {/* ─── Tokens Per Day — Line Chart (30 days) ─── */}
        <div className="bg-zinc-950 rounded-xl border border-white/12 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Tokens Used Per Day
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {totalTokens30d} tokens in the last 30 days
                {analytics ? ` · avg ${analytics.avg_daily}/day` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setChartView("line")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === "line" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Line
              </button>
              <button
                onClick={() => setChartView("bar")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === "bar" ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Bar
              </button>
            </div>
          </div>
          {chartView === "line" ? (
            <MiniChart data={tokensPerDayData} color="#67e8f9" />
          ) : (
            <BarChart data={tokensPerDayData} color="#67e8f9" />
          )}
        </div>

        {/* ─── Cards Generated Per Day — Bar Chart (30 days) ─── */}
        <div className="bg-zinc-950 rounded-xl border border-white/12 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Cards Generated Per Day
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {totalCards30d} cards in the last 30 days
                {totalCards30d > 0
                  ? ` · avg ${Math.round(totalCards30d / 30)}/day`
                  : ""}
              </p>
            </div>
          </div>
          <BarChart data={cardsPerDayData} color="#34d399" />
        </div>

        {/* ─── Transaction History ─── */}
        <div className="bg-zinc-950 rounded-xl border border-white/12 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-white/12 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-white">
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
                      ? "bg-cyan-300 text-black"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {txnLoading ? (
            <div className="p-8 text-center text-zinc-500">Loading…</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 bg-zinc-900">
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
                    <tr key={txn.id} className="hover:bg-white/5 border-b border-white/8">
                      <td className="px-6 py-3 text-zinc-400 whitespace-nowrap">
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
                      <td className="px-6 py-3 text-zinc-400 max-w-xs truncate">
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
              <p className="text-sm text-zinc-400">
                Page {txnPage} of {totalPages} ({txnTotal} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTxnPage((p) => Math.max(1, p - 1))}
                  disabled={txnPage <= 1}
                  className="px-3 py-1.5 text-sm rounded border border-white/12 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setTxnPage((p) => Math.min(totalPages, p + 1))}
                  disabled={txnPage >= totalPages}
                  className="px-3 py-1.5 text-sm rounded border border-white/12 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
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
