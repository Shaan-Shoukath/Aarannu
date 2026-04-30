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
    walletChain,
    txnChain,
  };
});

jest.mock("../utils/adminHelper", () => ({
  isAdmin: jest.fn(() => false),
}));

const { supabase, walletChain, txnChain } = require("../config/supabaseClient");
const { isAdmin } = require("../utils/adminHelper");
const {
  deductTokens,
  addTokens,
  refundTokens,
  getBalance,
} = require("../services/tokenService");

beforeEach(() => {
  jest.clearAllMocks();
  supabase.rpc.mockReset();

  walletChain.select.mockReturnThis();
  walletChain.insert.mockReturnThis();
  walletChain.update.mockReturnThis();
  walletChain.eq.mockReturnThis();
  walletChain.gte.mockReturnThis();
  walletChain.is.mockReturnThis();
  walletChain.single.mockReset();
  walletChain.maybeSingle.mockReset();

  txnChain.select.mockReturnThis();
  txnChain.insert.mockReturnThis();
  txnChain.eq.mockReturnThis();
  txnChain.single.mockReset();
});

describe("getBalance", () => {
  test("returns balance from existing wallet", async () => {
    walletChain.maybeSingle.mockResolvedValue({
      data: { id: "w1", balance: 50 },
      error: null,
    });

    const result = await getBalance("u1");
    expect(result.balance).toBe(50);
    expect(result.error).toBeNull();
  });

  test("auto-creates wallet with 50 signup bonus if none exists", async () => {
    walletChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    walletChain.single.mockResolvedValueOnce({
      data: {
        id: "w2",
        balance: 50,
        user_id: "u2",
        lifetime_used: 0,
        lifetime_purchased: 50,
      },
      error: null,
    });
    txnChain.single.mockResolvedValueOnce({
      data: { id: "t-bonus", amount: 50, type: "bonus" },
      error: null,
    });

    const result = await getBalance("u2");
    expect(result.balance).toBe(50);
    expect(walletChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 50, lifetime_purchased: 50 }),
    );
    expect(txnChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, type: "bonus" }),
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

describe("deductTokens", () => {
  test("rejects non-integer amount", async () => {
    const result = await deductTokens("u1", 1.5);
    expect(result.error).toBeTruthy();
  });

  test("rejects zero amount", async () => {
    const result = await deductTokens("u1", 0);
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

  test("returns INSUFFICIENT_TOKENS from atomic RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "INSUFFICIENT_TOKENS:3" },
    });

    const result = await deductTokens("u1", 10);
    expect(result.error.code).toBe("INSUFFICIENT_TOKENS");
    expect(result.error.message).toContain("Available: 3");
  });

  test("succeeds through atomic RPC when balance is sufficient", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          wallet_id: "w1",
          balance: 15,
          lifetime_used: 10,
          transaction_id: "t1",
        },
      ],
      error: null,
    });

    const result = await deductTokens("u1", 5, "Test deduction");
    expect(result.error).toBeNull();
    expect(result.wallet.balance).toBe(15);
    expect(result.transaction.id).toBe("t1");
    expect(supabase.rpc).toHaveBeenCalledWith(
      "deduct_tokens_atomic",
      expect.objectContaining({ p_amount: 5 }),
    );
  });
});

describe("addTokens", () => {
  test("rejects non-integer amount", async () => {
    const result = await addTokens("u1", 1.5);
    expect(result.error).toBeTruthy();
  });

  test("adds tokens through atomic RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          wallet_id: "w1",
          balance: 20,
          lifetime_used: 5,
          lifetime_purchased: 20,
          transaction_id: "t2",
        },
      ],
      error: null,
    });

    const result = await addTokens("u1", 10, "purchase", "Test purchase");
    expect(result.error).toBeNull();
    expect(result.wallet.balance).toBe(20);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "credit_tokens_atomic",
      expect.objectContaining({ p_type: "purchase", p_amount: 10 }),
    );
  });
});

describe("refundTokens", () => {
  test("refund credits tokens through atomic RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          wallet_id: "w1",
          balance: 15,
          lifetime_used: 5,
          lifetime_purchased: 15,
          transaction_id: "t3",
        },
      ],
      error: null,
    });

    const result = await refundTokens("u1", 5, "Test refund");
    expect(result.error).toBeNull();
    expect(result.wallet.balance).toBe(15);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "credit_tokens_atomic",
      expect.objectContaining({ p_type: "refund", p_amount: 5 }),
    );
  });
});
