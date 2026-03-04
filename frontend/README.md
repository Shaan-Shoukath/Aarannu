# Aarannu — Frontend

React 19 + Vite 7 + Tailwind CSS v4 SPA for the Aarannu Community Digital ID Platform.

---

## Quick Start

```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

### Environment Variables

| Variable                 | Default                 | Description                         |
| ------------------------ | ----------------------- | ----------------------------------- |
| `VITE_SUPABASE_URL`      | —                       | Supabase project URL (required)     |
| `VITE_SUPABASE_ANON_KEY` | —                       | Supabase anon/public key (required) |
| `VITE_BACKEND_URL`       | `http://localhost:5000` | Backend API URL (image proxy)       |
| `VITE_BULK_DAILY_LIMIT`  | `200`                   | Max card uploads per user per day   |
| `VITE_BULK_MAX_QUEUE`    | `500`                   | Max members in a generation queue   |

---

## Pages

| Route        | Component     | Description                                                            |
| ------------ | ------------- | ---------------------------------------------------------------------- |
| `/login`     | Login.jsx     | Email/password + Email OTP authentication                              |
| `/signup`    | Signup.jsx    | Registration with member profile fields                                |
| `/templates` | Templates.jsx | Choose template, set org name/logo, watermark config                   |
| `/generate`  | Generate.jsx  | Data entry, Sheets import, preview, PDF/JPEG download, bulk generation |
| `/dashboard` | Dashboard.jsx | View active IDs, signed-URL downloads, expiry countdown                |
| `/tokens`    | TokenDashboard.jsx | Token balance, 30-day usage sparkline, transaction history      |
| `/tokens/purchase` | TokenPurchase.jsx | Browse token packages, purchase tokens                    |

---

## Components

| Component            | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `IDCard.jsx`         | Custom/default template (geometric gradient design)      |
| `CorporateCard.jsx`  | Corporate Standard template (red + blue gradient)        |
| `EventCard.jsx`      | Event Access template (dark royal theme)                 |
| `StudentCard.jsx`    | Student ID template (modern academic)                    |
| `BulkGenerator.jsx`  | Batch generation: upload PNGs + build ZIP of 2-page PDFs |
| `ProtectedRoute.jsx` | Auth guard HOC — redirects to /login if unauthenticated  |

All card components use `forwardRef` and accept identical props: `data`, `showBack`, `orgName`, `logoUrl`, `customFields`, `watermark`.

---

## Utilities

### `utils/downloadHelpers.js`

| Function              | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `canvasesToPdfBlob()` | Creates 2-page PDF (front+back) from html2canvas     |
| `downloadBlob()`      | Triggers browser download for any Blob (safe revoke) |
| `canvasToJpegBlob()`  | Converts canvas to JPEG blob (quality: 0.95)         |
| `canvasToPngBlob()`   | Converts canvas to lossless PNG blob                 |
| `safeFileName()`      | Builds zero-padded safe filenames for ZIP entries    |

### `lib/proxyImage.js`

Rewrites Google Drive URLs to go through the backend proxy at `/api/proxy/image?url=...`, bypassing CORS for html2canvas rendering.

### `lib/supabaseClient.js`

Singleton Supabase client configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Persistence enabled (localStorage), auto-refresh, and session detection from URL.

---

## Delivery Formats

| Context         | Format                                  | How                                       |
| --------------- | --------------------------------------- | ----------------------------------------- |
| Single preview  | PDF (front+back) or JPEG (visible side) | jsPDF + html2canvas                       |
| Bulk generation | ZIP of 2-page PDFs + cloud PNGs         | JSZip + file-saver + Supabase             |
| Dashboard       | PNG download via signed URL             | createSignedUrl → fetch → blob → download |

---

## Download Flow (Dashboard)

The download uses a reliable blob-based approach to avoid CORS issues:

1. `createSignedUrl(path, 300, { download: filename })` — generates a signed URL with Content-Disposition header.
2. `fetch(signedUrl)` — downloads the file as a blob client-side.
3. `URL.createObjectURL(blob)` — creates a local object URL.
4. Temporary `<a>` element triggers the browser's native download.
5. Auto-revokes the object URL after 1 second.
6. Fallback: opens signed URL in a new tab if fetch fails.

---

## Bulk Generation Limits

| Limit                  | Default | Environment Variable    |
| ---------------------- | ------- | ----------------------- |
| Daily uploads per user | 200     | `VITE_BULK_DAILY_LIMIT` |
| Max queue size         | 500     | `VITE_BULK_MAX_QUEUE`   |

These are checked **before** generation starts. If the daily limit is partially consumed, only the remaining quota is processed. Queue size is validated upfront.

---

## Key Dependencies

| Library                 | Version | Purpose                     |
| ----------------------- | ------- | --------------------------- |
| `react`                 | ^19.2.0 | UI framework                |
| `react-router-dom`      | ^7.13.0 | Client-side routing         |
| `@supabase/supabase-js` | ^2.95.3 | Auth, DB, Storage SDK       |
| `html2canvas`           | ^1.4.1  | DOM → Canvas capture        |
| `jspdf`                 | ^4.1.0  | Canvas → PDF generation     |
| `jszip`                 | ^3.10.1 | ZIP archive creation        |
| `file-saver`            | ^2.0.5  | Cross-browser file download |
| `qrcode.react`          | ^4.2.0  | QR codes on ID cards        |
| `tailwindcss`           | ^4.1.18 | Utility-first CSS           |
| `vite`                  | ^7.3.1  | Build tool + dev server     |

---

## Developer Debug Docs

See [`developers_debug/`](developers_debug/README.md) for 10+ detailed architecture documents covering system design, database schema, RLS policies, auth flow, storage/download flow, expiry logic, library deep-dives, and production hardening.

---

## Build

```bash
npm run build        # Output: dist/
npm run preview      # Preview production build locally
```
