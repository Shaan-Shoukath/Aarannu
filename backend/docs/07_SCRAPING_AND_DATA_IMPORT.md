# Level 7 — Web Scraping and Data Import

How to pull data from the outside world into your application — the right way, and why.

---

## Part A — What Is Web Scraping?

Web scraping is the act of programmatically extracting data from a website or web service.

There are three types of "scraping" you'll encounter:

| Type | What it means | Example in this project |
|---|---|---|
| **HTML scraping** | Parse a webpage's HTML to extract content | Not used here |
| **API scraping** | Call a service's undocumented or unofficial API | Not used here |
| **Structured data scraping** | Use a service's own export format | ✅ Google Sheets CSV export |

This project uses **structured data scraping** — not brittle HTML parsing, but Google's own CSV export endpoint. Understanding when to use each approach is an important engineering judgment call.

---

## Part B — Why Scrape Google Sheets?

The problem to solve: an admin has hundreds of member records in a Google Sheet, and they need to import them into the platform.

### Option 1: Google Sheets API (what most devs think you need)

```
You → Google Cloud Console → Create project → Enable Sheets API
     → Create OAuth 2.0 credentials or Service Account
     → Download credentials JSON
     → Install googleapis npm package
     → Write authentication code
     → Make API call
```

**Problems:**
- Requires a Google Cloud project (setup takes hours)
- Requires OAuth consent screen approval for production
- Service accounts are complex for end-users to share access with
- Adds a heavyweight dependency
- Raises security questions about credential storage

### Option 2: CSV Export (what this project does)

```
Sheet URL → extract sheet ID → build export URL → fetch CSV
```

**How it works:**
Google Sheets has a public CSV export endpoint that works for any sheet shared as "Anyone with the link can view":

```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={TAB_ID}
```

**Advantages:**
- Zero authentication required (if the sheet is public)
- No Google Cloud project needed
- No npm package for the API
- Works in any environment (no credentials to manage)
- Instant — one HTTP request

**Limitations:**
- Only works for publicly shared sheets
- No write access (import only)
- No live sync — it's a one-time snapshot

For this use case (bulk import members once, then manage in DB), these limitations are fine. Don't use a cannon when a knife will do.

---

## Part C — Libraries vs Hand-Rolling

When you face a parsing problem, the first instinct is to find an npm package. Here's how to think about that decision.

### The decision framework

Ask yourself:
1. Is this a well-defined, complex format? (HTTP headers: yes. CSV: only somewhat)
2. Will edge cases be painful to handle? (XML namespaces: yes. CSV quotes: manageable)
3. Is correctness more important than understanding? (security-critical: yes. member import: no)
4. Will the library add significant overhead if you switch it? (binary parsers: yes. tiny utility: no)

### Why this project hand-rolled the CSV parser

CSV *seems* simple: `value1,value2,value3`. But there are edge cases:

```
"Name","Email"                        ← quoted fields
"Smith, John","john@test.com"         ← comma inside quotes
"She said ""hello""","text"           ← escaped double-quotes inside quotes
"Multi-line
name","test@test.com"                 ← newline inside a quoted field
```

An npm library like `csv-parse` handles all of these. But:
- This is import-only (one direction, one file at a time)
- You can test the hand-rolled parser yourself
- Keeping it in-house means you understand every line of it
- It removes a dependency that could have its own security issues

**The hand-rolled parser uses a state machine** — not splitting on commas (which breaks for quotes):

```
State: either INSIDE_QUOTES or OUTSIDE_QUOTES

For each character:
  If OUTSIDE_QUOTES:
    " → switch to INSIDE_QUOTES
    , → end of field, push to current row
    \n → end of row, push to rows
    else → append to current field

  If INSIDE_QUOTES:
    "" (two quotes) → append one " to field (escaped quote)
    " (single) → switch to OUTSIDE_QUOTES (end of quoted field)
    else → append to current field (even commas and newlines)
```

This is classically how you parse any context-sensitive text format.

### When you SHOULD use a library

- Complex formats with specs: JSON, XML, HTML → use `JSON.parse`, `fast-xml-parser`, `cheerio`
- Formats with binary encoding: Excel `.xlsx` → use `xlsx` (already in this project)
- When you need streaming large files (100MB+ CSV): use `csv-parse` with streams
- When you need to handle encoding: emoji, unicode edge cases → use `iconv-lite`

---

## Part D — The Step-by-Step Pipeline (With Code)

### Step 1: URL → Sheet ID

The user pastes a URL like:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0
```

Extract just the ID using a regex:

```js
const extractSheetId = (input) => {
  // If it's already a bare ID (20+ alphanumeric chars, no slashes):
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) {
    return input.trim();
  }

  // Extract from full URL:
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};
```

The regex `/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/`:
- `\/spreadsheets\/d\/` — literal text (slashes escaped in regex)
- `([a-zA-Z0-9_-]+)` — capture group: one or more alphanumeric chars, underscores, hyphens
- This captures everything after `/d/` up to the next delimiter

### Step 2: Build the export URL

```js
const buildExportUrl = (sheetId, gid = 0) => {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
};
// gid = tab index. gid=0 is always the first tab.
// For other tabs: look at the URL in your browser when you click a tab → ?gid=12345
```

### Step 3: Fetch the CSV

```js
const response = await fetch(exportUrl, {
  headers: { "User-Agent": "CommunityID-Importer/1.0" },
  redirect: "follow",          // Google redirects before serving the file
});

if (!response.ok) {
  // 404 = sheet doesn't exist or isn't public
  // 403 = sheet is private (requires Google login)
  throw new Error(`Sheet fetch failed: HTTP ${response.status}`);
}

const csvText = await response.text();
```

**Why set `User-Agent`?** Some services block requests with no user agent. Setting a descriptive one also helps if Google's logs show your traffic — it's identifiable.

**Why `redirect: "follow"`?** Google's CSV export redirects a few times before returning the file. Without this, `fetch()` would fail on the first redirect.

### Step 4: Parse CSV (state machine)

```js
const parseCSV = (csvText) => {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentField += '"';   // escaped quote: "" → "
        i++;                   // skip the second quote
      } else if (char === '"') {
        inQuotes = false;      // closing quote
      } else {
        currentField += char;  // normal char inside quotes (even commas, newlines)
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = "";
        if (char === '\r') i++;  // skip the \n in \r\n
      } else {
        currentField += char;
      }
    }
  }

  // Handle the last field/row (no trailing newline)
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
  }

  return rows;  // array of arrays: [[header1, header2], [val1, val2], ...]
};
```

### Step 5: Convert rows to objects

```js
const allRows = parseCSV(csvText);
const headers = allRows[0];         // first row = column names
const dataRows = allRows.slice(1);  // everything else = data

// Convert array-of-arrays to array-of-objects:
const rows = dataRows.map(row => {
  const obj = {};
  headers.forEach((header, idx) => {
    obj[header] = row[idx] || "";   // "" if row is shorter than headers
  });
  return obj;
});

// Result: [{ "Name": "Ali", "Email": "ali@test.com" }, ...]
```

### Step 6: Column mapping

The sheet's column names probably don't match the DB field names exactly. The user maps them:

```
Sheet column: "Student Full Name"  →  DB field: "name"
Sheet column: "Contact Email"      →  DB field: "email"
Sheet column: "Department"         →  DB field: "department"
```

```js
const applyColumnMapping = (rows, mapping) => {
  // mapping = { "Student Full Name": "name", "Contact Email": "email" }
  return rows.map(row => {
    const mapped = {};
    for (const [sheetCol, fieldKey] of Object.entries(mapping)) {
      if (row[sheetCol] !== undefined) {
        mapped[fieldKey] = row[sheetCol];
      }
    }
    return mapped;  // { name: "Ali Hassan", email: "ali@test.com" }
  });
};
```

Columns not in the mapping are **silently dropped**. This is intentional — sheets often have extra metadata columns not needed for import.

### Step 7: Validation

Before inserting into the DB, validate each row against the project's field requirements:

```js
const validateMappedRows = (rows, formFields) => {
  const valid = [];
  const errors = [];

  const requiredKeys = formFields.filter(f => f.required).map(f => f.field_key);
  const emailKeys   = formFields.filter(f => f.type === 'email').map(f => f.field_key);

  rows.forEach((row, idx) => {
    const rowErrors = [];

    for (const key of requiredKeys) {
      if (!row[key] || !String(row[key]).trim()) {
        rowErrors.push(`Missing required field: ${key}`);
      }
    }

    for (const key of emailKeys) {
      if (row[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[key])) {
        rowErrors.push(`Invalid email format in field: ${key}`);
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
```

**Why validate here and not in the DB?** Both, ideally. DB constraints are the last line of defense. Application-level validation gives better error messages (which row failed, which field, why) and lets you skip invalid rows rather than aborting the entire import.

### Step 8: Bulk insert

All valid rows are inserted in a single `supabase.from(...).insert(rows)` call — not one by one. A loop of `N` inserts would make `N` HTTP calls and `N` DB round-trips. A single bulk insert is one call.

```js
const { data, error } = await supabase
  .from('project_members')
  .insert(dbRows)   // array of objects
  .select();
```

---

## Part E — Production Considerations

### What if the sheet has 10,000 rows?

The current implementation loads the entire CSV into memory. For very large sheets:

1. The CSV text itself (say 10,000 rows × 10 columns) is still manageable (~2–5MB)
2. But DB insert of 10,000 rows at once might time out

For large datasets, chunk the inserts:
```js
const CHUNK_SIZE = 500;
for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const chunk = rows.slice(i, i + CHUNK_SIZE);
  await supabase.from('project_members').insert(chunk);
}
```

### What if Google's CSV endpoint changes?

This is the risk of using an unofficial endpoint. Signs it broke:
- HTTP 200 but body is HTML (Google login page)
- HTTP 404 even for valid public sheets

Mitigation: validate the response is actually CSV (starts with text, not `<html`).

### What if you need write access (put data INTO a sheet)?

Then you need the Google Sheets API proper. The CSV export is read-only.

For write access: use `googleapis` package, set up a service account, share the sheet with the service account's email. Documented well in Google's official docs.

### Rate limits

Google's CSV export is not officially rate-limited, but:
- Don't scrape the same sheet repeatedly
- Don't loop over 1,000 sheets in parallel
- Cache the result if the same sheet is imported multiple times quickly

---

## Summary: When to use each approach

| Need | Approach |
|---|---|
| Read from a public Google Sheet | CSV export endpoint (this project's approach) |
| Read from a private Google Sheet | Google Sheets API + Service Account |
| Write to a Google Sheet | Google Sheets API (no alternative) |
| Import from Excel `.xlsx` file | `xlsx` npm package |
| Import from a CSV file upload | `multer` for upload + hand-rolled or `csv-parse` |
| Import from a database you own | Direct DB connection or REST API |
| Scrape an HTML website | `puppeteer` (renders JS) or `cheerio` (fast HTML parser) |
