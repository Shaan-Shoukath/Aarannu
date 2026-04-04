/**
 * Event Controller Tests
 * ───────────────────────
 * Verifies the HTTP behavior of event-related handlers.
 *
 * Strategy: mock eventService and getUserOrgRole so tests
 * exercise controller logic in isolation — no DB or network.
 */

// Prevent supabaseClient env-check from calling process.exit
jest.mock("../config/supabaseClient", () => ({ supabase: { from: jest.fn() } }));
// Prevent generateService from loading supabase client
jest.mock("../services/generateService", () => ({ getCardForVerification: jest.fn() }));

jest.mock("../services/eventService");
jest.mock("../services/orgService", () => ({
  getUserOrgRole: jest.fn(),
}));

const eventService = require("../services/eventService");
const { getUserOrgRole } = require("../services/orgService");
const {
  checkin,
  getCheckins,
  exportCheckins,
  createEvent,
  endEvent,
} = require("../controllers/eventController");

// ── Helpers ──────────────────────────────────────────────────

const mockReq = (overrides = {}) => ({
  user: { id: "user-123" },
  params: { eventId: "event-abc" },
  body: {},
  query: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

const ACTIVE_EVENT = {
  id: "event-abc",
  org_id: "org-xyz",
  status: "active",
  name: "Test Event",
  event_date: "2025-01-01",
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: event exists and user is an admin
  eventService.getEventById.mockResolvedValue({ data: ACTIVE_EVENT, error: null });
  getUserOrgRole.mockResolvedValue({ role: "admin", error: null });
});

// ─────────────────────────────────────────────────────────────
// POST /events/:eventId/checkin
// ─────────────────────────────────────────────────────────────

describe("checkin handler", () => {
  test("returns 400 when cardId is missing from body", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/cardId/i) })
    );
  });

  test("returns 404 when card does not exist", async () => {
    eventService.checkinWithCard.mockResolvedValue({
      error: { code: "CARD_NOT_FOUND", message: "Card not found." },
    });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CARD_NOT_FOUND" })
    );
  });

  test("returns 400 when card is revoked", async () => {
    eventService.checkinWithCard.mockResolvedValue({
      error: { code: "CARD_REVOKED", message: "This card has been revoked." },
    });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CARD_REVOKED" })
    );
  });

  test("returns 400 when card is expired", async () => {
    eventService.checkinWithCard.mockResolvedValue({
      error: { code: "CARD_EXPIRED", message: "This card has expired." },
    });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CARD_EXPIRED" })
    );
  });

  test("returns 400 when event has ended", async () => {
    eventService.checkinWithCard.mockResolvedValue({
      error: { code: "EVENT_ENDED", message: "This event has ended." },
    });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "EVENT_ENDED" })
    );
  });

  test("returns 409 when card already checked in to this event", async () => {
    eventService.checkinWithCard.mockResolvedValue({
      error: { code: "DUPLICATE_CHECKIN", message: "This card has already checked in." },
    });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DUPLICATE_CHECKIN" })
    );
  });

  test("returns 200 with checkin data on success", async () => {
    const checkinData = {
      id: "ci-1",
      event_id: "event-abc",
      card_id: "card-001",
      member_name: "Alice",
      member_email: "alice@example.com",
      checked_in_at: "2025-01-01T10:00:00Z",
    };
    eventService.checkinWithCard.mockResolvedValue({ data: checkinData });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith({ checkin: checkinData });
    // 200 is the default — res.status should not have been called with an error code
    expect(res.status).not.toHaveBeenCalled();
  });

  test("returns 403 when user is not an org member", async () => {
    getUserOrgRole.mockResolvedValue({ role: null, error: null });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(eventService.checkinWithCard).not.toHaveBeenCalled();
  });

  test("returns 404 when event does not exist", async () => {
    eventService.getEventById.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const req = mockReq({ body: { cardId: "card-001" } });
    const res = mockRes();

    await checkin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(eventService.checkinWithCard).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// GET /events/:eventId/checkins
// ─────────────────────────────────────────────────────────────

describe("getCheckins handler", () => {
  test("returns checkins array and count", async () => {
    const checkins = [
      { id: "ci-1", member_name: "Alice" },
      { id: "ci-2", member_name: "Bob" },
    ];
    eventService.getCheckinsByEvent.mockResolvedValue({ data: checkins, error: null });

    const req = mockReq();
    const res = mockRes();

    await getCheckins(req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith({ checkins, count: 2 });
  });

  test("returns empty array when no check-ins exist", async () => {
    eventService.getCheckinsByEvent.mockResolvedValue({ data: null, error: null });

    const req = mockReq();
    const res = mockRes();

    await getCheckins(req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith({ checkins: [], count: 0 });
  });
});

// ─────────────────────────────────────────────────────────────
// GET /events/:eventId/export
// ─────────────────────────────────────────────────────────────

describe("exportCheckins handler", () => {
  const CHECKINS = [
    {
      id: "ci-1",
      member_name: "Alice",
      member_email: "alice@example.com",
      checked_in_at: "2025-01-01T10:00:00Z",
    },
    {
      id: "ci-2",
      member_name: "Bob",
      member_email: "bob@example.com",
      checked_in_at: "2025-01-01T10:05:00Z",
    },
  ];

  beforeEach(() => {
    eventService.getCheckinsByEvent.mockResolvedValue({ data: CHECKINS, error: null });
  });

  test("CSV response has correct Content-Type header", async () => {
    const req = mockReq({ query: { format: "csv" } });
    const res = mockRes();

    await exportCheckins(req, res, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/csv; charset=utf-8"
    );
  });

  test("CSV response includes Name, Email, Check-in Time columns", async () => {
    const req = mockReq({ query: { format: "csv" } });
    const res = mockRes();

    await exportCheckins(req, res, mockNext);

    const csvBody = res.send.mock.calls[0][0];
    expect(csvBody).toMatch(/Name/);
    expect(csvBody).toMatch(/Email/);
    expect(csvBody).toMatch(/Check-in Time/);
    expect(csvBody).toMatch(/Alice/);
    expect(csvBody).toMatch(/alice@example\.com/);
  });

  test("CSV response has correct Content-Disposition with event name", async () => {
    const req = mockReq({ query: { format: "csv" } });
    const res = mockRes();

    await exportCheckins(req, res, mockNext);

    const dispositionCall = res.setHeader.mock.calls.find(
      ([header]) => header === "Content-Disposition"
    );
    expect(dispositionCall[1]).toMatch(/attachment/);
    expect(dispositionCall[1]).toMatch(/Test_Event/);
    expect(dispositionCall[1]).toMatch(/\.csv/);
  });

  test("XLSX response has correct Content-Type header", async () => {
    const req = mockReq({ query: { format: "xlsx" } });
    const res = mockRes();

    await exportCheckins(req, res, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  test("XLSX response sends a Buffer", async () => {
    const req = mockReq({ query: { format: "xlsx" } });
    const res = mockRes();

    await exportCheckins(req, res, mockNext);

    const sentData = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(sentData)).toBe(true);
  });

  test("empty check-in list produces a CSV with only the header row", async () => {
    eventService.getCheckinsByEvent.mockResolvedValue({ data: [], error: null });

    const req = mockReq({ query: { format: "csv" } });
    const res = mockRes();

    await exportCheckins(req, res, mockNext);

    const csvBody = res.send.mock.calls[0][0];
    const lines = csvBody.trim().split("\n");
    expect(lines).toHaveLength(1); // header row only
    expect(lines[0]).toMatch(/Name/);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /events/ — createEvent
// ─────────────────────────────────────────────────────────────

describe("createEvent handler", () => {
  test("returns 400 when required fields are missing", async () => {
    // Provide orgId but miss name and eventDate
    const req = mockReq({
      body: { orgId: "org-xyz" },
      params: { id: "org-xyz" }, // simulates checkOrgRole having run
    });
    const res = mockRes();

    await createEvent(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 201 with event on success", async () => {
    const newEvent = { id: "ev-1", name: "Hackathon", org_id: "org-xyz" };
    eventService.createEvent.mockResolvedValue({ data: newEvent, error: null });

    const req = mockReq({
      body: { orgId: "org-xyz", name: "Hackathon", eventDate: "2025-06-01" },
      params: { id: "org-xyz" },
    });
    const res = mockRes();

    await createEvent(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ event: newEvent });
  });
});

// ─────────────────────────────────────────────────────────────
// PATCH /events/:eventId/end — endEvent
// ─────────────────────────────────────────────────────────────

describe("endEvent handler", () => {
  test("returns 403 when user is only a member (not admin)", async () => {
    getUserOrgRole.mockResolvedValue({ role: "member", error: null });

    const req = mockReq();
    const res = mockRes();

    await endEvent(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(eventService.updateEventStatus).not.toHaveBeenCalled();
  });

  test("sets event status to ended and returns updated event", async () => {
    const endedEvent = { ...ACTIVE_EVENT, status: "ended" };
    eventService.updateEventStatus.mockResolvedValue({ data: endedEvent, error: null });

    const req = mockReq();
    const res = mockRes();

    await endEvent(req, res, mockNext);

    expect(eventService.updateEventStatus).toHaveBeenCalledWith("event-abc", "ended");
    expect(res.json).toHaveBeenCalledWith({ event: endedEvent });
  });
});
