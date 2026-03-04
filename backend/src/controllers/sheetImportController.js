/**
 * Sheet Import Controller
 * ───────────────────────
 * HTTP handlers for Google Sheets fetching, column mapping, and import.
 */

const sheetsService = require("../services/googleSheetsService");
const formFieldService = require("../services/formFieldService");
const memberService = require("../services/projectMemberService");
const projectService = require("../services/projectService");

/**
 * POST /api/sheets/fetch — Fetch and preview a Google Sheet
 * Body: { sheetUrl, gid? }
 * Returns: headers, preview rows (first 10), totalRows
 */
const fetchSheet = async (req, res, next) => {
  try {
    const { sheetUrl, gid } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({ error: "sheetUrl is required." });
    }

    const result = await sheetsService.fetchSheet(sheetUrl, gid || 0);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Return headers + preview (first 10 rows) + total count
    res.json({
      headers: result.headers,
      preview: result.rows.slice(0, 10),
      totalRows: result.totalRows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sheets/import/:projectId — Import from Google Sheet with column mapping
 * Body: {
 *   sheetUrl: string,
 *   gid?: number,
 *   columnMapping: { "Sheet Column": "form_field_key", ... },
 *   autoApprove?: boolean       // default: true for bulk projects
 * }
 */
const importSheet = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { sheetUrl, gid, columnMapping, autoApprove = true } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({ error: "sheetUrl is required." });
    }
    if (!columnMapping || typeof columnMapping !== "object") {
      return res.status(400).json({ error: "columnMapping is required." });
    }

    // Verify project exists
    const { data: project, error: pErr } = await projectService.getProjectById(projectId);
    if (pErr || !project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Fetch the sheet
    const sheetResult = await sheetsService.fetchSheet(sheetUrl, gid || 0);
    if (sheetResult.error) {
      return res.status(400).json({ error: sheetResult.error });
    }

    // Apply column mapping
    const mappedRows = sheetsService.applyColumnMapping(sheetResult.rows, columnMapping);

    // Get form fields for validation
    const { fields } = await formFieldService.getPublicFormFields(projectId);

    // Validate mapped rows
    const { valid, errors: validationErrors } = sheetsService.validateMappedRows(
      mappedRows,
      fields || [],
    );

    // Check member limit
    if (project.member_limit) {
      const { data: existing } = await memberService.getMembersByProject(projectId);
      const currentCount = (existing || []).filter(
        (m) => m.status === "pending" || m.status === "approved",
      ).length;
      const remaining = project.member_limit - currentCount;
      if (valid.length > remaining) {
        return res.status(400).json({
          error: `Cannot import ${valid.length} members. Only ${remaining} slots available (${currentCount} members already exist).`,
          validationErrors,
        });
      }
    }

    // Convert valid rows to DB format
    const status = autoApprove ? "approved" : "pending";
    const dbRows = valid.map((row) => {
      // Extract system fields
      const name = row.name || "Unknown";
      const email = row.email || null;
      const photoUrl = row.photo || row.photo_url || "";

      // Everything else goes to custom_fields
      const customFields = {};
      for (const [key, value] of Object.entries(row)) {
        if (!["name", "email", "photo", "photo_url"].includes(key)) {
          customFields[key] = value;
        }
      }

      return {
        project_id: projectId,
        org_id: project.org_id,
        name,
        email,
        photo_url: photoUrl,
        status,
        custom_fields: customFields,
      };
    });

    // Bulk insert
    let imported = 0;
    if (dbRows.length > 0) {
      const { data, error } = await memberService.bulkInsertMembers(dbRows);
      if (error) return res.status(500).json({ error: error.message, validationErrors });
      imported = data?.length || 0;
    }

    res.json({
      imported,
      skipped: validationErrors.length,
      validationErrors: validationErrors.slice(0, 50), // Limit error details
      total: sheetResult.totalRows,
      message: `Successfully imported ${imported} members${validationErrors.length > 0 ? ` (${validationErrors.length} rows skipped due to validation errors)` : ""}.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { fetchSheet, importSheet };
