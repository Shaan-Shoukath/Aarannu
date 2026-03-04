/**
 * Project Member Routes
 * ─────────────────────
 * /api/members — Member registration, approval, management
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  registerMember,
  listMembers,
  approve,
  reject,
  bulkApprove,
  removeMember,
} = require("../controllers/projectMemberController");

// ── Public (no auth) ──────────────────────────────────────
// Public registration form submission
router.post("/register/:projectId", registerMember);

// ── Authenticated (admin) ─────────────────────────────────
// List project members (with optional ?status= filter)
router.get("/:projectId", verifyToken, listMembers);

// Approve a member
router.patch("/:id/approve", verifyToken, approve);

// Reject a member
router.patch("/:id/reject", verifyToken, reject);

// Bulk approve
router.post("/bulk-approve", verifyToken, bulkApprove);

// Delete a member
router.delete("/:id", verifyToken, removeMember);

module.exports = router;
