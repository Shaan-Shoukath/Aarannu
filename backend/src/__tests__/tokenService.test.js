/**
 * Token Service Tests
 * ───────────────────
 * Unit tests for the core token billing logic.
 *
 * These tests mock the Supabase client to test business logic
 * in isolation, without a database connection.
 */

// Setup mocks without out-of-scope references
jest.mock("../config/supabaseClient", () => {
  const mockQuery = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  });
  
  const walletChain = mockQuery();
  const txnChain = mockQuery();

  return {
    supabase: {
      from: jest.fn((table) => {
        if (table === "token_wallets") return walletChain;
        if (table === "token_transactions") return txnChain;
        return mockQuery();
      }),
      rpc: jest.fn(),
    },
    // Export these to manipulate them in tests
    walletChain,
    txnChain
  };
});

jest.mock("../utils/adminHelper", () => ({
  isAdmin: jest.fn(() => false),
}));

const { supabase, walletChain, txnChain } = require("../config/supabaseClient");
const { isAdmin } = require("../utils/adminHelper");

// Reset chains before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset walletChain properties
  walletChain.select.mockReturnThis();
  walletChain.insert.mockReturnThis();
  walletChain.update.mockReturnThis();
  walletChain.eq.mockReturnThis();
  walletChain.gte.mockReturnThis();
  walletChain.is.mockReturnThis();
  walletChain.single.mockReset();
  walletChain.maybeSingle.mockReset();

  // Reset txnChain properties
  txnChain.select.mockReturnThis();
  txnChain.insert.mockReturnThis();
  txnChain.eq.mockReturnThis();
  txnChain.single.mockReset();
});

const {
  deductTokens,
  addTokens,
  refundTokens,
  getBalance,
} = require("../services/tokenService");

// ── getBalance ──────────────────────────────────────────────

describe("getBalance", () => {
  test("returns balance from existing wallet", async () => {
    walletChain.maybeSingle.mockResolvedValue({
      data: { id: "w1", balance: 50, user_id: "u1", lifetime_used: 10, lifetime_purchased: 60 },
      error: null,
    });

    const result = await getBalance("u1");
    expect(result.balance).toBe(50);
    expect(result.error).toBeNull();
  });

  test("auto-creates wallet with 50 signup bonus if none exists", async () => {
    // First call: no wallet
    walletChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Second call: after insert → wallet created with 50 balance
    walletChain.single.mockResolvedValueOnce({
      data: { id: "w2", balance: 50, user_id: "u2", lifetime_used: 0, lifetime_purchased: 50 },
      error: null,
    });
    // Bonus transaction insert
    txnChain.single.mockResolvedValueOnce({
      data: { id: "t-bonus", amount: 50, type: "bonus" },
      error: null,
    });

    const result = await getBalance("u2");
    expect(result.balance).toBe(50);
    expect(result.error).toBeNull();
    // Verify the insert was called with 50 balance
    expect(walletChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 50, lifetime_purchased: 50 })
    );
    // Verify bonus transaction was logged
    expect(txnChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, type: "bonus" })
    );
  });

  test("returns error when DB fetch fails", async () => {
    walletChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "DB connection failed" },
    });

    const result = await getBalance("u1");
    expect(result.error).toBeTruthy();
    expect(result.balance).toBe(0);
  });
});

// ── deductTokens ────────────────────────────────────────────

describe("deductTokens", () => {
  test("rejects non-integer amount", async () => {
    const result = await deductTokens("u1", 1.5);
    expect(result.error).toBeTruthy();
    expect(result.error.message).toMatch(/positive integer/i);
  });

  test("rejects zero amount", async () => {
    const result = await deductTokens("u1", 0);
    expect(result.error).toBeTruthy();
  });

  test("rejects negative amount", async () => {
    const result = await deductTokens("u1", -5);
    expect(result.error).toBeTruthy();
  });

  test("bypasses deduction for admin users", async () => {
    isAdmin.mockReturnValue(true);

    const result = await deductTokens("admin1", 100);
    expect(result.error).toBeNull();
    expect(result.wallet.balance).toBe(Infinity);
    expect(result.transaction.id).toBe("admin-bypass");

    isAdmin.mockReturnValue(false);
  });

  test("returns INSUFFICIENT_TOKENS when atomic update fails", async () => {
    // getOrCreateWallet returns existing wallet
    walletChain.maybeSingle.mockResolvedValue({
      data: { id: "w1", balance: 5, user_id: "u1", lifetime_used: 10, lifetime_purchased: 15 },
      error: null,
    });

    // Atomic update fails (gte guard blocks — balance < amount)
    walletChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: "No rows returned" },
    });

    // Re-fetch for error message (getBalance call)
    // This triggers another getOrCreateWallet → maybeSingle
    walletChain.maybeSingle.mockResolvedValue({
      data: { id: "w1", balance: 3, user_id: "u1", lifetime_used: 12, lifetime_purchased: 15 },
      error: null,
    });

    const result = await deductTokens("u1", 10);
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe("INSUFFICIENT_TOKENS");
  });

  test("succeeds when balance is sufficient", async () => {
    walletChain.maybeSingle.mockResolvedValue({
      data: { id: "w1", balance: 20, user_id: "u1", lifetime_used: 5, lifetime_purchased: 25 },
      error: null,
    });

    // Atomic update succeeds
    walletChain.single.mockResolvedValueOnce({
      data: { id: "w1", balance: 15, user_id: "u1", lifetime_used: 10, lifetime_purchased: 25 },
      error: null,
    });

    // Transaction log insert
    txnChain.single.mockResolvedValue({
      data: { id: "t1", amount: -5, type: "usage" },
      error: null,
    });

    const result = await deductTokens("u1", 5, "Test deduction");
    expect(result.error).toBeNull();
    expect(result.wallet.balance).toBe(15);
    expect(result.transaction).toBeTruthy();
  });
});

// ── addTokens ───────────────────────────────────────────────

describe("addTokens", () => {
  test("rejects non-integer amount", async () => {
    const result = await addTokens("u1", 1.5);
    expect(result.error).toBeTruthy();
  });

  test("adds tokens to wallet", async () => {
    walletChain.maybeSingle.mockResolvedValue({
      data: { id: "w1", balance: 10, user_id: "u1", lifetime_used: 5, lifetime_purchased: 10 },
      error: null,
    });

    walletChain.single.mockResolvedValue({
      data: { id: "w1", balance: 20, user_id: "u1", lifetime_used: 5, lifetime_purchased: 20 },
      error: null,
    });

    txnChain.single.mockResolvedValue({
      data: { id: "t2", amount: 10, type: "purchase" },
      error: null,
    });

    const result = await addTokens("u1", 10, "purchase", "Test purchase");
    expect(result.error).toBeNull();
    expect(result.wallet.balance).toBe(20);
  });
});

// ── refundTokens ────────────────────────────────────────────

describe("refundTokens", () => {
  test("refund calls addTokens with type 'refund'", async () => {
    walletChain.maybeSingle.mockResolvedValue({
      data: { id: "w1", balance: 10, user_id: "u1", lifetime_used: 5, lifetime_purchased: 15 },
      error: null,
    });

    walletChain.single.mockResolvedValue({
      data: { id: "w1", balance: 15, user_id: "u1", lifetime_used: 5, lifetime_purchased: 15 },
      error: null,
    });

    txnChain.single.mockResolvedValue({
      data: { id: "t3", amount: 5, type: "refund" },
      error: null,
    });

    const result = await refundTokens("u1", 5, "Test refund");
    expect(result.error).toBeNull();
    expect(result.wallet.balance).toBe(15);
  });
});
