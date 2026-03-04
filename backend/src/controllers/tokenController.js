/**
 * Token Controller
 * ────────────────
 * HTTP handlers for the token / credit system.
 *
 * Endpoints:
 *   GET  /api/tokens/balance       – current wallet balance
 *   GET  /api/tokens/transactions  – paginated transaction history
 *   GET  /api/tokens/analytics     – usage analytics (30-day)
 *   GET  /api/tokens/packages      – list purchasable packages
 *   POST /api/tokens/purchase      – purchase tokens (design-phase placeholder)
 *   POST /api/tokens/add           – admin: manually add tokens
 */

const tokenService = require("../services/tokenService");
const { isAdmin } = require("../utils/adminHelper");

/* ----------------------------------------------------------------
   GET /api/tokens/balance
   ---------------------------------------------------------------- */
const getBalance = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const orgId = req.query.orgId || null;

    // Admin users get unlimited balance
    if (isAdmin(userId)) {
      return res.json({
        balance: 999999999,
        lifetime_purchased: 0,
        lifetime_used: 0,
        wallet_id: null,
        is_unlimited: true,
      });
    }

    const { balance, wallet, error } = await tokenService.getBalance(
      userId,
      orgId,
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({
      balance,
      lifetime_purchased: wallet?.lifetime_purchased || 0,
      lifetime_used: wallet?.lifetime_used || 0,
      wallet_id: wallet?.id,
      is_unlimited: false,
    });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------
   GET /api/tokens/transactions?page=1&limit=20&type=usage
   ---------------------------------------------------------------- */
const getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const orgId = req.query.orgId || null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const type = req.query.type || null;

    const { transactions, total, error } = await tokenService.getTransactions(
      userId,
      { orgId, page, limit, type },
    );

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------
   GET /api/tokens/analytics
   ---------------------------------------------------------------- */
const getAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const orgId = req.query.orgId || null;

    const { analytics, error } = await tokenService.getAnalytics(userId, orgId);
    if (error) return res.status(500).json({ error: error.message });

    res.json(analytics);
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------
   GET /api/tokens/packages
   ---------------------------------------------------------------- */
const getPackages = async (_req, res, next) => {
  try {
    const { packages, error } = await tokenService.getPackages();
    if (error) return res.status(500).json({ error: error.message });

    res.json({ packages });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------
   POST /api/tokens/purchase
   Body: { packageId: UUID }
   Design-phase placeholder — returns a mock payment intent.
   In production, integrate Stripe / Razorpay / LemonSqueezy here.
   ---------------------------------------------------------------- */
const purchaseTokens = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.sub;
    const { packageId } = req.body;
    const orgId = req.body.orgId || null;

    if (!packageId) {
      return res.status(400).json({ error: "packageId is required" });
    }

    // Fetch the package details
    const { packages, error: pkgErr } = await tokenService.getPackages();
    if (pkgErr) return res.status(500).json({ error: pkgErr.message });

    const pkg = (packages || []).find((p) => p.id === packageId);
    if (!pkg) {
      return res.status(404).json({ error: "Package not found or inactive" });
    }

    // ── In production, create a Stripe Checkout Session here ──
    // For now, directly credit the tokens (simulating completed payment)
    const { wallet, transaction, error } = await tokenService.addTokens(
      userId,
      pkg.tokens,
      "purchase",
      `Purchased "${pkg.name}" package (${pkg.tokens} tokens)`,
      `pkg_${pkg.id}`,
      orgId,
    );

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({
      message: `${pkg.tokens} tokens added successfully`,
      new_balance: wallet.balance,
      transaction_id: transaction?.id,
      package: {
        name: pkg.name,
        tokens: pkg.tokens,
        price_cents: pkg.price_cents,
        currency: pkg.currency,
      },
      // In production, return: payment_url, session_id, client_secret
      _note:
        "Payment gateway integration pending – tokens credited directly for now",
    });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------
   POST /api/tokens/add   (admin-only manual credit)
   Body: { userId, amount, description, type? }
   ---------------------------------------------------------------- */
const addTokensManual = async (req, res, next) => {
  try {
    const {
      userId: targetUserId,
      amount,
      description,
      type = "bonus",
      orgId = null,
    } = req.body;

    if (!targetUserId || !amount) {
      return res.status(400).json({ error: "userId and amount are required" });
    }

    const validTypes = ["bonus", "adjustment", "purchase"];
    if (!validTypes.includes(type)) {
      return res
        .status(400)
        .json({ error: `type must be one of: ${validTypes.join(", ")}` });
    }

    const { wallet, transaction, error } = await tokenService.addTokens(
      targetUserId,
      parseInt(amount, 10),
      type,
      description || `Manual ${type} by admin`,
      null,
      orgId,
    );

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({
      message: `${amount} tokens added to user ${targetUserId}`,
      new_balance: wallet.balance,
      transaction_id: transaction?.id,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBalance,
  getTransactions,
  getAnalytics,
  getPackages,
  purchaseTokens,
  addTokensManual,
};
