/**
 * Event Service Tests
 * ────────────────────
 * Tests for checkinWithCard() — the core check-in business logic.
 *
 * Mocks: supabaseClient, generateService (getCardForVerification).
 * All DB behaviour is simulated through mock return values.
 */

// Prevent supabaseClient env-check from calling process.exit
jest.mock("../config/supabaseClient", () => {
  const singleFn = jest.fn();
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: singleFn,
  };
  return {
    supabase: {
      from: jest.fn(() => chain),
    },
    _chain: chain,
    _singleFn: singleFn,
  };
});

jest.mock("../services/generateService", () => ({
  getCardForVerification: jest.fn(),
}));

const { supabase, _chain: chain, _singleFn: singleFn } = require("../config/supabaseClient");
const { getCardForVerification } = require("../services/generateService");
const { checkinWithCard } = require("../services/eventService");

// ── Fixtures ─────────────────────────────────────────────────

const ACTIVE_CARD = {
  id: "card-001",
  member_id: "member-abc",
  status: "active",
  expires_at: new Date(Date.now() + 86400000).toISOString(), // expires tomorrow
  project_members: {
    name: "Alice",
    email: "alice@example.com",
    photo_url: "",
  },
};

const ACTIVE_EVENT = {
  id: "event-xyz",
  org_id: "org-1",
  status: "active",
};

beforeEach(() => {
  jest.clearAllMocks();
  // Reset chain methods
  chain.select.mockReturnThis();
  chain.insert.mockReturnThis();
  chain.eq.mockReturnThis();
  chain.order.mockReturnThis();
  singleFn.mockReset();
});

// ─────────────────────────────────────────────────────────────
// checkinWithCard
// ─────────────────────────────────────────────────────────────

describe("checkinWithCard", () => {
  test("returns CARD_NOT_FOUND when card does not exist", async () => {
    getCardForVerification.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const result = await checkinWithCard("event-xyz", "card-missing", "user-1");

    expect(result.error.code).toBe("CARD_NOT_FOUND");
    expect(result.data).toBeUndefined();
  });

  test("returns CARD_REVOKED when card status is revoked", async () => {
    getCardForVerification.mockResolvedValue({
      data: { ...ACTIVE_CARD, status: "revoked" },
      error: null,
    });

    const result = await checkinWithCard("event-xyz", "card-001", "user-1");

    expect(result.error.code).toBe("CARD_REVOKED");
  });

  test("returns CARD_EXPIRED when card status is expired", async () => {
    getCardForVerification.mockResolvedValue({
      data: { ...ACTIVE_CARD, status: "expired" },
      error: null,
    });

    const result = await checkinWithCard("event-xyz", "card-001", "user-1");

    expect(result.error.code).toBe("CARD_EXPIRED");
  });

  test("returns CARD_EXPIRED when expires_at is in the past (even if status is active)", async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    getCardForVerification.mockResolvedValue({
      data: { ...ACTIVE_CARD, status: "active", expires_at: yesterday },
      error: null,
    });

    const result = await checkinWithCard("event-xyz", "card-001", "user-1");

    expect(result.error.code).toBe("CARD_EXPIRED");
  });

  test("returns EVENT_ENDED when event status is ended", async () => {
    getCardForVerification.mockResolvedValue({ data: ACTIVE_CARD, error: null });
    // First single() call is for getEventById
    singleFn.mockResolvedValueOnce({ data: { ...ACTIVE_EVENT, status: "ended" }, error: null });

    const result = await checkinWithCard("event-xyz", "card-001", "user-1");

    expect(result.error.code).toBe("EVENT_ENDED");
  });

  test("returns DUPLICATE_CHECKIN when Postgres unique constraint fires (23505)", async () => {
    getCardForVerification.mockResolvedValue({ data: ACTIVE_CARD, error: null });
    // getEventById → active event
    singleFn.mockResolvedValueOnce({ data: ACTIVE_EVENT, error: null });
    // insert → unique violation
    singleFn.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key" } });

    const result = await checkinWithCard("event-xyz", "card-001", "user-1");

    expect(result.error.code).toBe("DUPLICATE_CHECKIN");
  });

  test("returns checkin data on successful check-in", async () => {
    getCardForVerification.mockResolvedValue({ data: ACTIVE_CARD, error: null });
    // getEventById → active event
    singleFn.mockResolvedValueOnce({ data: ACTIVE_EVENT, error: null });
    // insert → new checkin row
    const checkin = {
      id: "ci-1",
      event_id: "event-xyz",
      card_id: "card-001",
      member_name: "Alice",
      member_email: "alice@example.com",
    };
    singleFn.mockResolvedValueOnce({ data: checkin, error: null });

    const result = await checkinWithCard("event-xyz", "card-001", "user-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(checkin);
  });

  test("denormalizes member name from card's project_members join", async () => {
    const cardWithMember = {
      ...ACTIVE_CARD,
      project_members: { name: "Charlie", email: "charlie@example.com", photo_url: "https://img" },
    };
    getCardForVerification.mockResolvedValue({ data: cardWithMember, error: null });
    singleFn.mockResolvedValueOnce({ data: ACTIVE_EVENT, error: null });
    singleFn.mockResolvedValueOnce({ data: { id: "ci-2", member_name: "Charlie" }, error: null });

    await checkinWithCard("event-xyz", "card-001", "user-1");

    // The insert call should have received the denormalized member name
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.member_name).toBe("Charlie");
    expect(insertArg.member_email).toBe("charlie@example.com");
  });
});
