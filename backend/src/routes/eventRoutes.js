/**
 * Event Routes
 * ─────────────
 * All routes require authentication (verifyToken).
 *
 * For list/create routes where orgId is available:
 *   checkOrgRole middleware verifies org membership directly.
 *
 * For event-specific routes (/:eventId/...):
 *   The controller fetches the event to get org_id, then checks
 *   org membership internally via getUserOrgRole.
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const checkOrgRole = require("../middleware/checkOrgRole");
const {
  createEvent,
  listEventsByOrg,
  getEvent,
  endEvent,
  deleteEvent,
  checkin,
  getCheckins,
  deleteCheckin,
  exportCheckins,
} = require("../controllers/eventController");

// Create event — orgId in body; inject into params so checkOrgRole can read it
router.post(
  "/",
  verifyToken,
  (req, _res, next) => { req.params.id = req.body.orgId; next(); },
  checkOrgRole("member"),
  createEvent
);

// List events for an org
router.get("/org/:orgId", verifyToken, checkOrgRole("member"), listEventsByOrg);

// Event-specific routes (auth + membership verified inside controllers)
router.get("/:eventId", verifyToken, getEvent);
router.patch("/:eventId/end", verifyToken, endEvent);
router.delete("/:eventId", verifyToken, deleteEvent);
router.post("/:eventId/checkin", verifyToken, checkin);
router.get("/:eventId/checkins", verifyToken, getCheckins);
router.delete("/:eventId/checkins/:checkinId", verifyToken, deleteCheckin);
router.get("/:eventId/export", verifyToken, exportCheckins);

module.exports = router;
