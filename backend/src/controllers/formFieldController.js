/**
 * Form Field Controller
 * ─────────────────────
 * HTTP handlers for dynamic form field management.
 */

const formFieldService = require("../services/formFieldService");

/**
 * GET /api/form-fields/:projectId — Get all fields for a project
 */
const getFields = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const version = req.query.version ? parseInt(req.query.version) : null;

    const { data, error } = await formFieldService.getFieldsByProject(
      projectId,
      version,
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ fields: data || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/form-fields/:projectId/public — Get fields for public registration form
 * NO AUTH REQUIRED
 */
const getPublicFields = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { fields, error } =
      await formFieldService.getPublicFormFields(projectId);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ fields: fields || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/form-fields/:projectId — Save/replace all custom fields
 * Body: { fields: [...], forceNewVersion?: boolean }
 */
const saveFields = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { fields, forceNewVersion } = req.body;

    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: "fields must be an array." });
    }

    // Validate each field
    for (const f of fields) {
      if (!f.label || !f.label.trim()) {
        return res.status(400).json({ error: "Each field must have a label." });
      }
      const validTypes = [
        "text",
        "email",
        "phone",
        "number",
        "textarea",
        "dropdown",
        "radio",
        "checkbox",
        "date",
        "file_upload",
        "photo_upload",
      ];
      if (f.type && !validTypes.includes(f.type)) {
        return res.status(400).json({
          error: `Invalid field type: ${f.type}. Valid types: ${validTypes.join(", ")}`,
        });
      }
    }

    const { data, error, version } = await formFieldService.saveCustomFields(
      projectId,
      fields,
      forceNewVersion || false,
    );

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      fields: data,
      version,
      message: `Form fields saved (version ${version}).`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/form-fields/field/:fieldId — Update a single field
 */
const updateField = async (req, res, next) => {
  try {
    const { fieldId } = req.params;
    const { data, error } = await formFieldService.updateField(
      fieldId,
      req.body,
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ field: data });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/form-fields/field/:fieldId — Delete a custom field
 */
const deleteField = async (req, res, next) => {
  try {
    const { fieldId } = req.params;
    const result = await formFieldService.deleteField(fieldId);
    if (result.error) {
      return res.status(400).json({ error: result.error.message });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/form-fields/:projectId/seed — Seed system fields for a project
 */
const seedFields = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const version = req.body.version || 1;
    const { data, error } = await formFieldService.seedSystemFields(
      projectId,
      version,
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ fields: data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/form-fields/:projectId/mapping — Get field mapping for CSV/card
 */
const getFieldMapping = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { mapping, error } =
      await formFieldService.getFieldMapping(projectId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ mapping });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFields,
  getPublicFields,
  saveFields,
  updateField,
  deleteField,
  seedFields,
  getFieldMapping,
};
