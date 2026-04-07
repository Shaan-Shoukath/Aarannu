# Complete Project Reference — Aarannu

Everything about this specific project. How every system actually works,
traced from source code. Read this to understand the full picture.

---

## Part A — Google Sheets Import (Two Paths)

There are **two separate code paths** for importing from Google Sheets:

```
Path 1: Frontend-only (Generate.jsx legacy flow)
  User → pastes URL → frontend fetches CSV directly → column mapping UI
  → member objects in React state → generate cards locally

Path 2: Backend API (new multi-tenant flow)
  Admin → pastes URL → POST /api/sheets/fetch (preview)
        → POST /api/sheets/import/:projectId (confirmed import)
        → members inserted into project_members table
```

### How URL-to-CSV works (both paths use the same trick)

Google Sheets has a hidden CSV export endpoint:
```
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
```

The `gid` is the tab index — `0` is the first sheet, `123456` is a specific tab
(visible in the URL when you click a tab).

**Step 1: Extract the Sheet ID**
```js
// backend/src/services/googleSheetsService.js

// Handles 3 input formats:
//  1. Full URL:  https://docs.google.com/spreadsheets/d/1BxiMV.../edit#gid=0
//  2. Export URL: https://docs.google.com/...export?format=csv
//  3. Bare ID:  "1BxiMVmEiM..."  (≥20 alphanumeric chars)

const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
// Returns: "1BxiMVmEiM..."
```

**Step 2: Build export URL**
```js
`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
```

**Step 3: Fetch CSV**
```js
const response = await fetch(exportUrl, {
  headers: { "User-Agent": "CommunityID-Importer/1.0" },
  redirect: "follow",   // Google redirects before serving the CSV
});
const csvText = await response.text();
```

**Important**: The sheet must be shared as "Anyone with the link" — otherwise
Google returns a 404 or an HTML login page instead of CSV.

### CSV Parsing (hand-written, no library)

Both frontend (`utils/csvParser.js`) and backend (`services/googleSheetsService.js`)
have hand-written CSV parsers. They handle:
- Comma-separated fields
- Quoted fields: `"Smith, John"` → `Smith, John`
- Escaped double-quotes inside quotes: `"He said ""hello"""` → `He said "hello"`
- Mixed line endings: `\n`, `\r\n`, `\r`

```js
// State machine approach:
let inQuotes = false;

for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  const next = text[i + 1];

  if (inQuotes) {
    if (ch === '"' && next === '"') { field += '"'; i++; }  // escaped quote
    else if (ch === '"') { inQuotes = false; }              // end quoted field
    else { field += ch; }
  } else {
    if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { push field, reset }
    else if (ch === '\n' || ch === '\r') { push row, reset }
    else { field += ch; }
  }
}
```

### Column Mapping (Frontend Path — `useSheetImport.js`)

After CSV is parsed, the headers are shown to the user with a mapping UI.
The hook auto-guesses mappings from header names:

```js
const GUESS_RULES = {
  name:       ["name", "full name", "fullname", "member name"],
  email:      ["email", "e-mail", "email address", "mail"],
  role:       ["role", "designation", "title", "position"],
  id_number:  ["id", "id_number", "id number", "member id"],
  dob:        ["dob", "date of birth", "birthday"],
  gender:     ["gender", "sex"],
  blood_group:["blood group", "blood_group", "blood type"],
  photo_url:  ["photo", "photo_url", "photo url", "image"],
  address:    ["address", "addr", "location"],
};

// Auto-guess: find which header index matches each field
const guessMap = {};
for (const [field, aliases] of Object.entries(GUESS_RULES)) {
  const idx = lowerHeaders.findIndex(h => aliases.includes(h));
  guessMap[field] = idx !== -1 ? idx : -1;  // -1 = not found, user must pick
}
```

**Unknown columns → auto-registered as custom fields**:
Any sheet column not mapped to a standard field becomes a custom field
automatically:
```js
const mappedIndices = new Set(Object.values(columnMap).filter(v => v !== -1));
const extraColumns = headers.filter((_, idx) => !mappedIndices.has(idx));
// extraColumns get registered as custom field definitions
```

### Backend Import API (`/api/sheets/`)

**POST /api/sheets/fetch** — Preview only (no DB writes)
```
Body: { sheetUrl: "https://docs.google.com/...", gid?: 0 }
Response: {
  headers: ["Name", "Email", "Dept"],
  preview: [ ...first 10 rows as objects... ],
  totalRows: 145
}
```

**POST /api/sheets/import/:projectId** — Full import
```
Body: {
  sheetUrl: "https://...",
  gid?: 0,
  columnMapping: { "Student Name": "name", "Email": "email" },
  autoApprove?: true
}
```

The `columnMapping` object maps sheet column headers → form field keys.
The controller:
1. Re-fetches and re-parses the sheet (stateless — no cached data)
2. Applies column mapping to produce normalized rows
3. Fetches `form_fields` table to know required/email field types
4. Validates: missing required fields, invalid email format
5. Checks `project.member_limit` — rejects if full
6. Splits fields: `name`, `email`, `photo_url` → top-level columns; everything else → `custom_fields` JSONB
7. Bulk inserts into `project_members`

---

## Part B — PDF Generation (Two Approaches)

### Approach 1: Client-Side PDFKit (`utils/pdfCardRenderer.js`)

The primary way cards are downloaded. Runs entirely in the browser.
No server round-trip. Uses **PDFKit** (ported to browser via node polyfills).

**Overall flow:**
```
generatePDF(params)
  │
  ├── [parallel] loadImages(params)      ← fetch photo, logo, watermark, signature
  ├── [parallel] prefetchFonts(fontFamily) ← download TTF from Google Fonts
  ├── [parallel] generateQRDataUrl(id)  ← generate QR PNG as data URL
  │
  ▼
const doc = new PDFDocument({ size: [pageWidth, pageHeight] })
doc.pipe(blobStream())
  │
  ├── drawFront(doc, params, images, fonts)
  │     ├── Black page background
  │     ├── Card background (full gradient OR corner triangles)
  │     ├── Logo image or letter-fallback circle
  │     ├── Org name (header)
  │     ├── Photo circle (clipped round)
  │     ├── Member name, role, ID number
  │     ├── Optional: DOB, gender, blood group
  │     ├── Custom fields (front-side)
  │     └── Watermark overlay
  │
  ├── doc.addPage()
  │
  └── drawBack(doc, params, images, fonts)
        ├── Matching gradient background
        ├── QR code (bottom-center)
        ├── Validity text
        ├── Custom fields (back-side)
        ├── Signature image
        └── Issuing authority / org name
  │
  ▼
stream.on('finish') → stream.toBlob('application/pdf')
  │
  ▼
downloadBlob(blob, 'member-name.pdf')
```

**CR-80 standard card dimensions (points):**
```js
const MM = 2.83465;   // 1mm = 2.83465 PDFKit points (72pt = 1 inch)

const CARD_H = { w: 85.6 * MM, h: 53.98 * MM };  // horizontal: 242.7 × 153.0 pt
const CARD_V = { w: 53.98 * MM, h: 85.6 * MM };  // vertical:   153.0 × 242.7 pt
const PAD = 2 * MM;   // 2mm padding around card edge
```

Page size = card + 2mm padding on all sides. Card sits inside a black page
so rounded corners show cleanly against the black border.

**Font management:**
PDFKit only ships Helvetica/Courier/Times-Roman built-in.
Custom fonts (Public Sans, Inter) are fetched as TTF from Google Fonts CDN:
```js
const GOOGLE_FONT_URLS = {
  "Public Sans": {
    regular: "https://fonts.gstatic.com/s/publicsans/v15/...Regular.ttf",
    bold:    "https://fonts.gstatic.com/s/publicsans/v15/...Bold.ttf",
  },
  Inter: { regular: "...", bold: "..." },
};

// Pre-download before starting the PDF (cached in Map so only fetched once)
async function prefetchFonts(cssFontFamily) {
  const urls = GOOGLE_FONT_URLS[fontName];
  await Promise.all([fetchFontBuffer(urls.regular), fetchFontBuffer(urls.bold)]);
}

// Register into PDFDocument
doc.registerFont("PublicSans-Regular", arrayBuffer);
doc.font("PublicSans-Regular").fontSize(14).text("Hello");
```

CSS fonts without Google Fonts URLs (Arial, Georgia, etc.) fall back to
the closest PDFKit built-in:
```js
const BUILTIN_FONT_MAP = {
  "Arial, sans-serif":         { regular: "Helvetica",    bold: "Helvetica-Bold" },
  "Georgia, serif":            { regular: "Times-Roman",  bold: "Times-Bold" },
  "'Courier New', monospace":  { regular: "Courier",      bold: "Courier-Bold" },
};
```

**Gradient drawing (PDFKit doesn't natively support diagonal gradients):**
```js
// Approach 1: Use linearGradient if available
const gradient = doc.linearGradient(x, y, x + w, y + h);
gradient.stop(0, startHex).stop(1, endHex);
doc.rect(x, y, w, h).fill(gradient);

// Approach 2: Simulate by drawing 120 thin vertical rectangles
// with interpolated colors (eliminates seam artifacts)
function drawGradientH(doc, x, y, w, h, startHex, endHex, steps = 120) {
  const c1 = hexToRgb(startHex);
  const c2 = hexToRgb(endHex);
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const c = lerpColor(c1, c2, i / (steps - 1));
    doc.rect(x + i * sw, y, sw + 0.3, h).fill(rgbToHex(c));  // +0.3 prevents hairline gaps
  }
}
```

**Card background modes:**
1. **Full gradient** (`fullGradientBg: true`): Entire card is the gradient.
   White base layer first, gradient drawn over it at `gradientOpacity` (0–1).
   Default opacity: 0.55.
2. **Corner triangles** (`fullGradientBg: false`): Card is the custom `bgColor`,
   with gradient triangles in top-right and bottom-left corners.

**Image loading (CORS-safe):**
```js
async function fetchImageAsDataUrl(url) {
  // External URLs (Google Drive, Cloudinary, etc.) go through the backend proxy:
  //   /api/proxy/image?url=<encoded>
  // This avoids browser CORS restrictions on cross-origin images.
  const proxied = proxyUrl(url);
  const res = await fetch(proxied, { mode: "cors" });
  const blob = await res.blob();
  // FileReader converts blob → data: URL for use in PDFKit
  return new Promise(r => {
    const reader = new FileReader();
    reader.onloadend = () => r(reader.result);
    reader.readAsDataURL(blob);
  });
}

// data: URL → Node Buffer (PDFKit needs Buffer, not data URL)
function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Buffer.from(bytes.buffer);
}
```

**QR code generation:**
```js
const qrDataUrl = await QRCode.toDataURL(cardId, {
  width: 200,
  margin: 1,
  color: { dark: "#000000", light: "#ffffff" },
});
// cardId is a UUID — scanning the QR opens: /verify/{cardId}
```

**Download:**
```js
// blobStream pipes PDFKit output → Blob
const stream = doc.pipe(blobStream());
doc.end();

stream.on("finish", () => {
  const blob = stream.toBlob("application/pdf");
  downloadBlob(blob, `${member.name}_ID.pdf`);
});

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);  // free memory
}
```

---

### Approach 2: Server-Side Puppeteer (`services/cardRenderer.js`)

Used for: single-card generation via the legacy `/api/ids/generate` endpoint,
and as a fallback when client-side rendering isn't available.

The entire card is rendered by a real Chrome browser — pixel-perfect CSS rendering.

```
POST /api/ids/generate
  │
  ├── checkTokens(1)          ← must have ≥ 1 token
  │
  └── cardRenderer.renderCard(params)
            │
            ├── getBrowser()  ← reuse cached Puppeteer instance (or launch new)
            ├── browser.newPage()
            ├── page.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 })
            │     ↑ 2x = "Retina" quality — 1800×1400 actual pixels
            │
            ├── page.goto(`${FRONTEND_URL}/render-card#${JSON.stringify(params)}`)
            │     ↑ All card data is in the URL hash — never hits the server
            │
            ├── page.waitForSelector("[data-render-ready='true']", { timeout: 20s })
            │     ↑ React sets this attribute when card finishes rendering
            │
            ├── sleep(800ms) ← let fonts / images settle
            │
            ├── page.$('#card-front').screenshot({ type: 'png' })  → frontPng
            ├── page.$('#card-front').screenshot({ type: 'jpeg', quality: 95 }) → frontJpeg
            ├── page.$('#card-back').screenshot({ type: 'png' })   → backPng
            │
            ├── [new page] build PDF HTML: @page { size: Wmm Hmm }, img src=base64
            ├── pdfPage.pdf({ width, height, printBackground: true })
            │     ↑ Puppeteer's Chrome-native PDF → perfect vector output
            │
            └── page.close()   (browser stays open for next request)
```

**Why URL hash (#)?**
The `#fragment` of a URL is browser-only — it's never sent to the server.
So passing 50KB of JSON in the hash doesn't appear in server access logs.

**Browser pooling:**
```js
let browserInstance = null;

const getBrowser = async () => {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({ headless: "new", args: [...] });
  browserInstance.on("disconnected", () => { browserInstance = null; });
  return browserInstance;
};
// Opening Chrome: ~500ms first time, ~0ms on reuse
```

**The `/render-card` frontend route (`pages/RenderCard.jsx`):**
```
Browser opens: /render-card#{"data":{"name":"Ali"},"template":"custom",...}
                                 ↑
                          RenderCard.jsx reads window.location.hash
                          Parses JSON
                          Renders the card components
                          Sets document.body.setAttribute('data-render-ready', 'true')
                          Puppeteer's waitForSelector catches this
                          Screenshot taken
```

---

## Part C — Email Delivery (Brevo)

### Architecture: Who Does What

```
Browser                          Backend                       Brevo API
  │                                 │                              │
  ├── Generate PDF (PDFKit) ──────► │                              │
  │    (base64 encoded)             │                              │
  │                                 │                              │
  ├── POST /api/email/send-card ──► │                              │
  │    { pdfBase64, recipientEmail, │                              │
  │      orgName, memberId, cardId} │                              │
  │                                 ├── POST api.brevo.com ──────► │
  │                                 │    { sender, to, subject,    │
  │                                 │      htmlContent,            │
  │                                 │      attachment: [pdfBase64]}│
  │                                 │                              │
  │                                 │ ◄── { messageId } ─────────  │
  │                                 │                              │
  │                                 ├── UPDATE project_members
  │                                 │    SET delivery_status='sent'
  │                                 │        email_sent_at=now()
  │                                 │        card_id=<uuid>
  │                                 │
  │ ◄── { success: true, messageId} │
```

**Why the backend handles Brevo, not the browser?**
- `BREVO_API_KEY` must never be exposed to the browser (it would be visible in network tab)
- The backend also needs to update the DB delivery status — it already has the service role key
- Brevo limits can be managed server-side

### Env vars for email

```env
BREVO_API_KEY=xkeysib-...          # Brevo API key (backend only)
BREVO_SENDER_EMAIL=noreply@yourapp.com
BREVO_SENDER_NAME=Aarannu
```

### Email HTML template (in `emailController.js`)

The email body is hardcoded HTML built inline:
```html
<div style="font-family: Segoe UI, Arial, sans-serif; max-width: 600px;">
  <h2>Hello {recipientName},</h2>
  <p>Your registration for <strong>{projectName}</strong> has been approved.
     Your digital ID card from <strong>{orgName}</strong> is attached.</p>
  <!-- conditional: if verificationUrl is set -->
  <p>Verify your card: <a href="{verificationUrl}">{verificationUrl}</a></p>
  <!-- conditional: if cardId is set -->
  <p>Card ID: <strong>{cardId}</strong></p>
</div>
```

Subject line: `Your ID Card from {orgName}`

### PDF attachment format (Brevo requires base64)

```js
// Browser generates PDF as Blob → base64 string → sent to backend
const blob = await generatePDF(params);
const reader = new FileReader();
reader.readAsDataURL(blob);
// result: "data:application/pdf;base64,JVBERi0xLjM..."
const pdfBase64 = reader.result.split(",")[1]; // strip the data: prefix

// Brevo attachment format:
attachment: [{
  content: pdfBase64,    // raw base64, no data: prefix
  name: "Ali_Hassan_ID.pdf"
}]
```

### Delivery state machine (stored in `project_members`)

```
Member created
    │
    ▼
status: "pending"
    │
    ▼  (admin approves)
status: "approved"
    │
    ▼  (admin generates cards)
delivery_status: "generated"
    │
    ▼  (admin clicks "Send Email")
delivery_status: "sending"
    │
    ├── Brevo success ──► delivery_status: "sent"
    │                      email_sent_at: timestamp
    │                      message_id: "brevo-msg-id"
    │
    └── Brevo failure ──► delivery_status: "failed_send"
                           delivery_error: "error message"
```

Failed sends are stored so the admin can retry. The failure is persisted even if
the backend crashes mid-request (it's written before returning the error response).

### Brevo vs Supabase SMTP

There are **two separate email systems**:

| System | Purpose | Config |
|--------|---------|--------|
| Supabase SMTP | Auth emails (OTP codes, password reset) | Supabase dashboard → Auth → SMTP |
| Brevo API | Transactional ID card delivery | `BREVO_API_KEY` in backend `.env` |

Supabase SMTP is configured in the Supabase dashboard with Brevo SMTP credentials
(not the API key — the SMTP host/port). The backend uses the Brevo REST API directly.

---

## Part D — Complete API Route Map

All routes mounted in `server.js`:

### Auth (`/api/auth`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/me` | JWT | Returns user + member profile |

### IDs — Legacy single-tenant (`/api/ids`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/ids` | JWT + Approved | List user's generated cards |
| POST | `/api/ids/generate` | JWT + Approved + 1 Token | Render card via Puppeteer, store PNG |

### Admin (`/api/admin`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/pending` | JWT + Admin | List unapproved members |
| POST | `/api/admin/approve/:userId` | JWT + Admin | Approve a member |
| POST | `/api/admin/cleanup` | JWT + Admin | Delete expired card records |

### Proxy (`/api/proxy`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/proxy/image` | None | Proxy external images (bypasses CORS). Max 10MB |

### Email (`/api/email`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/email/send-card` | JWT | Send PDF attachment via Brevo |

### Organizations (`/api/org`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/org` | JWT | List user's organizations |
| POST | `/api/org` | JWT | Create organization |
| GET | `/api/org/:orgId` | JWT + OrgMember | Get org details |
| PATCH | `/api/org/:orgId` | JWT + OrgOwner | Update org |

### Projects (`/api/projects`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/projects` | JWT + OrgMember | List projects for an org |
| POST | `/api/projects` | JWT + OrgAdmin | Create project |
| GET | `/api/projects/:id` | JWT + OrgMember | Get project details |
| PATCH | `/api/projects/:id` | JWT + OrgAdmin | Update project |

### Project Members (`/api/members`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/members` | JWT + OrgAdmin | List members for a project |
| PATCH | `/api/members/:id/approve` | JWT + OrgAdmin | Approve a member |
| PATCH | `/api/members/:id/reject` | JWT + OrgAdmin | Reject a member |
| POST | `/api/members/bulk-approve` | JWT + OrgAdmin | Approve multiple members |

### Generate (`/api/generate`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/generate/:projectId` | JWT + OrgAdmin + Tokens | Create card records for approved members |

### Cards (`/api/cards`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/cards/:projectId` | JWT + OrgAdmin | List generated cards for project |
| POST | `/api/cards/:cardId/revoke` | JWT + OrgAdmin | Revoke a card |

### Bulk (`/api/bulk`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/bulk/import/:projectId` | JWT + OrgAdmin | Import members array |
| POST | `/api/bulk/generate/:projectId` | JWT + OrgAdmin + Tokens | Generate cards for all approved members |
| GET | `/api/bulk/status/:projectId` | JWT + OrgAdmin | Get generation stats |

### Tokens (`/api/tokens`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/tokens/balance` | JWT | Current balance + contact email |
| GET | `/api/tokens/transactions` | JWT | Paginated transaction history |
| GET | `/api/tokens/analytics` | JWT | Usage stats, daily chart |
| POST | `/api/tokens/ensure-starter` | JWT | Creates wallet with 50 bonus if new user |

### Form Fields (`/api/form-fields`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/form-fields/:projectId` | None (public) | Returns form field definitions for registration |
| POST | `/api/form-fields/:projectId` | JWT + OrgAdmin | Create/update form fields |

### Sheets (`/api/sheets`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/sheets/fetch` | JWT + OrgAdmin | Preview sheet (headers + first 10 rows) |
| POST | `/api/sheets/import/:projectId` | JWT + OrgAdmin | Full import with column mapping |

### Uploads (`/api/uploads`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/uploads/photo` | JWT | Upload member photo to Supabase Storage |

### Render (`/api/render`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/render/card/:cardId` | Signed URL | Serve generated card image |

### Verify (`/api/verify`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/verify/:cardId` | None (public) | Returns card verification data |

### Events (`/api/events`)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/events` | JWT + OrgMember | List events for an org |
| POST | `/api/events` | JWT + OrgAdmin | Create event |
| POST | `/api/events/:id/checkin` | JWT + OrgAdmin | Record QR scan check-in |
| GET | `/api/events/:id/checkins` | JWT + OrgAdmin | List check-ins, export CSV |

### Health
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | None | `{ status: "ok", timestamp, uptime }` |

---

## Part E — Frontend Page Map

All routes in `App.jsx`:

### Public Routes
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `LandingPage` | Marketing homepage |
| `/login` | `Login` | Email + password → OTP 2FA flow |
| `/signup` | `Signup` | Create account → OTP verification |
| `/register/:projectId` | `RegistrationForm` | Public member self-registration form |
| `/verify/:cardId` | `VerifyCard` | QR code scan verification page |
| `/render-card` | `RenderCard` | Hidden route: Puppeteer renders card here |

### Protected — Legacy Single-Tenant
| Path | Component | Purpose |
|------|-----------|---------|
| `/dashboard` | `Dashboard` | Legacy dashboard (my generated cards) |
| `/templates` | `Templates` | Browse card templates |
| `/generate` | `Generate` | Single or Google Sheets bulk generate |
| `/tokens` | `TokenDashboard` | Balance, transaction history, analytics |
| `/tokens/purchase` | `TokenPurchase` | Contact form (replaces old Stripe integration) |

### Protected — Multi-Tenant SaaS
| Path | Component | Purpose |
|------|-----------|---------|
| `/org/new` | `OrgOnboarding` | Create a new organization |
| `/org/:slug/dashboard` | `OrgDashboard` | Org overview (projects, members count) |
| `/org/:slug/project/new` | `ProjectCreate` | Create project under org |
| `/org/:slug/project/:projectId` | `ProjectDashboard` | Project detail: members, approve, generate, email |
| `/org/:slug/bulk/:projectId` | `BulkDashboard` | Bulk import + generate + download ZIP |
| `/events` | `EventsDashboard` | Event list |
| `/events/:id` | `EventDetail` | Event check-ins with QR scanner |

---

## Part F — Database Schema (All Tables)

### `auth.users` (Supabase-managed)
Supabase creates and owns this. Contains: `id`, `email`, `created_at`, `email_confirmed_at`.
All other tables reference `auth.users.id` as `user_id`.

### `public.members` (Legacy single-tenant)
```
id          UUID, PK
user_id     UUID → auth.users (ON DELETE CASCADE)
name        TEXT
role        TEXT  ('Member' | 'Admin')
approved    BOOLEAN DEFAULT false
created_at  TIMESTAMPTZ
```
One row per user. `approved = true` required for legacy `/api/ids` routes.

### `public.organizations`
```
id          UUID, PK
name        TEXT
slug        TEXT UNIQUE (URL-safe name, e.g. "tinker-space")
logo_url    TEXT
owner_id    UUID → auth.users
created_at  TIMESTAMPTZ
```

### `public.org_members`
```
id      UUID, PK
org_id  UUID → organizations
user_id UUID → auth.users
role    TEXT CHECK IN ('member', 'admin', 'owner')
joined_at TIMESTAMPTZ
UNIQUE (org_id, user_id)
```

### `public.projects`
```
id            UUID, PK
org_id        UUID → organizations
name          TEXT
type          TEXT ('membership' | 'event' | 'student' | 'corporate')
description   TEXT
member_limit  INT (optional cap)
expiry_days   INT DEFAULT 365
is_active     BOOLEAN
template      TEXT ('custom' | 'corporate' | 'event' | 'student')
card_styles   JSONB (colors, fonts, sizes, logo URL, etc.)
form_fields   JSONB (deprecated — use form_fields table instead)
created_at    TIMESTAMPTZ
```

### `public.project_members`
```
id              UUID, PK
project_id      UUID → projects
org_id          UUID → organizations
name            TEXT
email           TEXT
photo_url       TEXT
status          TEXT ('pending' | 'approved' | 'rejected')
custom_fields   JSONB (any extra data from custom form or sheet)
delivery_status TEXT ('generated' | 'sending' | 'sent' | 'failed_send')
delivery_error  TEXT
card_id         UUID (set after card is generated)
email_sent_at   TIMESTAMPTZ
verification_url TEXT
created_at      TIMESTAMPTZ
```

### `public.form_fields`
```
id          UUID, PK
project_id  UUID → projects
field_key   TEXT (e.g. "student_id", "department")
label       TEXT (shown in registration form)
type        TEXT ('text' | 'email' | 'select' | 'date' | 'tel')
required    BOOLEAN
options     JSONB (for 'select' type: list of choices)
sort_order  INT
created_at  TIMESTAMPTZ
```

### `public.generated_cards` (Multi-tenant)
```
id          UUID, PK (used as QR data)
org_id      UUID → organizations
project_id  UUID → projects
member_id   UUID → project_members
file_path   TEXT (Supabase Storage path: "{orgId}/{projectId}/{name}_{cardId[:8]}.png")
qr_data     TEXT (= id — the UUID used for verification)
status      TEXT ('active' | 'revoked' | 'expired')
expires_at  TIMESTAMPTZ
created_at  TIMESTAMPTZ
```

### `public.generated_ids` (Legacy single-tenant)
```
id          UUID, PK
user_id     UUID → auth.users
member_name TEXT
org_name    TEXT
template    TEXT
storage_path TEXT (Supabase Storage)
file_url    TEXT (signed URL — refreshed on access)
expires_at  TIMESTAMPTZ
created_at  TIMESTAMPTZ
```

### `public.token_wallets`
```
id                  UUID, PK
user_id             UUID → auth.users
org_id              UUID → organizations (NULL = personal wallet)
balance             INT DEFAULT 0
lifetime_purchased  INT DEFAULT 0
lifetime_used       INT DEFAULT 0
created_at          TIMESTAMPTZ
UNIQUE (user_id, org_id) where org_id IS NULL → personal wallet
```

### `public.token_transactions` (append-only ledger — NEVER delete)
```
id            UUID, PK
wallet_id     UUID → token_wallets
user_id       UUID → auth.users
org_id        UUID → organizations
amount        INT  (negative = deduction, positive = credit)
type          TEXT ('usage' | 'purchase' | 'bonus' | 'refund' | 'adjustment')
description   TEXT
reference_id  TEXT (optional: card ID, project ID)
balance_after INT  (wallet balance after this transaction)
created_at    TIMESTAMPTZ
```

### `public.token_packages`
```
id           UUID, PK
name         TEXT ('Starter', 'Pro', 'Enterprise')
tokens       INT
price_cents  INT
is_active    BOOLEAN
sort_order   INT
```

### `public.events`
```
id          UUID, PK
org_id      UUID → organizations
name        TEXT
date        DATE
venue       TEXT
project_id  UUID → projects (optional — link event to a project)
created_at  TIMESTAMPTZ
```

### `public.event_checkins`
```
id          UUID, PK
event_id    UUID → events
card_id     UUID → generated_cards
member_id   UUID → project_members
checked_in_at TIMESTAMPTZ
scanned_by  UUID → auth.users
```

---

## Part G — Token Service Deep Dive

The token service is the most critical financial code. Every function:

### `getOrCreateWallet(userId, orgId)`
- Queries `token_wallets` for `(user_id = X AND org_id IS NULL)` (personal) or `(user_id = X AND org_id = Y)` (org-scoped)
- If no wallet: creates one with **50 token bonus**, records it as a `"bonus"` transaction
- Returns `{ wallet, error }`

### `deductTokens(userId, amount, description, referenceId, orgId)`
1. If `isAdmin(userId)` → return immediately with fake `{ balance: Infinity }`, no DB write
2. Validate: `amount` must be positive integer
3. Call `getOrCreateWallet` (auto-creates if first time)
4. **Atomic UPDATE**: `SET balance = balance - amount WHERE id = walletId AND balance >= amount`
   - If zero rows updated → insufficient balance → return `{ error: { code: 'INSUFFICIENT_TOKENS' } }`
5. Record `token_transactions` row with `amount: -amount, type: 'usage', balance_after: newBalance`
6. If transaction log write fails: log critical error but don't rollback (user paid, audit gap is better than free generation)

### `addTokens(userId, amount, type, description, referenceId, orgId)`
- `type` is one of: `"purchase"`, `"bonus"`, `"adjustment"`, `"refund"`
- Only `"purchase"` increments `lifetime_purchased`
- Adds transaction row with `amount: +amount`

### `refundTokens(...)` → calls `addTokens(..., "refund", ...)`
Used in bulk controller when fewer cards were generated than tokens deducted.

### `getTransactions(userId, { page, limit, type })`
- Paginated with offset: `range(from, to)` on Supabase
- Ordered by `created_at DESC`

### `getAnalytics(userId, orgId)`
- Aggregates `token_transactions WHERE type='usage' AND created_at >= 30 days ago`
- Builds `dailyUsage: { "2026-04-01": 5, "2026-04-02": 12 }` map
- Returns: `{ current_balance, lifetime_purchased, lifetime_used, used_last_30d, daily_usage, avg_daily }`

---

## Part H — The Image Proxy

External images (especially Google Drive) can't be fetched by the browser
due to CORS headers. The backend proxy strips CORS restrictions:

**Frontend** (`lib/proxyImage.js`): rewrites Google Drive URLs to:
```
GET /api/proxy/image?url=https%3A%2F%2Fdrive.google.com%2F...
```

**Backend** (`routes/proxyRoutes.js`):
```js
// Fetches the image server-side (no CORS restriction)
// Forwards the Content-Type header
// Streams the response back to browser
// Max size: 10MB (rejects larger)
// Sets CORS headers: Access-Control-Allow-Origin: *
```

The PDFKit renderer also uses this proxy when fetching images for PDF generation:
```js
function proxyUrl(url) {
  // localhost/blob/data: URLs pass through unchanged
  // External URLs → `${VITE_BACKEND_URL}/api/proxy/image?url=...`
}
```

---

## Part I — Card Verification Flow

```
User scans QR code on physical/digital card
       │
       ▼
Opens: https://yourapp.com/verify/{cardId}
       │
       ▼
VerifyCard.jsx calls GET /api/verify/{cardId}
       │
       ▼
verifyController.js queries:
  SELECT generated_cards.*,
    project_members(name, email, photo_url, custom_fields),
    projects(name, type),
    organizations(name, logo_url, slug)
  FROM generated_cards
  WHERE id = {cardId}
       │
       ├── Not found → { valid: false, reason: "Card not found" }
       ├── status = 'revoked' → { valid: false, reason: "Card has been revoked" }
       ├── expires_at < now() → { valid: false, reason: "Card has expired" }
       └── status = 'active'  → { valid: true, member: {...}, org: {...} }
       │
       ▼
VerifyCard.jsx shows:
  ✓ Valid Card (green) or ✗ Invalid (red)
  + Member name, photo, org logo, expiry date
```

The verification endpoint is public (no auth). Anyone who scans the QR sees
the result — intended for gate/reception verification.

---

## Part J — Storage Service

Cards and photos are stored in Supabase Storage (S3-compatible).

**Bucket**: `id-cards` (private — no public URL, requires signed URL)

**File paths**:
```
{orgId}/{projectId}/{safeName}_{cardId[:8]}.png    ← generated card
uploads/{userId}/{timestamp}_{filename}             ← uploaded photo
```

**Access**: Signed URLs with 1-hour TTL
```js
// storageService.js
const { data } = await supabase.storage
  .from('id-cards')
  .createSignedUrl(filePath, 3600);  // 3600 seconds = 1 hour
// Returns: { signedUrl: "https://supabase.co/storage/v1/sign/..." }
```

Signed URLs are generated fresh on each request — the stored `file_url` in the
DB may be expired. The storage service always generates a fresh signed URL.

**Cleanup**: Expired cards are soft-deleted (status = 'expired') by:
```bash
POST /api/admin/cleanup   # admin-only endpoint
```
Storage files for expired records can be deleted manually or via a Supabase Storage
lifecycle rule.

---

## Part K — Signup Bonus (50 Free Tokens)

New users get 50 free tokens. Here's the exact sequence:

**Frontend** (`lib/starterTokens.js`):
```js
// Called after successful OTP verification
const ensureStarterTokens = async (accessToken) => {
  await fetch('/api/tokens/ensure-starter', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
};
```

**Backend** (`controllers/tokenController.js`):
```js
// POST /api/tokens/ensure-starter
const ensureStarter = async (req, res) => {
  const { wallet } = await tokenService.getOrCreateWallet(req.user.id);
  // getOrCreateWallet auto-creates wallet with 50 tokens if none exists
  res.json({ balance: wallet.balance, isNew: /* whether wallet was just created */ });
};
```

The 50-token bonus is created inside `getOrCreateWallet` — if a wallet already exists,
this endpoint is a no-op (idempotent). Calling it multiple times is safe.

---

## Part L — Environment Variables (Complete)

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase public key (respects RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase admin key (bypasses RLS) — never expose |
| `PORT` | No | Express port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `CORS_ORIGIN` | Yes | Comma-separated allowed frontend URLs |
| `FRONTEND_URL` | Yes | Where Puppeteer navigates to render cards |
| `ADMIN_USER_IDS` | No | Comma-separated UUIDs of super-admins (unlimited tokens) |
| `BREVO_API_KEY` | No | Brevo REST API key for transactional emails |
| `BREVO_SENDER_EMAIL` | No | From address for card delivery emails |
| `BREVO_SENDER_NAME` | No | From name (default: org name) |

### Frontend (`frontend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | Same Supabase URL as backend |
| `VITE_SUPABASE_ANON_KEY` | Yes | Anon key for browser client |
| `VITE_API_URL` | Yes | Backend API base URL |
| `VITE_BULK_DAILY_LIMIT` | No | Max daily bulk uploads per user (default: 200) |
| `VITE_BULK_MAX_QUEUE` | No | Max queue size per session (default: 500) |

---

## Part M — Card Templates (What They Look Like)

Four card templates, all rendering the same data differently:

| Template | Style | Front | Back |
|----------|-------|-------|------|
| `custom` | Geometric gradient | Gradient BG, circular photo, org header | QR + address + authority |
| `corporate` | Red + Blue gradient | Red header band, photo, title | QR + contact + logo |
| `event` | Dark royal blue | Event logo + "ACCESS PASS" | QR + event details |
| `student` | Modern academic | Diagonal gradient + shield icon | QR + personal details + institution |

Each template exists as:
1. A React component (`components/IDCard.jsx`, `CorporateCard.jsx`, etc.) — used for live preview
2. PDFKit drawing code in `pdfCardRenderer.js` — used for PDF download
3. The same card is rendered by Puppeteer (screenshotting the React component) for server-side PNG

**Custom field positions**: Each custom field definition has a `side: "front" | "back"`.
Front-side custom fields appear under the standard fields. Back-side custom fields
appear on the card back near the QR code.

---

## Quick Lookup: Where Is X?

| Question | Answer |
|----------|--------|
| Where does Supabase connect? | `backend/src/config/supabaseClient.js` |
| Where do tokens get deducted? | `backend/src/services/tokenService.js → deductTokens()` |
| Where is the Brevo call? | `backend/src/controllers/emailController.js → sendCard()` |
| Where does Puppeteer run? | `backend/src/services/cardRenderer.js → renderCard()` |
| Where does CSV parse? | `frontend/src/utils/csvParser.js` and `backend/src/services/googleSheetsService.js` |
| Where does PDFKit draw? | `frontend/src/utils/pdfCardRenderer.js → drawFront()`, `drawBack()` |
| Where is column mapping? | `frontend/src/hooks/useSheetImport.js` |
| Where is the render-card page? | `frontend/src/pages/RenderCard.jsx` |
| Where are all routes mounted? | `backend/src/server.js` |
| Where is the RBAC check? | `backend/src/middleware/checkOrgRole.js` |
| Where is the token guard? | `backend/src/middleware/checkTokens.js` |
| Where is JWT verification? | `backend/src/middleware/verifyToken.js` |
| Where is the signup bonus? | `backend/src/services/tokenService.js → getOrCreateWallet()` |
| Where is card verification? | `backend/src/controllers/verifyController.js` |
| Where are card styles stored? | `projects.card_styles` JSONB column |
| Where are custom form fields? | `form_fields` table, loaded by `formFieldService.js` |
