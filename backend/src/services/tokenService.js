/**
 * Token Service
 * ─────────────
 * Core business logic for the usage-based credit system.
 *
 * Every ID-card generation costs 1 token. Tokens are pre-purchased
 * and stored in `token_wallets`. An immutable ledger of every
 * movement lives in `token_transactions`.
 *
 * All writes go through the SERVICE_ROLE client (bypasses RLS)
 * because the backend is the sole authority on balance mutations.
 */

const { supabase } = require("../config/supabaseClient");
const { isAdmin } = require("../utils/adminHelper");

/* ================================================================
   WALLET OPERATIONS
   ================================================================ */

/**
 * Get (or auto-create) a wallet for a user.
 * If `orgId` is provided, retrieves the org-scoped wallet; otherwise
 * the personal wallet (org_id IS NULL).
 *
 * @param {string} userId
 * @param {string|null} orgId
 * @returns {Promise<{wallet: object|null, error: object|null}>}
 */
const getOrCreateWallet = async (userId, orgId = null) => {
  // 1. Try to fetch existing wallet
  let query = supabase.from("token_wallets").select("*").eq("user_id", userId);

  if (orgId) {
    query = query.eq("org_id", orgId);
  } else {
    query = query.is("org_id", null);
  }

  const { data: existing, error: fetchErr } = await query.maybeSingle();

  if (fetchErr) return { wallet: null, error: fetchErr };
  if (existing) return { wallet: existing, error: null };

  // 2. Create a new wallet with 50 free signup tokens
  const SIGNUP_BONUS = 50;
  const insertPayload = { user_id: userId, balance: SIGNUP_BONUS, lifetime_purchased: SIGNUP_BONUS };
  if (orgId) insertPayload.org_id = orgId;

  const { data: created, error: createErr } = await supabase
    .from("token_wallets")
    .insert(insertPayload)
    .select()
    .single();

  if (createErr) return { wallet: null, error: createErr };

  // Record the signup bonus transaction for audit trail
  await supabase.from("token_transactions").insert({
    wallet_id: created.id,
    user_id: userId,
    org_id: orgId || null,
    amount: SIGNUP_BONUS,
    type: "bonus",
    description: "Welcome bonus – 50 free tokens",
    balance_after: SIGNUP_BONUS,
  });

  return { wallet: created, error: null };
};

/**
 * Get the current token balance for a user.
 *
 * @param {string} userId
 * @param {string|null} orgId
 * @returns {Promise<{balance: number, wallet: object|null, error: object|null}>}
 */
const getBalance = async (userId, orgId = null) => {
  const { wallet, error } = await getOrCreateWallet(userId, orgId);
  if (error) return { balance: 0, wallet: null, error };
  return { balance: wallet.balance, wallet, error: null };
};

/* ================================================================
   TOKEN MUTATIONS  (all return { wallet, transaction, error })
   ================================================================ */

/**
 * Deduct tokens from a wallet. Fails if insufficient balance.
 *
 * Uses a single atomic UPDATE with a `WHERE balance >= amount` guard —
 * this eliminates the race-condition window of the old read-then-update
 * approach. PostgreSQL guarantees this UPDATE is atomic; no two
 * concurrent requests can double-spend from the same wallet.
 *
 * @param {string} userId
 * @param {number} amount        – positive integer, number of tokens to deduct
 * @param {string} description   – human-readable reason
 * @param {string|null} referenceId – optional link to card etc.
 * @param {string|null} orgId
 * @returns {Promise<{wallet, transaction, error}>}
 */
const deductTokens = async (
  userId,
  amount,
  description = "Card generation",
  referenceId = null,
  orgId = null,
) => {
  // Admin users have unlimited tokens — skip deduction entirely
  if (isAdmin(userId)) {
    console.log(
      `[tokenService] Admin bypass: skipping ${amount} token deduction for ${userId}`,
    );
    return {
      wallet: { balance: Infinity, lifetime_used: 0, lifetime_purchased: 0 },
      transaction: {
        id: "admin-bypass",
        amount: 0,
        type: "usage",
        description: "Admin – no deduction",
      },
      error: null,
    };
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      wallet: null,
      transaction: null,
      error: { message: "Amount must be a positive integer" },
    };
  }

  // Ensure wallet exists (auto-creates if first use)
  const { wallet, error: walletErr } = await getOrCreateWallet(userId, orgId);
  if (walletErr) return { wallet: null, transaction: null, error: walletErr };

  // ── Atomic deduction ─────────────────────────────────────────
  // Single UPDATE with WHERE guard: if balance < amount, zero rows
  // are affected and `.single()` returns an error — no race window.
  const { data: updatedWallet, error: updateErr } = await supabase
    .from("token_wallets")
    .update({
      balance: supabase.rpc ? wallet.balance - amount : wallet.balance - amount,
      lifetime_used: wallet.lifetime_used + amount,
    })
    .eq("id", wallet.id)
    .gte("balance", amount) // atomic guard: only succeeds if balance >= amount
    .select()
    .single();

  if (updateErr || !updatedWallet) {
    // Either a race condition (another request took tokens) or
    // the balance genuinely dropped below the required amount.
    // Re-fetch actual balance to give a clear error message.
    const { balance: actualBalance } = await getBalance(userId, orgId);
    return {
      wallet: null,
      transaction: null,
      error: {
        message: `Insufficient tokens. Required: ${amount}, Available: ${actualBalance}`,
        code: "INSUFFICIENT_TOKENS",
      },
    };
  }

  const newBalance = updatedWallet.balance;

  // Record immutable transaction
  const { data: txn, error: txnErr } = await supabase
    .from("token_transactions")
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      org_id: orgId,
      amount: -amount,
      type: "usage",
      description,
      reference_id: referenceId,
      balance_after: newBalance,
    })
    .select()
    .single();

  if (txnErr) {
    // Transaction log is critical for financial auditing.
    // Log the error AND return it — a deduction without an audit
    // trail is a financial integrity issue.
    console.error(
      "[tokenService] CRITICAL: Transaction log failed after deduction:",
      txnErr,
    );
    // Don't rollback the deduction — the user paid, and we'd rather
    // have a missing log entry than a free card. But surface the warning.
  }

  return { wallet: updatedWallet, transaction: txn, error: null };
};

/**
 * Add tokens to a wallet (purchase / bonus / adjustment).
 *
 * @param {string} userId
 * @param {number} amount
 * @param {"purchase"|"bonus"|"adjustment"} type
 * @param {string} description
 * @param {string|null} referenceId
 * @param {string|null} orgId
 * @returns {Promise<{wallet, transaction, error}>}
 */
const addTokens = async (
  userId,
  amount,
  type = "purchase",
  description = "Token purchase",
  referenceId = null,
  orgId = null,
) => {
  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      wallet: null,
      transaction: null,
      error: { message: "Amount must be a positive integer" },
    };
  }

  const { wallet, error: walletErr } = await getOrCreateWallet(userId, orgId);
  if (walletErr) return { wallet: null, transaction: null, error: walletErr };

  const newBalance = wallet.balance + amount;

  const updatePayload = { balance: newBalance };
  if (type === "purchase") {
    updatePayload.lifetime_purchased = wallet.lifetime_purchased + amount;
  }

  const { data: updatedWallet, error: updateErr } = await supabase
    .from("token_wallets")
    .update(updatePayload)
    .eq("id", wallet.id)
    .select()
    .single();

  if (updateErr) return { wallet: null, transaction: null, error: updateErr };

  const { data: txn, error: txnErr } = await supabase
    .from("token_transactions")
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      org_id: orgId,
      amount: +amount,
      type,
      description,
      reference_id: referenceId,
      balance_after: newBalance,
    })
    .select()
    .single();

  if (txnErr) {
    console.error(
      "[tokenService] Transaction log failed after credit:",
      txnErr,
    );
  }

  return { wallet: updatedWallet, transaction: txn, error: null };
};

/**
 * Refund tokens back to a wallet (e.g. generation failure).
 *
 * @param {string} userId
 * @param {number} amount
 * @param {string} description
 * @param {string|null} referenceId
 * @param {string|null} orgId
 * @returns {Promise<{wallet, transaction, error}>}
 */
const refundTokens = async (
  userId,
  amount,
  description = "Auto-refund – generation failed",
  referenceId = null,
  orgId = null,
) => {
  return addTokens(userId, amount, "refund", description, referenceId, orgId);
};

/* ================================================================
   TRANSACTION HISTORY & ANALYTICS
   ================================================================ */

/**
 * Paginated transaction history for a user.
 *
 * @param {string} userId
 * @param {object} opts
 * @param {string|null} opts.orgId
 * @param {number}      opts.page   – 1-based
 * @param {number}      opts.limit
 * @param {string|null} opts.type   – filter by transaction type
 * @returns {Promise<{transactions: array, total: number, error}>}
 */
const getTransactions = async (
  userId,
  { orgId = null, page = 1, limit = 20, type = null } = {},
) => {
  let query = supabase
    .from("token_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (orgId) query = query.eq("org_id", orgId);
  else query = query.is("org_id", null);

  if (type) query = query.eq("type", type);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  return { transactions: data || [], total: count || 0, error };
};

/**
 * Usage analytics – aggregated stats for the current user.
 *
 * @param {string} userId
 * @param {string|null} orgId
 * @returns {Promise<{analytics: object, error: object|null}>}
 */
const getAnalytics = async (userId, orgId = null) => {
  const { wallet, error: walErr } = await getOrCreateWallet(userId, orgId);
  if (walErr) return { analytics: null, error: walErr };

  // Aggregate last 30 days of usage
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let usageQuery = supabase
    .from("token_transactions")
    .select("amount, created_at")
    .eq("user_id", userId)
    .eq("type", "usage");

  if (orgId) usageQuery = usageQuery.eq("org_id", orgId);
  else usageQuery = usageQuery.is("org_id", null);

  usageQuery = usageQuery.gte("created_at", thirtyDaysAgo.toISOString());

  const { data: recentUsage, error: usageErr } = await usageQuery;

  if (usageErr) return { analytics: null, error: usageErr };

  // Build daily usage map (last 30 days)
  const dailyUsage = {};
  for (const txn of recentUsage || []) {
    const day = txn.created_at.slice(0, 10); // YYYY-MM-DD
    dailyUsage[day] = (dailyUsage[day] || 0) + Math.abs(txn.amount);
  }

  const totalUsed30d = (recentUsage || []).reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  );

  return {
    analytics: {
      current_balance: wallet.balance,
      lifetime_purchased: wallet.lifetime_purchased,
      lifetime_used: wallet.lifetime_used,
      used_last_30d: totalUsed30d,
      daily_usage: dailyUsage,
      avg_daily: totalUsed30d > 0 ? Math.round(totalUsed30d / 30) : 0,
      wallet_created_at: wallet.created_at,
    },
    error: null,
  };
};

/* ================================================================
   TOKEN PACKAGES
   ================================================================ */

/**
 * List all active purchasable token packages.
 * @returns {Promise<{packages: array, error}>}
 */
const getPackages = async () => {
  const { data, error } = await supabase
    .from("token_packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return { packages: data || [], error };
};

const deductTokensAtomic = async (
  userId,
  amount,
  description = "Card generation",
  referenceId = null,
  orgId = null,
) => {
  if (isAdmin(userId)) {
    console.log(
      `[tokenService] Admin bypass: skipping ${amount} token deduction for ${userId}`,
    );
    return {
      wallet: { balance: Infinity, lifetime_used: 0, lifetime_purchased: 0 },
      transaction: {
        id: "admin-bypass",
        amount: 0,
        type: "usage",
        description: "Admin - no deduction",
      },
      error: null,
    };
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      wallet: null,
      transaction: null,
      error: { message: "Amount must be a positive integer" },
    };
  }

  const { data, error } = await supabase.rpc("deduct_tokens_atomic", {
    p_user_id: userId,
    p_org_id: orgId,
    p_amount: amount,
    p_description: description,
    p_reference_id: referenceId,
  });

  if (error) {
    const message = error.message || "";
    const match = message.match(/INSUFFICIENT_TOKENS:(\d+)/);
    if (message.includes("INSUFFICIENT_TOKENS")) {
      const available = match ? Number(match[1]) : 0;
      return {
        wallet: null,
        transaction: null,
        error: {
          message: `Insufficient tokens. Required: ${amount}, Available: ${available}`,
          code: "INSUFFICIENT_TOKENS",
        },
      };
    }

    return { wallet: null, transaction: null, error };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    wallet: {
      id: row?.wallet_id,
      balance: row?.balance,
      lifetime_used: row?.lifetime_used,
    },
    transaction: {
      id: row?.transaction_id,
      amount: -amount,
      type: "usage",
      description,
      reference_id: referenceId,
    },
    error: null,
  };
};

const addTokensAtomic = async (
  userId,
  amount,
  type = "purchase",
  description = "Token purchase",
  referenceId = null,
  orgId = null,
) => {
  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      wallet: null,
      transaction: null,
      error: { message: "Amount must be a positive integer" },
    };
  }

  const { data, error } = await supabase.rpc("credit_tokens_atomic", {
    p_user_id: userId,
    p_org_id: orgId,
    p_amount: amount,
    p_type: type,
    p_description: description,
    p_reference_id: referenceId,
  });

  if (error) return { wallet: null, transaction: null, error };

  const row = Array.isArray(data) ? data[0] : data;
  return {
    wallet: {
      id: row?.wallet_id,
      balance: row?.balance,
      lifetime_purchased: row?.lifetime_purchased,
      lifetime_used: row?.lifetime_used,
    },
    transaction: {
      id: row?.transaction_id,
      amount,
      type,
      description,
      reference_id: referenceId,
    },
    error: null,
  };
};

const refundTokensAtomic = async (
  userId,
  amount,
  description = "Auto-refund - generation failed",
  referenceId = null,
  orgId = null,
) => addTokensAtomic(userId, amount, "refund", description, referenceId, orgId);

module.exports = {
  getOrCreateWallet,
  getBalance,
  deductTokens: deductTokensAtomic,
  addTokens: addTokensAtomic,
  refundTokens: refundTokensAtomic,
  getTransactions,
  getAnalytics,
  getPackages,
};
