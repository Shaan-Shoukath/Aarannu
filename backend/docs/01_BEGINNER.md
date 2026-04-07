# Level 1 — Beginner: What Is This and How Do I Run It?

This guide assumes you have never worked with Node.js backends or Supabase before.
Read this first before anything else.

---

## What Does This App Do?

**Aarannu** lets organizations create, manage, and distribute digital ID cards.

Think of it like this:
1. A school creates an account and a project called "Students 2026"
2. Students fill out a public registration form (name, photo, class)
3. The admin approves submissions and bulk-generates ID cards as PNGs/PDFs
4. Students can verify their card by scanning its QR code

---

## The Two Halves

```
┌─────────────────────┐      HTTP      ┌──────────────────────┐
│   FRONTEND          │ ─────────────► │   BACKEND            │
│   React 19          │ ◄───────────── │   Express 5          │
│   Vite + Tailwind   │                │   Node.js            │
│   localhost:5173    │                │   localhost:5000      │
└─────────────────────┘                └──────────────────────┘
          │                                       │
          └──────────────────┬────────────────────┘
                             │
                    ┌────────▼────────┐
                    │    SUPABASE     │
                    │   (cloud DB)    │
                    │   Auth + RLS    │
                    │   Storage       │
                    └─────────────────┘
```

- **Frontend** — What the user sees. Built with React.
- **Backend** — The server that the frontend talks to. Built with Express.
- **Supabase** — The database in the cloud. Think of it as "Firebase but SQL."

---

## Before You Start — What You Need

1. **Node.js** v18 or higher — download at nodejs.org
2. **A Supabase account** — free at supabase.com
3. **Git** — to clone this repo

Check you have Node:
```bash
node --version   # should print v18.x.x or higher
npm --version    # should print 9.x.x or higher
```

---

## Step 1 — Set Up Supabase

### 1a. Create a project
1. Go to supabase.com → New Project
2. Pick a name (e.g. "aarannu-dev"), set a strong DB password, pick a region

### 1b. Get your keys
Go to: Project Settings → API (gear icon in sidebar)

You need these three values:

| What              | Where it goes                     |
|-------------------|-----------------------------------|
| Project URL       | `SUPABASE_URL` and `VITE_SUPABASE_URL` |
| anon/public key   | `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` |
| service_role key  | `SUPABASE_SERVICE_ROLE_KEY` (backend ONLY) |

### 1c. Run the database setup
1. In Supabase → SQL Editor
2. Open `backend/migrations/000_full_setup.sql`
3. Copy the entire file → paste → click Run
4. You should see "Success. No rows returned."

### 1d. Create the storage bucket (UI only)
1. Go to Supabase → Storage → New Bucket
2. Name: `id-cards`
3. Public: OFF (keep it private)
4. File size limit: 10MB
5. Allowed MIME: `image/png, image/jpeg`
6. Click Create

### 1e. Fix the OTP email template (important!)
Without this, the verification email only shows a link — not the 6-digit code.

1. Supabase → Authentication → Email Templates → "Magic Link"
2. Replace the body with:
```html
<h2>Your verification code</h2>
<p>Enter this code in the app:</p>
<h1 style="letter-spacing:8px;font-size:36px;">{{ .Token }}</h1>
<p>Or click this link (only works if the app is running):</p>
<p><a href="{{ .ConfirmationURL }}">Log in directly</a></p>
```
3. Save

### 1f. Configure the Site URL
Supabase → Authentication → URL Configuration:
- **Site URL**: `http://localhost:5173`
- **Redirect URLs**: add `http://localhost:5173/**`

---

## Step 2 — Set Up the Backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

Install dependencies and start:
```bash
npm install
npm run dev
```

You should see:
```
╔══════════════════════════════════════════════════════════════╗
║  Community ID Backend — Running                              ║
║  Port : 5000                                                 ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Step 3 — Set Up the Frontend

```bash
cd frontend
cp .env.example .env
```

Open `frontend/.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
VITE_API_URL=http://localhost:5000
VITE_BULK_DAILY_LIMIT=200
VITE_BULK_MAX_QUEUE=500
```

Start the frontend:
```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Step 4 — Create Your First Account

1. Go to http://localhost:5173/signup
2. Fill in name, email, password
3. An email with a 6-digit code will be sent → enter it
4. You're in! Your account is auto-approved on first signup.

---

## What Just Happened? (signup flow, plain English)

```
You filled the form
       ↓
Supabase created your account (auth.users table)
       ↓
An email with a 6-digit code was sent
       ↓
You entered the code → Supabase confirmed your email
       ↓
The frontend inserted a row into the members table
  (name, role, approved = true)
       ↓
50 free tokens were added to your wallet
       ↓
You were redirected to /dashboard
```

---

## Common Beginner Mistakes

| Problem | Fix |
|---------|-----|
| "Missing environment variable" on backend start | Fill in all values in `backend/.env` |
| Email shows only a link, no 6-digit code | Fix the email template (Step 1e above) |
| Can't log in — "Account Pending Approval" | Your members row has `approved = false`. Run the SQL in the next section. |
| CORS error in browser console | Make sure `CORS_ORIGIN` in `backend/.env` matches your frontend URL |
| Storage uploads fail | Create the `id-cards` bucket in Supabase Storage UI |

### Manually approve yourself (if stuck):
```sql
-- In Supabase SQL Editor
UPDATE public.members
SET approved = true
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your@email.com'
);
```

---

## Key Files to Know

| File | What it does |
|------|-------------|
| `backend/src/server.js` | Entry point — starts the Express server |
| `backend/.env` | Your secret keys — never commit this |
| `frontend/src/pages/Login.jsx` | Login page |
| `frontend/src/pages/Signup.jsx` | Signup page |
| `frontend/src/lib/supabaseClient.js` | Creates the Supabase connection |
| `backend/migrations/000_full_setup.sql` | Creates all database tables |

---

## Next Step

Once everything works, read **02_INTERMEDIATE.md** to understand how the backend
routes, middleware, and services are structured.
