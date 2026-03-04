/**
 * Form Field Routes
 * ─────────────────
 * /api/form-fields — Dynamic form field management
 */

const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  getFields,
  getPublicFields,
  saveFields,
  updateField,
  deleteField,
  seedFields,
  getFieldMapping,
} = require("../controllers/formFieldController");

// ── Public (no auth) ──────────────────────────────────────
// Public form fields for registration form rendering
router.get("/:projectId/public", getPublicFields);

// ── Authenticated ─────────────────────────────────────────
// Get all fields for a project
router.get("/:projectId", verifyToken, getFields);

// Save/replace custom fields for a project
router.put("/:projectId", verifyToken, saveFields);

// Seed system fields (usually called automatically on project create)
router.post("/:projectId/seed", verifyToken, seedFields);

// Get field mapping (for CSV import / ID card mapping)
router.get("/:projectId/mapping", verifyToken, getFieldMapping);

// Update a single field
router.patch("/field/:fieldId", verifyToken, updateField);

// Delete a custom field
router.delete("/field/:fieldId", verifyToken, deleteField);

module.exports = router;
