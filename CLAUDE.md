# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aarannu** — A production-grade SaaS platform for generating, managing, and distributing digital identity cards within communities and organizations. Monorepo with a React 19 frontend and Express 5 backend, both using Supabase as the database/auth/storage layer.

## Commands

### Development

```bash
# Run both frontend and backend concurrently (from root)
npm run dev

# Run individually
npm run dev:backend     # Express server on :5000
npm run dev:frontend    # Vite dev server on :5173

# Install all dependencies
npm run install:all
```

### Backend

```bash
cd backend
npm run dev      # nodemon src/server.js
npm start        # node src/server.js (production)
npm test         # Jest --verbose --forceExit (runs backend/__tests__/)
```

### Frontend

```bash
cd frontend
npm run dev      # Vite dev server
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint
```

### Running a Single Backend Test

```bash
cd backend
npx jest --verbose --forceExit src/__tests__/<filename>.test.js
```

## Environment Setup

Copy `.env.example` files in both `backend/` and `frontend/` before starting:

**Backend** (`backend/.env`): Supabase URL + anon key + service role key, PORT (5000), CORS_ORIGIN, FRONTEND_URL (for Puppeteer), BREVO email config, ADMIN_USER_IDS (comma-separated UUIDs).

**Frontend** (`frontend/.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (backend URL), bulk generation limits (`VITE_BULK_DAILY_LIMIT=200`, `VITE_BULK_MAX_QUEUE=500`).

Database schema and Supabase setup: follow `SUPABASE_SETUP.md`.

## Architecture

### Backend (`backend/src/`)

Follows a **Routes → Controllers → Services** layered pattern.

**Middleware pipeline** (applied in order):
```
helmet → cors → JSON (10MB) → rateLimiter → verifyToken →
checkApproval → checkOrgRole → checkPlanLimits → checkTokens → Controller
```

- `middleware/verifyToken.js` — JWT verification via Supabase
- `middleware/checkTokens.js` — Token balance check; returns 402 if insufficient (1 token = 1 card)
- `middleware/checkApproval.js` — Blocks unapproved members
- `middleware/checkOrgRole.js` — Org-level RBAC
- `middleware/errorHandler.js` — Centralized error handling

**Key services**:
- `services/supabaseService.js` — All DB operations
- `services/tokenService.js` — Token wallet CRUD and analytics
- `services/cardRenderer.js` — Puppeteer-based server-side card rendering (navigates to `FRONTEND_URL/render-card`)
- `services/storageService.js` — Signed URL generation (1-hour TTL) for private Supabase Storage

**Automated cleanup**: Runs every 6 hours, deletes expired card records and their storage files.

### Frontend (`frontend/src/`)

React 19 SPA using React Router v7.

**Route structure**:
- Public: `/login`, `/signup`, `/register/:projectId`, `/verify/:cardId`, `/render-card`
- Protected (legacy): `/dashboard`, `/templates`, `/generate`, `/tokens`, `/tokens/purchase`
- Protected (SaaS): `/org/new`, `/org/:slug/dashboard`, `/org/:slug/project/new`, `/org/:slug/project/:projectId`, `/org/:slug/bulk/:projectId`

**Card templates** (in `components/`): `IDCard.jsx` (geometric custom), `CorporateCard.jsx` (red+blue gradient), `EventCard.jsx` (dark royal), `StudentCard.jsx` (modern academic)

**Card generation flow**:
1. User fills `MemberForm.jsx` or imports from Google Sheets via CSV/API
2. Card rendered client-side using html2canvas (2x scale) for preview
3. Downloads: PDF (jsPDF, 2-page front+back), JPEG, or PNG
4. Bulk: generates PNGs → uploads to Supabase Storage → sends ZIP to user

**Key utilities**:
- `utils/pdfCardRenderer.js` — Client-side PDF generation
- `utils/downloadHelpers.js` — `canvasesToPdfBlob()`, `downloadBlob()`, blob-to-format converters
- `lib/proxyImage.js` — Rewrites Google Drive URLs through backend proxy to bypass CORS
- `lib/supabaseClient.js` — Singleton Supabase client

**Styling**: Tailwind CSS v4 (configured via `@tailwindcss/vite` plugin, no `tailwind.config.js`).

**Node polyfills**: `vite-plugin-node-polyfills` is used because `pdfkit` and similar Node-only libraries are imported client-side.

### Supabase Integration

Both frontend (anon key, RLS-enforced) and backend (service role key, bypasses RLS) connect to the same Supabase project. The backend uses the service role key exclusively for admin operations — it is never exposed to the frontend.

Key tables: `members`, `generated_ids`, `organizations`, `projects`, `project_members`, `token_wallets`, `token_transactions`.

## Developer Documentation

Extensive markdown docs live in:
- `backend/docs/` — Architecture, DB schema, auth, RLS, storage, token system, custom forms, Google Sheets integration
- `SUPABASE_SETUP.md` — Full one-time setup guide for Supabase (tables, RLS, storage buckets, auth)

## Configurable Limits

| Limit | Default | Config |
|---|---|---|
| Daily uploads | 200 | `VITE_BULK_DAILY_LIMIT` |
| Queue size | 500 | `VITE_BULK_MAX_QUEUE` |
| API batch size | 50 | `BULK_BATCH_LIMIT` |
| General rate limit | 100/15m | `rateLimiter.js` |
| Auth rate limit | 20/15m | `rateLimiter.js` |
| Image proxy cap | 10 MB | `proxyRoutes.js` |
