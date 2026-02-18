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

| Variable                 | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL                               |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key                           |
| `VITE_BACKEND_URL`       | Backend API URL (default: `http://localhost:5000`) |

---

## Pages

| Route        | Component     | Description                                                            |
| ------------ | ------------- | ---------------------------------------------------------------------- |
| `/login`     | Login.jsx     | Email/password + Email OTP authentication                              |
| `/signup`    | Signup.jsx    | Registration with member profile fields                                |
| `/templates` | Templates.jsx | Choose template, set org name/logo, watermark config                   |
| `/generate`  | Generate.jsx  | Data entry, Sheets import, preview, PDF/JPEG download, bulk generation |
| `/dashboard` | Dashboard.jsx | View active IDs, signed-URL downloads, expiry status                   |

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

All card components use `forwardRef` and accept identical props: `name`, `role`, `memberId`, `photoUrl`, `showBack`, `orgName`, `logoUrl`, `customFields`, `watermark`.

---

## Utilities

### `utils/downloadHelpers.js`

| Function              | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `canvasesToPdfBlob()` | Creates 2-page PDF (front+back) from html2canvas  |
| `downloadBlob()`      | Triggers browser download for any Blob            |
| `canvasToJpegBlob()`  | Converts canvas to JPEG blob (quality: 0.95)      |
| `canvasToPngBlob()`   | Converts canvas to lossless PNG blob              |
| `safeFileName()`      | Builds zero-padded safe filenames for ZIP entries |

### `lib/proxyImage.js`

Rewrites Google Drive URLs to go through the backend proxy at `/api/proxy/image?url=...`, bypassing CORS for html2canvas rendering.

### `lib/supabaseClient.js`

Singleton Supabase client configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## Delivery Formats

| Context         | Format                                  | How                           |
| --------------- | --------------------------------------- | ----------------------------- |
| Single preview  | PDF (front+back) or JPEG (visible side) | jsPDF + html2canvas           |
| Bulk generation | ZIP of 2-page PDFs + cloud PNGs         | JSZip + file-saver + Supabase |
| Dashboard       | PNG (signed URL, 1hr expiry)            | Supabase Storage              |

---

## Key Dependencies

| Library        | Purpose                     |
| -------------- | --------------------------- |
| `html2canvas`  | DOM → Canvas capture        |
| `jspdf`        | Canvas → PDF generation     |
| `jszip`        | ZIP archive creation        |
| `file-saver`   | Cross-browser file download |
| `qrcode.react` | QR codes on ID cards        |

---

## Developer Debug Docs

See [`developers_debug/`](developers_debug/README.md) for 8 detailed architecture documents covering system design, database schema, RLS policies, auth flow, storage/download flow, expiry logic, library deep-dives, and production hardening.

---

## Build

```bash
npm run build        # Output: dist/
npm run preview      # Preview production build locally
```
