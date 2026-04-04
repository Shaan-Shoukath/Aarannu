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
    const contactEmail = process.env.CONTACT_EMAIL || "";

    // Admin users get unlimited balance
    if (isAdmin(userId)) {
      return res.json({
        balance: 999999999,
        lifetime_purchased: 0,
        lifetime_used: 0,
        wallet_id: null,
        is_unlimited: true,
        contact_email: contactEmail,
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
      contact_email: contactEmail,
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
  addTokensManual,
};
