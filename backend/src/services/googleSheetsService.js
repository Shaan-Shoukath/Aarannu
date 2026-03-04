/**
 * Google Sheets Service
 * ─────────────────────
 * Fetches public Google Sheets as CSV, parses rows, and provides
 * data for column mapping and import.
 *
 * Supports two URL patterns:
 *   1. Full Google Sheets URL → extract sheet ID → export as CSV
 *   2. Direct CSV export URL → fetch directly
 *
 * IMPORTANT: This only works with publicly shared Google Sheets
 *            (or sheets shared via "Anyone with the link").
 *            There is NO live dependency after import — data is
 *            copied into the DB and the sheet is never accessed again.
 */

/**
 * Extract Google Sheet ID from various URL formats.
 * Supports:
 *   - https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
 *   - https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv
 *   - Just the raw SHEET_ID string
 */
const extractSheetId = (input) => {
  if (!input) return null;

  // Already a bare ID (no slashes, not a URL)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) {
    return input.trim();
  }

  // Standard Google Sheets URL
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

/**
 * Build the CSV export URL for a Google Sheet.
 * @param {string} sheetId - The Google Sheet ID
 * @param {number|string} gid - The sheet tab GID (default: 0 = first tab)
 */
const buildExportUrl = (sheetId, gid = 0) => {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
};

/**
 * Parse CSV text into an array of rows (array of arrays).
 * Handles quoted fields, escaped quotes, and newlines within quotes.
 */
const parseCSV = (csvText) => {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        if (char === "\r") i++; // Skip \n in \r\n
      } else {
        currentField += char;
      }
    }
  }

  // Push last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
};

/**
 * Fetch a Google Sheet and return parsed data.
 *
 * @param {string} sheetUrlOrId — Google Sheets URL or Sheet ID
 * @param {number} gid — Tab GID (default: 0)
 * @returns {Promise<{headers: string[], rows: object[], rawRows: string[][], error: string|null}>}
 */
const fetchSheet = async (sheetUrlOrId, gid = 0) => {
  const sheetId = extractSheetId(sheetUrlOrId);
  if (!sheetId) {
    return {
      headers: [],
      rows: [],
      rawRows: [],
      error: "Invalid Google Sheets URL or ID.",
    };
  }

  const exportUrl = buildExportUrl(sheetId, gid);

  try {
    const response = await fetch(exportUrl, {
      headers: {
        "User-Agent": "CommunityID-Importer/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          headers: [],
          rows: [],
          rawRows: [],
          error: "Sheet not found. Make sure it exists and is publicly shared.",
        };
      }
      return {
        headers: [],
        rows: [],
        rawRows: [],
        error: `Failed to fetch sheet: HTTP ${response.status}`,
      };
    }

    const csvText = await response.text();

    if (!csvText.trim()) {
      return { headers: [], rows: [], rawRows: [], error: "Sheet is empty." };
    }

    const allRows = parseCSV(csvText);
    if (allRows.length === 0) {
      return {
        headers: [],
        rows: [],
        rawRows: [],
        error: "No data found in sheet.",
      };
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1);

    // Convert to array of objects using headers as keys
    const rows = dataRows.map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] || "";
      });
      return obj;
    });

    return {
      headers,
      rows,
      rawRows: dataRows,
      totalRows: dataRows.length,
      error: null,
    };
  } catch (err) {
    return {
      headers: [],
      rows: [],
      rawRows: [],
      error: `Failed to fetch sheet: ${err.message}`,
    };
  }
};

/**
 * Validate and apply column mapping to imported rows.
 *
 * @param {object[]} rows — Parsed sheet rows (objects)
 * @param {object} columnMapping — { sheetColumn: formFieldKey, ... }
 *   e.g. { "Student Name": "name", "Email Address": "email", "Department": "department" }
 * @returns {object[]} — Mapped rows ready for DB insert
 */
const applyColumnMapping = (rows, columnMapping) => {
  return rows.map((row) => {
    const mapped = {};
    for (const [sheetCol, fieldKey] of Object.entries(columnMapping)) {
      if (row[sheetCol] !== undefined) {
        mapped[fieldKey] = row[sheetCol];
      }
    }
    return mapped;
  });
};

/**
 * Validate mapped rows against form field requirements.
 *
 * @param {object[]} mappedRows — Rows after column mapping
 * @param {object[]} formFields — Field definitions from form_fields table
 * @returns {{ valid: object[], errors: object[] }}
 */
const validateMappedRows = (mappedRows, formFields) => {
  const valid = [];
  const errors = [];

  const requiredKeys = formFields
    .filter((f) => f.required)
    .map((f) => f.field_key);

  const emailFields = formFields
    .filter((f) => f.type === "email")
    .map((f) => f.field_key);

  mappedRows.forEach((row, idx) => {
    const rowErrors = [];

    // Check required fields
    for (const key of requiredKeys) {
      if (!row[key] || !String(row[key]).trim()) {
        rowErrors.push(`Missing required field: ${key}`);
      }
    }

    // Validate email fields
    for (const key of emailFields) {
      if (row[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[key])) {
        rowErrors.push(`Invalid email in field: ${key}`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ rowIndex: idx + 1, row, errors: rowErrors });
    } else {
      valid.push(row);
    }
  });

  return { valid, errors };
};

module.exports = {
  extractSheetId,
  buildExportUrl,
  parseCSV,
  fetchSheet,
  applyColumnMapping,
  validateMappedRows,
};
