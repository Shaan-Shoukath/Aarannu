# 14 — Google Sheets Import Pipeline

Deep technical reference for how the platform fetches, parses, maps, validates, and inserts Google Sheets data into the database.

---

## Overview

The Google Sheets import feature allows admins to bulk-import project members by pointing the system at a publicly shared spreadsheet. This is a **one-shot scrape** — there is no live sync, no webhook, no OAuth, and no Google service account required. After import, Supabase owns the data; the sheet is never accessed again.

---

## Files Involved

| Layer | File | Role |
|---|---|---|
| Service | `src/services/googleSheetsService.js` | Fetching, parsing, mapping, validating |
| Controller | `src/controllers/sheetImportController.js` | HTTP handlers — preview & import |
| Route | `src/routes/sheetImportRoutes.js` | Express route wiring |
| DB Service | `src/services/projectMemberService.js` | `bulkInsertMembers()` |

---

## Step-by-Step Pipeline

### Step 1 — URL to Sheet ID (`extractSheetId`)

```
Input:  "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0"
Output: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
```

Regex used:
```js
input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
```

Also accepts:
- A bare Sheet ID (alphanumeric string 20+ chars)
- A direct CSV export URL (sheet ID extracted via same regex)

### Step 2 — Build CSV Export URL (`buildExportUrl`)

```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}
```

- `gid=0` = first tab (default)
- Different tabs have different numeric GIDs (visible in the URL when that tab is selected in Google Sheets)
- This endpoint is public for sheets shared as "Anyone with the link can view"

### Step 3 — HTTP Fetch (`fetchSheet`)

```js
fetch(exportUrl, {
  headers: { "User-Agent": "CommunityID-Importer/1.0" },
  redirect: "follow"
})
```

- Uses Node.js native `fetch` (Node 18+, no axios)
- Follows redirects automatically (Google often redirects CSV exports)
- Sets a custom `User-Agent` to identify the request
- Timeout: none set at fetch level — rely on Express timeout middleware

**Error cases handled:**
| HTTP status | Meaning | Error returned |
|---|---|---|
| 404 | Sheet not found / not public | "Sheet not found. Make sure it exists and is publicly shared." |
| Any other non-OK | Fetch failure | "Failed to fetch sheet: HTTP {status}" |
| Empty body | Blank sheet | "Sheet is empty." |

### Step 4 — CSV Parsing (`parseCSV`)

A custom state-machine CSV parser. **This does NOT use any npm library** (no `csv-parse`, no `papaparse`). It handles:

- Quoted fields: `"Hello, world"` → `Hello, world`
- Escaped quotes inside quoted fields: `"say ""hello"""` → `say "hello"`
- Newlines inside quoted fields (multi-line cells)
- Windows `\r\n` and Unix `\n` line endings
- Trailing whitespace trimmed per field

The first row returned from `parseCSV` is treated as the **header row**. All subsequent rows are data rows.

### Step 5 — Row to Object Conversion

After parsing, each data row (array of strings) is converted to an object using headers as keys:

```js
// headers: ["Name", "Email", "Department"]
// row:     ["Alice", "alice@example.com", "Engineering"]
// result:  { Name: "Alice", Email: "alice@example.com", Department: "Engineering" }
```

Missing cells (row shorter than header) default to `""`.

### Step 6 — Column Mapping (`applyColumnMapping`)

The admin provides a `columnMapping` object that links sheet column names to the project's form field keys:

```json
{
  "Name": "name",
  "Email Address": "email",
  "Student ID": "student_id",
  "Department": "department"
}
```

This mapping is applied to every row:

```js
// Input  row: { Name: "Alice", "Email Address": "alice@test.com" }
// Mapping:    { "Name": "name", "Email Address": "email" }
// Output row: { name: "Alice", email: "alice@test.com" }
```

Columns not in the mapping are **silently dropped**. This lets sheets with extra metadata columns be imported cleanly without errors.

### Step 7 — Validation (`validateMappedRows`)

Each mapped row is validated against the project's `form_fields` definitions (fetched from the DB):

| Check | What it does |
|---|---|
| Required fields | Any `field.required = true` field must have a non-empty value |
| Email format | Any field with `type = "email"` is tested with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |

Rows that fail any check go into the `errors` array with:
```json
{
  "rowIndex": 3,
  "row": { "name": "", "email": "bad-email" },
  "errors": ["Missing required field: name", "Invalid email in field: email"]
}
```

Valid rows proceed to import. Invalid rows are **not imported** — they are returned to the admin in the API response.

### Step 8 — Member Limit Check

If the project has a `member_limit` set, the backend checks:
```
existing approved/pending count + valid import count <= member_limit
```

If the import would exceed the limit, a 400 error is returned **before any inserts happen**.

### Step 9 — DB Insert (`bulkInsertMembers`)

Valid rows are mapped to the `project_members` table schema:

| Field | Source |
|---|---|
| `name` | `row.name` (falls back to `"Unknown"`) |
| `email` | `row.email` (nullable) |
| `photo_url` | `row.photo` or `row.photo_url` |
| `custom_fields` | All other mapped fields stored as JSONB |
| `status` | `"approved"` (if `autoApprove=true`) or `"pending"` |
| `project_id` | From route param |
| `org_id` | From project record |

All valid rows are inserted in a single Supabase `insert()` call (no loops).

---

## API Endpoints

### `POST /api/sheets/fetch`

Preview a sheet before committing to import.

**Request body:**
```json
{
  "sheetUrl": "https://docs.google.com/spreadsheets/d/SHEET_ID/edit",
  "gid": 0
}
```

**Response:**
```json
{
  "headers": ["Name", "Email Address", "Department"],
  "preview": [ { "Name": "Alice", "Email Address": "alice@test.com" } ],
  "totalRows": 47
}
```

Only the first 10 rows are returned as preview. `totalRows` shows the full count.

---

### `POST /api/sheets/import/:projectId`

Full import with column mapping.

**Request body:**
```json
{
  "sheetUrl": "https://docs.google.com/spreadsheets/d/SHEET_ID/edit",
  "gid": 0,
  "columnMapping": {
    "Name": "name",
    "Email Address": "email",
    "Department": "department"
  },
  "autoApprove": true
}
```

**Response:**
```json
{
  "imported": 45,
  "skipped": 2,
  "validationErrors": [
    { "rowIndex": 12, "errors": ["Missing required field: name"] }
  ],
  "total": 47,
  "message": "Successfully imported 45 members (2 rows skipped due to validation errors)."
}
```

---

## Authentication

Both endpoints require:
1. A valid JWT (`verifyToken` middleware)
2. The user to be an admin or org owner of the project (enforced by `checkApproval` or org role check in the controller)

---

## Important Limitations

| Limitation | Detail |
|---|---|
| **Sheet must be public** | The Google Sheets CSV export endpoint only works for sheets shared as "Anyone with the link (view)". Private sheets return 403/404. |
| **No live sync** | Import is one-shot. If the sheet changes, you must re-import. |
| **No photos via sheet** | The `photo_url` field in the sheet must be a direct image URL (not a Google Drive link — those require authentication). |
| **GID must be known** | For multi-tab sheets, the tab GID must be explicitly provided. The UI discovers it from the preview URL. |
| **50-row validation error cap** | The API returns at most 50 validation error records to avoid huge payloads. |

---

## Debugging Tips

**Sheet shows "not found" but URL works in browser:**
- Confirm the sheet is shared as "Anyone with the link can view" via the Share dialog, not just "Restricted".

**All rows are skipped:**
- Check that `columnMapping` keys exactly match the sheet's header row (case-sensitive, whitespace-sensitive).
- Use the `/fetch` endpoint first to see the exact headers returned.

**Import succeeds but members have empty fields:**
- The mapping likely has a typo. Compare `preview` headers from `/fetch` against your `columnMapping` keys.

**`gid` is wrong:**
- In Google Sheets, click the target tab and look at the URL: `...#gid=12345`. Pass `12345` as the `gid` parameter.
