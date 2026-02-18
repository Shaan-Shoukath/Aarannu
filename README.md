# Aarannu — Community Digital ID Platform

A production-grade web application for generating, managing, and distributing digital identity cards within a community or organisation. Supports multiple card templates, custom fields, watermarks, QR codes, Google Sheets import, and bulk PDF/ZIP delivery.

---

## Features

- **4 ID card templates** — Custom (geometric), Corporate (red/blue gradient), Event (dark royal), Student (modern academic)
- **Organization config** — Custom org name, logo URL, watermark (text and/or image with opacity)
- **Custom fields** — Define extra fields (front or back) at runtime; auto-populated from Google Sheets
- **QR codes** — Each card gets a verification QR code embedded via `qrcode.react`
- **Google Sheets import** — Paste a public Sheets URL to bulk-import member data
- **Google Drive photos** — Member photos from Drive are proxied through the backend (CORS bypass)
- **Single card download** — PDF (2-page front+back) or JPEG from the live preview
- **Bulk generation** — PNGs uploaded to Supabase Storage + all cards bundled as a ZIP of 2-page PDFs
- **Dashboard** — View active IDs, download via signed URLs, track expiry status
- **Auth** — Email/password + Email OTP login
- **Approval gating** — Admin must approve members before they can generate cards
- **15-day expiry** — Generated IDs expire automatically; daily limit of 200 cards per user

---

## Project Structure

```
community-id/
├── frontend/          # React 19 + Vite 7 + Tailwind CSS v4
│   ├── src/
│   │   ├── components/    # IDCard, CorporateCard, EventCard, StudentCard, BulkGenerator
│   │   ├── pages/         # Login, Signup, Dashboard, Templates, Generate
│   │   ├── lib/           # supabaseClient, proxyImage
│   │   └── utils/         # downloadHelpers (PDF/ZIP/JPEG conversion)
│   ├── public/
│   ├── developers_debug/  # 8 architecture docs
│   └── package.json
├── backend/           # Express 5 + Supabase API + Image Proxy
│   ├── src/
│   │   ├── routes/        # auth, id, admin, proxy (Google Drive images)
│   │   ├── controllers/
│   │   ├── services/
│   │   └── middleware/
│   ├── developers_debug/  # 8 architecture docs
│   └── package.json
└── README.md
```

---

## Quick Start

```bash
# 1 — Clone
git clone <repo-url> community-id
cd community-id

# 2 — Install frontend
cd frontend
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL

# 3 — Install backend
cd ../backend
npm install
cp .env.example .env   # fill in Supabase keys + PORT

# 4 — Database & storage setup
# Run the SQL from frontend/developers_debug/02_DATABASE_SCHEMA.md
# Apply RLS policies from frontend/developers_debug/03_RLS_POLICIES.md
# Create private storage bucket "id-cards" in Supabase dashboard

# 5 — Start both
cd ../frontend && npm run dev     # http://localhost:5173
cd ../backend  && npm run dev     # http://localhost:5000
```

---

## Tech Stack

| Layer              | Technology                                       |
| ------------------ | ------------------------------------------------ |
| Frontend           | React 19, Vite 7, Tailwind CSS v4                |
| Backend API        | Express 5, Node.js, Supabase Admin SDK           |
| Database           | Supabase Postgres + RLS                          |
| Storage            | Supabase Storage (private, signed URLs)          |
| Card Rendering     | html2canvas (2× scale capture)                   |
| PDF Generation     | jsPDF (2-page front+back per card)               |
| ZIP Bundling       | JSZip + file-saver (bulk delivery)               |
| QR Codes           | qrcode.react (canvas-based)                      |
| Image Proxy        | Express route (Google Drive CORS bypass)         |
| Routing            | react-router-dom v7                              |

---

## Delivery Formats

| Context         | Format                                  | Mechanism                       |
| --------------- | --------------------------------------- | ------------------------------- |
| Single preview  | PDF (front+back) or JPEG (visible side) | jsPDF + html2canvas             |
| Bulk generation | ZIP of 2-page PDFs                      | JSZip + file-saver (auto-download) |
| Dashboard       | PNG (signed URL, 1hr expiry)            | Supabase Storage                |

---

## Documentation

- Frontend internals: [`frontend/developers_debug/`](frontend/developers_debug/README.md)
- Backend internals: [`backend/developers_debug/`](backend/developers_debug/README.md)

---

## License

MIT
