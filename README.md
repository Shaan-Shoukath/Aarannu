# Community Digital ID Platform

A production-grade web application for generating, managing, and distributing digital identity cards within a community or organisation.

Built with **React 19 + Vite 7**, **Supabase** (Auth, Postgres, Storage), **Tailwind CSS v4**, and **html2canvas**.

---

## Features

| Area                 | Details                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Auth**             | Email/password sign-up & login via Supabase Auth                                    |
| **Approval Gate**    | New users land with `approved = false`; admin flips to `true` in Supabase dashboard |
| **ID Card Designer** | Geometric gradient card with photo, name, role, DOB, gender, ID number, address     |
| **Bulk Generation**  | Queue multiple members → batch-render PNGs at 2× resolution                         |
| **Secure Storage**   | Private Supabase Storage bucket; signed URLs with 1-hour TTL                        |
| **Auto Expiry**      | Each card expires 15 days after generation                                          |

---

## Quick Start

```bash
# 1 — Clone & install
git clone <repo-url> community-id
cd community-id
npm install

# 2 — Environment variables
cp .env.example .env
# Fill in your Supabase project URL and anon key

# 3 — Database setup
# Run the SQL from developers_debug/02_DATABASE_SCHEMA.md
# Then apply RLS policies from developers_debug/03_RLS_POLICIES.md

# 4 — Create storage bucket
# In Supabase dashboard → Storage → New bucket "id-cards" (private)

# 5 — Start dev server
npm run dev
```

---

## Project Structure

```
community-id/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── IDCard.jsx          # Visual card renderer (forwardRef)
│   │   ├── BulkGenerator.jsx   # Batch capture + upload engine
│   │   └── ProtectedRoute.jsx  # Auth guard
│   ├── lib/
│   │   └── supabaseClient.js   # Singleton Supabase client
│   ├── pages/
│   │   ├── Login.jsx           # Split-screen auth page
│   │   ├── Signup.jsx          # Registration + member insert
│   │   ├── Dashboard.jsx       # Profile, stats, ID list
│   │   └── Generate.jsx        # Data entry + preview + queue
│   ├── App.jsx                 # React Router config
│   ├── index.css               # Tailwind + global styles
│   └── main.jsx                # Entry point
├── developers_debug/           # 8 internal documentation files
├── .env.example
├── vite.config.js
└── package.json
```

---

## Tech Stack

| Layer          | Technology                         |
| -------------- | ---------------------------------- |
| Frontend       | React 19, Vite 7, Tailwind CSS v4  |
| Backend        | Supabase (Auth, Postgres, Storage) |
| Card Rendering | html2canvas (2× scale capture)     |
| Routing        | react-router-dom v7                |

---

## Security Notes

- **Row Level Security (RLS)** on every table — users can only read/write their own data
- **Private storage bucket** — no public URLs; all access via signed URLs (1 hr TTL)
- **Approval gating** — unapproved users cannot generate cards
- **Vague auth errors** — login never reveals whether email exists
- **Environment variables** — secrets stored in `.env`, never committed

See [`developers_debug/`](developers_debug/README.md) for full internal docs.

---

## License

MIT
