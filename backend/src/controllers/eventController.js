/**
 * Event Controller
 * ─────────────────
 * HTTP handlers for /api/events/* routes.
 *
 * Authorization pattern for event-specific routes:
 *   1. Fetch the event to get org_id.
 *   2. Call getUserOrgRole(org_id, userId) to verify membership.
 *   3. For admin-only actions, verify role is 'admin' or 'owner'.
 */

const XLSX = require("xlsx");
const eventService = require("../services/eventService");
const { getUserOrgRole } = require("../services/orgService");

const ROLE_LEVELS = { member: 1, admin: 2, owner: 3 };

/** CSV-safe helper — wraps in quotes and escapes inner quotes. */
const csvSafe = (val) => {
  const str = String(val ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const extractCardId = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/(?:members|verify)\/([^/?#]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // Not a URL; fall through to path/raw parsing.
  }

  const pathMatch = value.match(/\/(?:members|verify)\/([^/?#]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

  return value;
};

/**
 * Fetch event and verify the requesting user has at least minRole in the event's org.
 * Returns { event, role } on success, or writes an error response and returns null.
 */
const authorizeEventRequest = async (req, res, minRole = "member") => {
  const { eventId } = req.params;
  const userId = req.user?.id;

  const { data: event, error } = await eventService.getEventById(eventId);
  if (error || !event) {
    res.status(404).json({ error: "Event not found." });
    return null;
  }

  const { role, error: roleError } = await getUserOrgRole(event.org_id, userId);
  if (roleError || !role) {
    res.status(403).json({ error: "You are not a member of this organization." });
    return null;
  }

  const minLevel = ROLE_LEVELS[minRole] || 0;
  if ((ROLE_LEVELS[role] || 0) < minLevel) {
    res.status(403).json({ error: `Insufficient permissions. Required: ${minRole}.` });
    return null;
  }

  return { event, role };
};

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/events/
 * Create a new event. orgId comes from body; checkOrgRole('member') runs before this.
 */
const createEvent = async (req, res, next) => {
  try {
    const { orgId, projectId, name, description, eventDate } = req.body;

    if (!orgId || !name || !eventDate) {
      return res.status(400).json({ error: "orgId, name, and eventDate are required." });
    }

    const { data: event, error } = await eventService.createEvent({
      orgId,
      projectId: projectId || null,
      name,
      description,
      eventDate,
      createdBy: req.user.id,
    });

    if (error) return next(error);
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/org/:orgId
 * List events for an org. checkOrgRole('member') runs before this.
 */
const listEventsByOrg = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { data: events, error } = await eventService.getEventsByOrg(orgId);
    if (error) return next(error);
    res.json({ events: events || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:eventId
 * Get event details. Auth + membership checked here.
 */
const getEvent = async (req, res, next) => {
  try {
    const result = await authorizeEventRequest(req, res, "member");
    if (!result) return;
    res.json({ event: result.event });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/events/:eventId/end
 * Mark event as ended. Requires admin role.
 */
const endEvent = async (req, res, next) => {
  try {
    const result = await authorizeEventRequest(req, res, "admin");
    if (!result) return;

    const { data: event, error } = await eventService.updateEventStatus(result.event.id, "ended");
    if (error) return next(error);
    res.json({ event });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/events/:eventId
 * Delete an event. Requires admin role.
 */
const deleteEvent = async (req, res, next) => {
  try {
    const result = await authorizeEventRequest(req, res, "admin");
    if (!result) return;

    const { error } = await eventService.deleteEvent(result.event.id);
    if (error) return next(error);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/events/:eventId/checkin
 * Record a check-in by scanning a card's QR code.
 * Body: { cardId }
 */
const checkin = async (req, res, next) => {
  try {
    const result = await authorizeEventRequest(req, res, "member");
    if (!result) return;

    const cardId = extractCardId(req.body?.cardId || req.body?.qrData || req.body?.value);
    if (!cardId) {
      return res.status(400).json({ error: "cardId is required." });
    }

    const { data: checkinData, error } = await eventService.checkinWithCard(
      result.event.id,
      cardId,
      req.user.id
    );

    if (error) {
      const statusMap = {
        CARD_NOT_FOUND: 404,
        CARD_REVOKED: 400,
        CARD_EXPIRED: 400,
        EVENT_ENDED: 400,
        DUPLICATE_CHECKIN: 409,
      };
      const status = statusMap[error.code] || 500;
      return res.status(status).json({ error: error.message, code: error.code });
    }

    res.json({ checkin: checkinData });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:eventId/checkins
 * List all check-ins for an event.
 */
const getCheckins = async (req, res, next) => {
  try {
    const result = await authorizeEventRequest(req, res, "member");
    if (!result) return;

    const { data: checkins, error } = await eventService.getCheckinsByEvent(result.event.id);
    if (error) return next(error);

    res.json({ checkins: checkins || [], count: (checkins || []).length });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/events/:eventId/checkins/:checkinId
 * Undo (delete) a check-in entry. Requires admin role.
 */
const deleteCheckin = async (req, res, next) => {
  try {
    const result = await authorizeEventRequest(req, res, "admin");
    if (!result) return;

    const { error } = await eventService.deleteCheckin(req.params.checkinId);
    if (error) return next(error);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:eventId/export?format=csv|xlsx
 * Export check-in list as CSV or XLSX.
 */
const exportCheckins = async (req, res, next) => {
  try {
    const result = await authorizeEventRequest(req, res, "member");
    if (!result) return;

    const { data: checkins, error } = await eventService.getCheckinsByEvent(result.event.id);
    if (error) return next(error);

    const rows = checkins || [];
    const safeName = result.event.name.replace(/[^a-zA-Z0-9]/g, "_");
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";

    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(
        rows.map((c) => ({
          Name: c.member_name,
          "Member ID": c.member_id || "",
          Time: c.checked_in_at
            ? new Date(c.checked_in_at).toLocaleString("en-IN")
            : "",
          Status: "CHECKED_IN",
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Check-ins");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}_checkins.xlsx"`
      );
      return res.send(buf);
    }

    // CSV
    const csvRows = [["Name", "Member ID", "Time", "Status"].join(",")];
    rows.forEach((c) => {
      csvRows.push(
        [
          csvSafe(c.member_name),
          csvSafe(c.member_id),
          csvSafe(
            c.checked_in_at ? new Date(c.checked_in_at).toLocaleString("en-IN") : ""
          ),
          csvSafe("CHECKED_IN"),
        ].join(",")
      );
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}_checkins.csv"`
    );
    res.send(`\uFEFF${csvRows.join("\n")}`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createEvent,
  listEventsByOrg,
  getEvent,
  endEvent,
  deleteEvent,
  checkin,
  getCheckins,
  deleteCheckin,
  exportCheckins,
};
