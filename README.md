# Community Digital ID Platform

A production-grade web application for generating, managing, and distributing digital identity cards within a community or organisation.

---

## Project Structure

```
community-id/
├── frontend/          # React 19 + Vite 7 + Tailwind CSS v4
│   ├── src/
│   ├── public/
│   ├── developers_debug/
│   ├── package.json
│   └── vite.config.js
├── backend/           # Express 5 + Supabase API
│   ├── src/
│   ├── developers_debug/
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
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

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

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Frontend       | React 19, Vite 7, Tailwind CSS v4       |
| Backend API    | Express 5, Node.js, Supabase Admin SDK  |
| Database       | Supabase Postgres + RLS                 |
| Storage        | Supabase Storage (private, signed URLs) |
| Card Rendering | html2canvas (2× scale capture)          |
| Routing        | react-router-dom v7                     |

---

## Documentation

- Frontend internals: [`frontend/developers_debug/`](frontend/developers_debug/README.md)
- Backend internals: [`backend/developers_debug/`](backend/developers_debug/README.md)

---

## License

MIT
