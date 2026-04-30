/**
 * checkTokens Middleware Tests
 * ────────────────────────────
 * Verifies fail-closed behavior, admin bypass, and dynamic
 * token count resolution.
 */

jest.mock("../services/tokenService", () => ({
  getBalance: jest.fn(),
}));

jest.mock("../utils/adminHelper", () => ({
  isAdmin: jest.fn(() => false),
}));

const checkTokens = require("../middleware/checkTokens");
const { getBalance } = require("../services/tokenService");
const { isAdmin } = require("../utils/adminHelper");

const mockReq = (overrides = {}) => ({
  user: { id: "test-user-id" },
  body: {},
  params: {},
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
});

describe("checkTokens middleware", () => {
  // ── Fail-closed behavior ────────────────────────────────

  test("returns 503 when balance check fails (DB error)", async () => {
    getBalance.mockResolvedValue({ balance: 0, error: { message: "DB down" } });

    const middleware = checkTokens(1);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "TOKEN_SERVICE_ERROR" }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("returns 503 on unexpected exception (fail-closed)", async () => {
    getBalance.mockRejectedValue(new Error("Unexpected crash"));

    const middleware = checkTokens(1);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(mockNext).not.toHaveBeenCalled();
  });

  // ── Normal operation ────────────────────────────────────

  test("returns 402 when insufficient tokens", async () => {
    getBalance.mockResolvedValue({ balance: 2, error: null });

    const middleware = checkTokens(5);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INSUFFICIENT_TOKENS",
        required: 5,
        available: 2,
      }),
    );
  });

  test("calls next() when balance is sufficient", async () => {
    getBalance.mockResolvedValue({ balance: 10, error: null });

    const middleware = checkTokens(5);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.tokenBalance).toBe(10);
    expect(req.tokensRequired).toBe(5);
  });

  test("calls next() with balance exactly equal to required", async () => {
    getBalance.mockResolvedValue({ balance: 3, error: null });

    const middleware = checkTokens(3);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  // ── Admin bypass ────────────────────────────────────────

  test("bypasses token check for admin users", async () => {
    isAdmin.mockReturnValue(true);

    const middleware = checkTokens(100);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.tokenBalance).toBe(Infinity);
    expect(req.isAdminBypass).toBe(true);
    expect(getBalance).not.toHaveBeenCalled();

    isAdmin.mockReturnValue(false);
  });

  // ── Dynamic count resolution ────────────────────────────

  test("resolves count from dot-path string", async () => {
    getBalance.mockResolvedValue({ balance: 10, error: null });

    const middleware = checkTokens("body.members.length");
    const req = mockReq({ body: { members: [1, 2, 3] } });
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.tokensRequired).toBe(3);
  });

  test("resolves count from callback function", async () => {
    getBalance.mockResolvedValue({ balance: 10, error: null });

    const middleware = checkTokens((req) => req.body.count);
    const req = mockReq({ body: { count: 7 } });
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.tokensRequired).toBe(7);
  });

  test("returns 400 when resolved count is invalid (NaN/zero/negative)", async () => {
    const middleware = checkTokens("body.invalid.path");
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "INVALID_TOKEN_COST" }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  // ── Auth check ──────────────────────────────────────────

  test("returns 401 when no user on request", async () => {
    const middleware = checkTokens(1);
    const req = mockReq({ user: null });
    const res = mockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
