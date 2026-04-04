import { useState } from "react";
import { parseCSV } from "../utils/csvParser";

/**
 * useSheetImport — Custom Hook
 * ────────────────────────────
 * Encapsulates all Google Sheets CSV import logic:
 *   - URL parsing & CSV export URL construction
 *   - Fetching & parsing CSV data
 *   - Column mapping (auto-guess + manual)
 *   - Applying mapping to produce member objects
 *
 * Extracted from Generate.jsx to reduce the God Component.
 */

/** Standard fields the user can map sheet columns to */
const MAPPABLE_FIELDS = [
  { key: "name", label: "Full Name", required: true },
  { key: "email", label: "Email Address" },
  { key: "role", label: "Role / Designation" },
  { key: "id_number", label: "ID Number" },
  { key: "dob", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "blood_group", label: "Blood Group" },
  { key: "photo_url", label: "Photo URL" },
  { key: "address", label: "Address" },
];

const GUESS_RULES = {
  name: ["name", "full name", "fullname", "member name"],
  email: ["email", "e-mail", "email address", "mail", "email_address"],
  role: ["role", "designation", "title", "position"],
  id_number: ["id", "id_number", "id number", "member id", "memberid"],
  dob: ["dob", "date of birth", "birthday", "birth date"],
  gender: ["gender", "sex"],
  blood_group: ["blood group", "blood_group", "blood type", "bloodgroup"],
  photo_url: ["photo", "photo_url", "photo url", "image", "image_url"],
  address: ["address", "addr", "location"],
};

export default function useSheetImport({ generateMemberId, currentMemberCount, onImported, setCustomFieldDefs }) {
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState("");
  const [sheetsSuccess, setSheetsSuccess] = useState("");

  // Column mapping state (2-phase import)
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [sheetRows, setSheetRows] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [showMapping, setShowMapping] = useState(false);

  /**
   * Phase 1: Fetch the Google Sheet, parse CSV, show column mapping UI.
   */
  const handleSheetsImport = async () => {
    if (!sheetsUrl.trim()) return;
    setSheetsLoading(true);
    setSheetsError("");
    setSheetsSuccess("");
    setShowMapping(false);

    try {
      let csvUrl = sheetsUrl.trim();

      const spreadsheetIdMatch = csvUrl.match(
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      );
      if (spreadsheetIdMatch) {
        const sheetId = spreadsheetIdMatch[1];
        const gidMatch = csvUrl.match(/gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : "0";
        csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      } else if (
        !csvUrl.includes("export?format=csv") &&
        !csvUrl.endsWith(".csv")
      ) {
        throw new Error(
          "Please paste a valid Google Sheets URL (e.g. https://docs.google.com/spreadsheets/d/...).",
        );
      }

      const res = await fetch(csvUrl);
      if (!res.ok) {
        throw new Error(
          "Could not fetch the sheet. Make sure it is published / shared as 'Anyone with the link'.",
        );
      }

      const csvText = await res.text();
      const rows = parseCSV(csvText);

      if (rows.length < 2) {
        throw new Error(
          "Sheet must have a header row and at least one data row.",
        );
      }

      const headers = rows[0].map((h) => h.trim());
      const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()));

      if (dataRows.length === 0) {
        throw new Error("No data rows found after the header.");
      }

      // Auto-guess mappings based on header names
      const guessMap = {};
      const lowerHeaders = headers.map((h) => h.toLowerCase());

      for (const [field, aliases] of Object.entries(GUESS_RULES)) {
        const idx = lowerHeaders.findIndex((h) => aliases.includes(h));
        guessMap[field] = idx !== -1 ? idx : -1;
      }

      setSheetHeaders(headers);
      setSheetRows(dataRows);
      setColumnMap(guessMap);
      setShowMapping(true);
    } catch (err) {
      setSheetsError(err.message);
    } finally {
      setSheetsLoading(false);
    }
  };

  /**
   * Phase 2: Apply column mapping, build member objects, add to queue.
   */
  const handleConfirmMapping = () => {
    if (columnMap.name === -1 || columnMap.name === undefined) {
      setSheetsError("You must map the 'Full Name' column.");
      return;
    }

    // Identify which headers are NOT mapped to standard fields → custom fields
    const mappedIndices = new Set(
      Object.values(columnMap).filter((v) => v !== -1),
    );
    const extraColumns = sheetHeaders
      .map((h, idx) => ({ header: h, idx }))
      .filter((c) => c.header && !mappedIndices.has(c.idx));

    // Auto-register extra columns as custom fields
    if (extraColumns.length > 0 && setCustomFieldDefs) {
      setCustomFieldDefs((prev) => {
        const existing = new Set(prev.map((f) => f.label.toLowerCase()));
        const newDefs = extraColumns
          .filter((c) => !existing.has(c.header.toLowerCase()))
          .map((c) => ({
            label: c.header.charAt(0).toUpperCase() + c.header.slice(1),
            side: "front",
          }));
        return [...prev, ...newDefs];
      });
    }

    const imported = [];
    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];

      const getVal = (fieldKey) => {
        const idx = columnMap[fieldKey];
        if (idx === -1 || idx === undefined) return "";
        return row[idx]?.trim() || "";
      };

      const name = getVal("name");
      if (!name) continue;

      imported.push({
        name,
        email: getVal("email"),
        role: getVal("role") || "Member",
        id_number:
          getVal("id_number") ||
          generateMemberId(currentMemberCount + imported.length + 1),
        dob: getVal("dob"),
        gender: getVal("gender") || "N/A",
        blood_group: getVal("blood_group"),
        photo_url: getVal("photo_url"),
        address: getVal("address"),
        sendEmail: false,
        customValues: Object.fromEntries(
          extraColumns.map((c) => [
            c.header.charAt(0).toUpperCase() + c.header.slice(1),
            row[c.idx]?.trim() || "",
          ]),
        ),
      });
    }

    if (imported.length === 0) {
      setSheetsError("No valid rows found with a name in the mapped column.");
      return;
    }

    // Notify parent
    onImported(imported);
    setSheetsSuccess(
      `✓ Imported ${imported.length} member(s). Scroll down and click "Generate & Download" to create the ID cards.`,
    );
    setShowMapping(false);
    setSheetHeaders([]);
    setSheetRows([]);
    setColumnMap({});
    setSheetsUrl("");
    setSheetsError("");
  };

  /** Cancel column mapping and go back */
  const handleCancelMapping = () => {
    setShowMapping(false);
    setSheetHeaders([]);
    setSheetRows([]);
    setColumnMap({});
  };

  return {
    // State
    sheetsUrl,
    setSheetsUrl,
    sheetsLoading,
    sheetsError,
    setSheetsError,
    sheetsSuccess,
    setSheetsSuccess,
    sheetHeaders,
    sheetRows,
    columnMap,
    setColumnMap,
    showMapping,
    // Actions
    handleSheetsImport,
    handleConfirmMapping,
    handleCancelMapping,
    // Constants
    MAPPABLE_FIELDS,
  };
}
