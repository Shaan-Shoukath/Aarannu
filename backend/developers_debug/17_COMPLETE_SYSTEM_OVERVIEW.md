# 17 — Complete System Overview (Everything in One Place)

The single document to read when you want to understand how this entire project fits together.

---

## What This Project Is

**Aarannu** is a multi-tenant SaaS platform for creating and distributing digital ID cards.

A school, company, or community group creates an account, builds a project, customizes the card design, and either:
- Opens a public registration form (members sign up themselves)
- Imports members from a Google Sheet
- Pastes raw member data (bulk import)

Then the admin approves members, generates ID cards (rendered as PDF/PNG), and emails them with a QR code for verification.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USERS                                     │
│  Admin (org owner)     │    Member (end user)    │  Public (QR scan) │
└───────────┬────────────┴─────────────┬───────────┴──────┬───────────┘
            │                          │                  │
            ▼                          ▼                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React 19 + Vite)                  │
│  react-router-dom v7 — SPA routing                                │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  ┌───────────┐  │
│  │  Dashboard  │  │  Generate   │  │ Register  │  │  Verify   │  │
│  │  (org mgmt) │  │  (cards)    │  │  (public) │  │  (public) │  │
│  └─────────────┘  └─────────────┘  └───────────┘  └───────────┘  │
│                                                                    │
│  PDF generation: pdfkit + blob-stream (runs IN the browser)       │
│  Supabase JS client: auth sessions, anon DB reads                 │
└──────────────────────────────┬────────────────────────────────────┘
                               │ HTTP (JSON REST API)
                               │ Authorization: Bearer JWT
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express 5 + Node.js 18+)             │
│                                                                   │
│  Middleware stack: helmet → cors → rateLimiter → json parser      │
│  Per route:        verifyToken → checkApproval → checkOrgRole     │
│                    → checkTokens → controller                     │
│                                                                   │
│  Controllers → Services → Supabase SDK (service-role key)        │
│                                                                   │
│  Puppeteer (headless Chrome) for server-side card rendering       │
│  Brevo REST API for email delivery                                │
│  Native fetch() for Google Sheets CSV scraping                   │
└──────────────────────────────┬────────────────────────────────────┘
                               │
         ┌─────────────────────┴────────────────────────┐
         │                SUPABASE (cloud)               │
         │                                               │
         │  PostgreSQL database (all tables + RLS)       │
         │  Auth (JWT sessions, OTP codes, SMTP)         │
         │  Storage (id-cards bucket — private PNGs)     │
         └───────────────────────────────────────────────┘
```

---

## All Project Files (Map)

### Backend (`backend/`)

```
backend/
├── .env                          ← Secret keys (never commit)
├── .env.example                  ← Template for env setup
├── package.json                  ← Dependencies: express, puppeteer, supabase-js, uuid, xlsx
├── src/
│   ├── server.js                 ← Express app: middleware, route mounting, error handler
│   ├── config/
│   │   └── supabaseClient.js     ← Two clients: service-role (admin) and anon (RLS-bound)
│   ├── middleware/
│   │   ├── verifyToken.js        ← Validates JWT → sets req.user
│   │   ├── checkApproval.js      ← Checks members.approved = true
│   │   ├── checkOrgRole.js       ← Checks org_members.role >= required level
│   │   ├── checkTokens.js        ← Checks token_wallets.balance >= required
│   │   ├── rateLimiter.js        ← 100 req/15min general, 20 req/15min auth
│   │   └── errorHandler.js       ← Catch-all: logs error, returns { error, message }
│   ├── routes/                   ← URL → controller wiring (no logic here)
│   │   ├── authRoutes.js         → /api/auth
│   │   ├── idRoutes.js           → /api/ids          (legacy)
│   │   ├── adminRoutes.js        → /api/admin
│   │   ├── proxyRoutes.js        → /api/proxy
│   │   ├── emailRoutes.js        → /api/email
│   │   ├── orgRoutes.js          → /api/org
│   │   ├── projectRoutes.js      → /api/projects
│   │   ├── projectMemberRoutes.js→ /api/members
│   │   ├── generateRoutes.js     → /api/generate
│   │   ├── verifyRoutes.js       → /api/verify
│   │   ├── bulkRoutes.js         → /api/bulk
│   │   ├── tokenRoutes.js        → /api/tokens
│   │   ├── formFieldRoutes.js    → /api/form-fields
│   │   ├── sheetImportRoutes.js  → /api/sheets
│   │   ├── uploadRoutes.js       → /api/uploads
│   │   ├── renderRoutes.js       → /api/render
│   │   ├── cardRoutes.js         → /api/cards
│   │   └── eventRoutes.js        → /api/events
│   ├── controllers/              ← HTTP handlers: read req → call service → write res
│   │   ├── authController.js     ← /me — returns user + member profile
│   │   ├── adminController.js    ← pending list, approve, cleanup
│   │   ├── orgController.js      ← CRUD for organizations
│   │   ├── projectController.js  ← CRUD for projects + card_styles
│   │   ├── projectMemberController.js ← approve, reject, bulk approve
│   │   ├── generateController.js ← createCardRecords, deductTokens, refund
│   │   ├── bulkController.js     ← bulk import members array
│   │   ├── cardController.js     ← list cards, revoke
│   │   ├── emailController.js    ← Brevo REST API call + DB delivery state update
│   │   ├── sheetImportController.js ← Google Sheets fetch + import
│   │   ├── formFieldController.js   ← custom form field CRUD
│   │   ├── tokenController.js    ← balance, transactions, analytics, ensure-starter
│   │   ├── idController.js       ← legacy single-tenant ID generation
│   │   ├── eventController.js    ← events + check-ins
│   │   └── verifyController.js   ← public QR verification lookup
│   ├── services/                 ← Business logic (no HTTP, pure functions + DB)
│   │   ├── supabaseService.js    ← legacy ID insert/fetch/delete
│   │   ├── cardRenderer.js       ← Puppeteer: launch browser, screenshot, PDF
│   │   ├── generateService.js    ← createCardRecords, revokeCard, getCardForVerification
│   │   ├── googleSheetsService.js← extractSheetId, fetchSheet, parseCSV, applyColumnMapping
│   │   ├── orgService.js         ← org + org_member CRUD
│   │   ├── projectService.js     ← project CRUD
│   │   ├── projectMemberService.js ← member CRUD, bulkInsert, updateDelivery
│   │   ├── formFieldService.js   ← form_fields CRUD + public read
│   │   ├── tokenService.js       ← wallet get/create, deduct, add, refund, analytics
│   │   ├── storageService.js     ← Supabase Storage signed URL generation
│   │   └── eventService.js       ← events + check-in CRUD
│   └── utils/
│       ├── adminHelper.js        ← isAdmin(userId) — reads ADMIN_USER_IDS env var
│       ├── expiryHelper.js       ← isExpired(timestamp), daysUntilExpiry(timestamp)
│       └── validators.js         ← Zod schemas for request body validation
├── developers_debug/             ← Internal deep-dive documentation (this folder)
├── docs/                         ← Learning course: beginner → production engineer
├── migrations/                   ← SQL files: run once in Supabase SQL Editor
└── supabase_migrations/          ← Alternative Supabase-format migrations
```

### Frontend (`frontend/src/`)

```
frontend/src/
├── App.jsx                       ← All routes defined here
├── main.jsx                      ← React root, Supabase auth listener
├── index.css                     ← Global styles
├── lib/
│   └── supabaseClient.js         ← createClient(url, anonKey) — browser Supabase instance
├── components/
│   ├── ProtectedRoute.jsx        ← Wraps routes needing auth
│   ├── Navbar.jsx                ← Top navigation
│   ├── CardPreview/              ← Live card preview components
│   │   ├── CardFront.jsx         ← Front face rendering (used by Generate + RenderCard)
│   │   └── CardBack.jsx          ← Back face with QR code
│   └── ...
├── pages/
│   ├── LandingPage.jsx           ← Public marketing page (/)
│   ├── Login.jsx                 ← Email+password → OTP 2FA
│   ├── Signup.jsx                ← Register → OTP verify → auto-approve
│   ├── Dashboard.jsx             ← Legacy: my generated cards
│   ├── Generate.jsx              ← Legacy: single generate + Google Sheets import
│   ├── RegistrationForm.jsx      ← Public: project self-registration (/register/:projectId)
│   ├── VerifyCard.jsx            ← Public: QR scan verification (/verify/:cardId)
│   ├── RenderCard.jsx            ← Hidden: Puppeteer navigates here for screenshots
│   ├── OrgDashboard.jsx          ← Multi-tenant org overview
│   ├── ProjectDashboard.jsx      ← Members, approve, generate, email delivery
│   ├── BulkDashboard.jsx         ← Bulk import + download ZIP
│   ├── TokenDashboard.jsx        ← Balance, history, chart
│   └── ...
├── hooks/
│   ├── usePdfPreview.js          ← Generates PDF preview while admin edits card
│   ├── useSheetImport.js         ← Frontend-side Google Sheets import logic
│   └── ...
└── utils/
    ├── pdfCardRenderer.js        ← Client-side: full PDFKit card drawing implementation
    ├── csvParser.js              ← Frontend CSV parser (mirrors backend implementation)
    └── ...
```

---

## All Database Tables

| Table | Purpose |
|---|---|
| `auth.users` | Supabase-managed: accounts, passwords, email confirmation |
| `public.members` | Legacy: one row per user, `approved` bool, `role` text |
| `public.organizations` | Org name, slug, logo, owner |
| `public.org_members` | Join: user ↔ org with role (member/admin/owner) |
| `public.projects` | Projects inside orgs: type, template, card_styles (JSONB) |
| `public.project_members` | Registrations: name, email, status, custom_fields, delivery_status |
| `public.form_fields` | Custom form field definitions per project |
| `public.generated_cards` | Multi-tenant: card UUID, file_path, QR data, expiry |
| `public.generated_ids` | Legacy single-tenant: PNG storage path, signed URL |
| `public.token_wallets` | One wallet per user: balance, lifetime stats |
| `public.token_transactions` | Immutable ledger: every deduction/credit/refund |
| `public.token_packages` | Purchasable token bundles (price, description, tokens) |
| `public.events` | Events within orgs |
| `public.event_checkins` | Who scanned in at which event, via QR code |

---

## All API Routes (Quick Reference)

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/health` | None | Server alive check |
| `GET /api/auth/me` | JWT | Current user + member profile |
| `GET /api/ids` | JWT + Approved | List my generated cards (legacy) |
| `POST /api/ids/generate` | JWT + Approved + 1 Token | Puppeteer render → PNG → Storage (legacy) |
| `GET /api/admin/pending` | JWT + Admin | Unapproved members list |
| `POST /api/admin/approve/:userId` | JWT + Admin | Approve a member |
| `GET /api/proxy/image` | None | Proxy any external image (CORS bypass) |
| `POST /api/email/send-card` | JWT | Send card PDF via Brevo |
| `GET /api/org` | JWT | List my orgs |
| `POST /api/org` | JWT | Create org |
| `PATCH /api/org/:orgId` | JWT + Owner | Update org |
| `GET /api/projects` | JWT + OrgMember | List projects |
| `POST /api/projects` | JWT + OrgAdmin | Create project |
| `PATCH /api/projects/:id` | JWT + OrgAdmin | Update project + card styles |
| `GET /api/members` | JWT + OrgAdmin | List project members |
| `PATCH /api/members/:id/approve` | JWT + OrgAdmin | Approve member |
| `PATCH /api/members/:id/reject` | JWT + OrgAdmin | Reject member |
| `POST /api/bulk/import/:projectId` | JWT + OrgAdmin | Import members array |
| `POST /api/generate/:projectId` | JWT + OrgAdmin + Tokens | Create card records |
| `GET /api/cards/:projectId` | JWT + OrgAdmin | List cards |
| `POST /api/cards/:cardId/revoke` | JWT + OrgAdmin | Revoke card |
| `GET /api/tokens/balance` | JWT | Token balance |
| `GET /api/tokens/transactions` | JWT | Transaction history |
| `POST /api/tokens/ensure-starter` | JWT | Init wallet with 50 bonus tokens |
| `GET /api/form-fields/:projectId` | None (public) | Registration form field definitions |
| `POST /api/form-fields/:projectId` | JWT + OrgAdmin | Set form fields |
| `POST /api/sheets/fetch` | JWT + OrgAdmin | Preview Google Sheet |
| `POST /api/sheets/import/:projectId` | JWT + OrgAdmin | Import from Google Sheet |
| `GET /api/verify/:cardId` | None (public) | QR scan verification |
| `GET /api/events` | JWT + OrgMember | List events |
| `POST /api/events` | JWT + OrgAdmin | Create event |
| `POST /api/events/:id/checkin` | JWT + OrgAdmin | Record check-in |

---

## All Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Project URL from Supabase Dashboard |
| `SUPABASE_ANON_KEY` | ✅ | anon/public key — respects RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role key — bypasses RLS |
| `PORT` | Optional | Express port (default: 5000) |
| `NODE_ENV` | Optional | `development` or `production` |
| `CORS_ORIGIN` | ✅ | Frontend URL(s), comma-separated |
| `FRONTEND_URL` | ✅ | URL Puppeteer navigates to for rendering |
| `ADMIN_USER_IDS` | Optional | Comma-separated UUIDs with unlimited tokens |
| `BREVO_API_KEY` | For email | Brevo API key starting with `xkeysib-` |
| `BREVO_SENDER_EMAIL` | For email | Verified sender email in Brevo |
| `BREVO_SENDER_NAME` | Optional | Display name for emails |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Same as backend `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Same as backend `SUPABASE_ANON_KEY` |
| `VITE_API_URL` | ✅ | Backend URL (e.g. `http://localhost:5000`) |
| `VITE_BULK_DAILY_LIMIT` | Optional | Max bulk members/day (default: 200) |
| `VITE_BULK_MAX_QUEUE` | Optional | Max queue size for bulk ops (default: 500) |

---

## Key Feature Flows (Plain English)

### Flow 1: New member registers themselves

```
/register/:projectId
      │
      ▼ Public form rendered from form_fields table
      │
      ▼ Member submits name, email, custom fields
      │
      ▼ POST /api/members (public endpoint)
      │
      ▼ Row inserted: project_members { status: 'pending' }
      │
      ▼ Admin sees new pending member in ProjectDashboard
      │
      ▼ Admin clicks Approve → PATCH /api/members/:id/approve
      │
      ▼ Row updated: status → 'approved'
```

### Flow 2: Admin generates cards

```
Admin clicks "Generate Cards"
      │
      ▼ POST /api/generate/:projectId
      │
      ▼ checkTokens(N) — N = approved members without active cards
      │
      ▼ deductTokens(N) atomically
      │
      ▼ generateService.createCardRecords() inserts N rows in generated_cards:
        { id: uuid, qr_data: uuid, file_path, status: 'active', expires_at }
      │
      ▼ Frontend receives card records with UUIDs
      │
      ▼ For each card record, frontend renders PDF (PDFKit in browser)
      │
      ▼ PDF shown in preview / available for download / send via email
```

### Flow 3: QR code verification

```
Someone scans QR code on a card
      │
      ▼ QR encodes: https://aarannu.shaans.works/verify/{card_uuid}
      │
      ▼ Browser opens VerifyCard.jsx
      │
      ▼ GET /api/verify/:cardId (public, no auth)
      │
      ▼ generateService.getCardForVerification(cardId)
        → joins generated_cards + project_members + projects + organizations
      │
      ▼ Returns: { member name, org, project, status, expires_at }
      │
      ▼ VerifyCard shows green badge (VALID) or red (REVOKED/EXPIRED)
```

### Flow 4: Google Sheets bulk import

```
Admin pastes Google Sheets URL
      │
      ▼ POST /api/sheets/fetch — preview headers + first 10 rows
      │
      ▼ Admin maps columns to form fields (UI)
      │
      ▼ POST /api/sheets/import/:projectId
        { columnMapping, autoApprove: true }
      │
      ▼ Backend: fetch CSV → parse → apply mapping → validate → bulk insert
      │
      ▼ Returns: { imported: 45, skipped: 2, validationErrors: [...] }
```

---

## Developers Debug Index

For deep technical details, read the numbered files in `backend/developers_debug/`:

| File | Topic |
|---|---|
| `01_ARCHITECTURE.md` | Why the backend exists; layering philosophy |
| `02_DATABASE_SCHEMA.md` | All table structures and relationships |
| `03_AUTH_VERIFICATION.md` | JWT verification internals |
| `04_RLS_AND_SECURITY.md` | Row Level Security deep dive |
| `05_STORAGE_SIGNED_URLS.md` | Supabase Storage signed URL strategy |
| `06_EXPIRY_LOGIC.md` | Card expiry state machine |
| `07_LIBRARIES_USED.md` | Why each npm package was chosen |
| `08_PRODUCTION_DEPLOYMENT.md` | Render.com + Vercel deploy configuration |
| `09_CARD_CUSTOMIZATION.md` | Card styles JSONB, templates |
| `10_TOKEN_SYSTEM.md` | Wallets, deductions, race conditions |
| `11_CUSTOM_FORM_SYSTEM.md` | Public registration, field definitions |
| `12_FORM_BUILDER_AND_IMPORTS.md` | Form builder UI + bulk import backend |
| `13_APPROVAL_AND_CLIENT_DELIVERY.md` | Approval boundary; who does what |
| `14_GOOGLE_SHEETS_IMPORT.md` | CSV scraping pipeline end-to-end |
| `15_PDF_GENERATION.md` | PDFKit + Puppeteer rendering in detail |
| `16_EMAIL_DELIVERY.md` | Brevo integration + Supabase SMTP |
| `17_COMPLETE_SYSTEM_OVERVIEW.md` | ← You are here |
