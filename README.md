# Aarannu — Community Digital ID Platform

A production-grade web application for generating, managing, and distributing digital identity cards within a community or organisation. Supports multiple card templates, custom fields, watermarks, QR codes, Google Sheets import, bulk PDF/ZIP delivery, and configurable rate limits.

---

## Features

- **4 ID card templates** — Custom (geometric), Corporate (red/blue gradient), Event (dark royal), Student (modern academic)
- **Organization config** — Custom org name, logo URL, watermark (text and/or image with opacity)
- **Custom fields** — Define extra fields (front or back) at runtime; auto-populated from Google Sheets
- **QR codes** — Each card gets a verification QR code embedded via `qrcode.react`
- **Google Sheets import** — Paste a public Sheets URL, then map columns in a 2-phase UI
- **Google Drive photos** — Member photos from Drive are proxied through the backend (CORS bypass)
- **Single card download** — PDF (2-page front+back) or JPEG from the live preview
- **Bulk generation** — PNGs uploaded to Supabase Storage + all cards bundled as a ZIP of 2-page PDFs
- **Dashboard** — View active IDs with thumbnails, download via signed URLs, track expiry countdown
- **Reliable downloads** — Signed URL with `download` disposition + blob fetch (no CORS issues)
- **Auth** — Email/password + Email OTP login via Supabase Auth
- **Approval gating** — Admin must approve members before they can generate cards
- **15-day expiry** — Generated IDs expire automatically; auto-cleanup every 6 hours
- **Configurable limits** — Daily cap (default 200), queue size (default 500), API batch (default 50)

---

## Project Structure

```
community-id/
├── frontend/              # React 19 + Vite 7 + Tailwind CSS v4
│   ├── src/
│   │   ├── components/    # IDCard, CorporateCard, EventCard, StudentCard, BulkGenerator, ProtectedRoute
│   │   ├── pages/         # Login, Signup, Dashboard, Templates, Generate
│   │   ├── lib/           # supabaseClient, proxyImage
│   │   └── utils/         # downloadHelpers (PDF/ZIP/JPEG/PNG conversion)
│   ├── public/
│   ├── developers_debug/  # 8 architecture docs
│   ├── .env.example
│   └── package.json
├── backend/               # Express 5 + Supabase Admin SDK + Image Proxy
│   ├── src/
│   │   ├── config/        # supabaseClient (service-role + anon)
│   │   ├── routes/        # auth, id, admin, proxy (Google Drive images)
│   │   ├── controllers/   # authController, idController, adminController
│   │   ├── services/      # supabaseService, storageService
│   │   ├── middleware/     # verifyToken, checkApproval, rateLimiter, errorHandler
│   │   ├── utils/         # validators, expiryHelper
│   │   └── server.js      # Entry point + auto-cleanup scheduler
│   ├── developers_debug/  # 8 architecture docs
│   ├── .env.example
│   └── package.json
├── SUPABASE_SETUP.md      # Complete Supabase setup guide (DB, RLS, Storage, Auth)
└── README.md              # This file
```

---

## Quick Start

```bash
# 1 — Clone
git clone <repo-url> community-id
cd community-id

# 2 — Backend setup
cd backend
npm install
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3 — Frontend setup
cd ../frontend
npm install
cp .env.example .env
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL

# 4 — Supabase setup (one-time)
# Follow SUPABASE_SETUP.md for complete instructions:
#   - Create tables: members, generated_ids
#   - Enable RLS + create policies for both tables
#   - Create private "id-cards" storage bucket + storage RLS policies
#   - Enable Email auth provider

# 5 — Start both
cd ../backend  && npm run dev     # http://localhost:5000
cd ../frontend && npm run dev     # http://localhost:5173
```

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable                 | Default                | Description                     |
| ------------------------ | ---------------------- | ------------------------------- |
| `VITE_SUPABASE_URL`      | —                      | Supabase project URL (required) |
| `VITE_SUPABASE_ANON_KEY` | —                      | Supabase anon key (required)    |
| `VITE_BACKEND_URL`       | `http://localhost:5000` | Backend API URL                |
| `VITE_BULK_DAILY_LIMIT`  | `200`                  | Max uploads per user per day    |
| `VITE_BULK_MAX_QUEUE`    | `500`                  | Max members per generation queue |

### Backend (`backend/.env`)

| Variable                     | Default                | Description                       |
| ---------------------------- | ---------------------- | --------------------------------- |
| `SUPABASE_URL`               | —                      | Supabase project URL (required)   |
| `SUPABASE_ANON_KEY`          | —                      | Supabase anon key (required)      |
| `SUPABASE_SERVICE_ROLE_KEY`  | —                      | Service role key (required, secret)|
| `PORT`                       | `5000`                 | Server port                       |
| `NODE_ENV`                   | `development`          | Environment mode                  |
| `CORS_ORIGIN`                | `http://localhost:5173` | Comma-separated allowed origins  |
| `BULK_BATCH_LIMIT`           | `50`                   | Max members per API batch         |

---

## Tech Stack

| Layer          | Technology                               |
| -------------- | ---------------------------------------- |
| Frontend       | React 19, Vite 7, Tailwind CSS v4        |
| Backend API    | Express 5, Node.js, Supabase Admin SDK   |
| Database       | Supabase Postgres + RLS                  |
| Storage        | Supabase Storage (private, signed URLs)  |
| Card Rendering | html2canvas (2× scale capture)           |
| PDF Generation | jsPDF (2-page front+back per card)       |
| ZIP Bundling   | JSZip + file-saver (bulk delivery)       |
| QR Codes       | qrcode.react (canvas-based)              |
| Image Proxy    | Express route (Google Drive CORS bypass) |
| Routing        | react-router-dom v7                      |

---

## Configurable Limits

| Limit                    | Default | Config Variable        | Layer    |
| ------------------------ | ------- | ---------------------- | -------- |
| Daily uploads per user   | 200     | `VITE_BULK_DAILY_LIMIT` | Frontend |
| Max queue size/session   | 500     | `VITE_BULK_MAX_QUEUE`   | Frontend |
| API batch size           | 50      | `BULK_BATCH_LIMIT`      | Backend  |
| API rate limit           | 100/15m | Hardcoded              | Backend  |
| Auth rate limit          | 20/15m  | Hardcoded              | Backend  |
| ID card expiry           | 15 days | Hardcoded              | Backend  |
| Signed URL TTL           | 1 hour  | Hardcoded              | Both     |
| Image proxy size cap     | 10 MB   | Hardcoded              | Backend  |
| Auto-cleanup interval    | 6 hours | Hardcoded              | Backend  |

---

## Delivery Formats

| Context         | Format                                  | Mechanism                          |
| --------------- | --------------------------------------- | ---------------------------------- |
| Single preview  | PDF (front+back) or JPEG (visible side) | jsPDF + html2canvas                |
| Bulk generation | ZIP of 2-page PDFs + cloud PNGs         | JSZip + file-saver + Supabase      |
| Dashboard       | PNG (signed URL, 1hr expiry)            | Supabase Storage + blob download   |

---

## Download Flow (Dashboard)

1. User clicks **Download** on a card.
2. Frontend calls `createSignedUrl()` with `{ download: filename }` option.
3. Signed URL is fetched as a blob via `fetch()`.
4. Blob is attached to a temporary `<a>` element and triggers a browser download.
5. Fallback: if fetch fails, the signed URL opens in a new tab.

This avoids all CORS issues since the blob is created client-side.

---

## Security

- **RLS on all tables + storage** — users can only access their own data
- **Private storage bucket** — no public URLs; access only via signed URLs
- **JWT verification** — every protected API route verifies tokens server-side
- **Approval gating** — generation blocked until admin-approved
- **Rate limiting** — per-IP limits on API (100/15m general, 20/15m auth)
- **Helmet** — secure HTTP headers
- **Input validation** — client + server-side with size/format constraints
- **Service-role isolation** — service key never exposed to frontend
- **Image proxy guards** — content-type whitelist, 10 MB cap, 15s timeout
- **Auto-cleanup** — expired records + storage files purged every 6 hours

---

## Documentation

- **Supabase setup**: [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — complete guide for DB, RLS, Storage, Auth
- **Frontend internals**: [frontend/developers_debug/](frontend/developers_debug/README.md) — 8 docs on architecture, schema, auth flow, storage, libraries
- **Backend internals**: [backend/developers_debug/](backend/developers_debug/README.md) — 8 docs on architecture, security, signed URLs, expiry, deployment

---

## License

MIT
