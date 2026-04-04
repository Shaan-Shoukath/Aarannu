/**
 * Token Controller Tests
 * ───────────────────────
 * Verifies HTTP behavior of token endpoints.
 */

jest.mock("../config/supabaseClient", () => ({ supabase: { from: jest.fn() } }));

jest.mock("../services/tokenService");
jest.mock("../utils/adminHelper", () => ({
  isAdmin: jest.fn(() => false),
}));

const tokenService = require("../services/tokenService");
const { isAdmin } = require("../utils/adminHelper");
const { getBalance } = require("../controllers/tokenController");

const mockReq = (overrides = {}) => ({
  user: { id: "user-123" },
  query: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  isAdmin.mockReturnValue(false);
  // Set CONTACT_EMAIL for tests
  process.env.CONTACT_EMAIL = "tokens@aarannu.com";
});

describe("getBalance handler", () => {
  test("returns contact_email from env in response", async () => {
    tokenService.getBalance.mockResolvedValue({
      balance: 42,
      wallet: { id: "w1", lifetime_purchased: 100, lifetime_used: 58 },
      error: null,
    });

    const req = mockReq();
    const res = mockRes();

    await getBalance(req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        balance: 42,
        contact_email: "tokens@aarannu.com",
      })
    );
  });

  test("returns contact_email even for admin users", async () => {
    isAdmin.mockReturnValue(true);

    const req = mockReq();
    const res = mockRes();

    await getBalance(req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_email: "tokens@aarannu.com",
      })
    );
  });

  test("returns empty string when CONTACT_EMAIL not set", async () => {
    delete process.env.CONTACT_EMAIL;

    tokenService.getBalance.mockResolvedValue({
      balance: 10,
      wallet: { id: "w1", lifetime_purchased: 100, lifetime_used: 90 },
      error: null,
    });

    const req = mockReq();
    const res = mockRes();

    await getBalance(req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ contact_email: "" })
    );
  });
});
