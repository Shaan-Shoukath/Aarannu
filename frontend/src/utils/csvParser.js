/**
 * CSV Parser
 * ──────────
 * Minimal CSV parser that handles quoted fields, escaped quotes,
 * and mixed line endings (LF, CR, CRLF).
 *
 * Extracted from Generate.jsx to keep pure utility functions
 * separate from React components.
 *
 * @param {string} text — raw CSV text
 * @returns {string[][]} — array of rows, each an array of field strings
 */
export function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        if (ch === "\r") i++;
      } else if (ch === "\r") {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  // last field / row
  if (field || current.length) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}
