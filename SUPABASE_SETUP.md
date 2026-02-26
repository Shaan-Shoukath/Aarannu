# Supabase Setup Guide for Community ID Platform

Complete setup guide for the Supabase backend services (Database, Auth, Storage, RLS).

---

## Table of Contents

1. [Create a Supabase Project](#1-create-a-supabase-project)
2. [Get Your API Keys](#2-get-your-api-keys)
3. [Database Schema](#3-database-schema)
4. [Row Level Security (RLS) Policies](#4-row-level-security-rls-policies)
5. [Storage Bucket Setup](#5-storage-bucket-setup)
6. [Authentication Setup](#6-authentication-setup)
7. [Bulk Generation Limits](#7-bulk-generation-limits)
8. [Running the Project](#8-running-the-project)
9. [Quick Checklist](#9-quick-checklist)
10. [First Admin User](#10-first-admin-user)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose your organization, set a project name (e.g. `community-id`), pick a strong database password, and select a region close to your users.
4. Wait for the project to be provisioned (~2 minutes).

---

## 2. Get Your API Keys

Go to **Project Settings → API** (sidebar → gear icon → API).

You need three values:

| Key                   | Where it goes                                                       | Notes                             |
| --------------------- | ------------------------------------------------------------------- | --------------------------------- |
| **Project URL**       | `VITE_SUPABASE_URL` (frontend) + `SUPABASE_URL` (backend)           | e.g. `https://abcdef.supabase.co` |
| **anon / public key** | `VITE_SUPABASE_ANON_KEY` (frontend) + `SUPABASE_ANON_KEY` (backend) | Safe for frontend — respects RLS  |
| **service_role key**  | `SUPABASE_SERVICE_ROLE_KEY` (backend **only**)                      | **NEVER** expose in frontend code |

### Set up `.env` files

**Frontend** (`frontend/.env`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_BACKEND_URL=http://localhost:5000
VITE_BULK_DAILY_LIMIT=200
VITE_BULK_MAX_QUEUE=500
```

**Backend** (`backend/.env`):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
BULK_BATCH_LIMIT=50
```

---

## 3. Database Schema

Go to **SQL Editor** in the Supabase dashboard and run these queries:

### 3a. Members Table

```sql
CREATE TABLE IF NOT EXISTS public.members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name       text NOT NULL,
  role       text DEFAULT 'Member',
  approved   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
```

### 3b. Generated IDs Table

```sql
CREATE TABLE IF NOT EXISTS public.generated_ids (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url   text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for filtering by user + expiry
CREATE INDEX IF NOT EXISTS idx_generated_ids_user ON public.generated_ids(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_ids_expiry ON public.generated_ids(expires_at);
```

---

## 4. Row Level Security (RLS) Policies

**Enable RLS on both tables** (critical for security):

```sql
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_ids ENABLE ROW LEVEL SECURITY;
```

### Members Policies

```sql
-- Users can read their own member profile
CREATE POLICY "Users can read own member"
  ON public.members FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own member profile (signup)
CREATE POLICY "Users can insert own member"
  ON public.members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own member profile
CREATE POLICY "Users can update own member"
  ON public.members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Generated IDs Policies

```sql
-- Users can read their own generated IDs
CREATE POLICY "Users can read own generated_ids"
  ON public.generated_ids FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own generated IDs
CREATE POLICY "Users can insert own generated_ids"
  ON public.generated_ids FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own generated IDs
CREATE POLICY "Users can delete own generated_ids"
  ON public.generated_ids FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 5. Storage Bucket Setup

### 5a. Create the Bucket

Go to **Storage** in the sidebar → **New Bucket**:

- **Name**: `id-cards`
- **Public**: **OFF** (private bucket)
- **File size limit**: `10MB`
- **Allowed MIME types**: `image/png, image/jpeg`

> **Important:** The `INSERT INTO storage.buckets` SQL command does NOT work from the SQL Editor.
> You **must** create the bucket through the dashboard UI as described above.

### 5b. Storage RLS Policies

These are **critical** — without them, uploads and downloads will fail:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read/download their own files
CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

> **Important**: The file path format is `{user_id}/{filename}.png`. The policies above check that the first folder in the path matches the authenticated user's ID.

---

## 6. Authentication Setup

Go to **Authentication → Providers** in the sidebar:

1. **Email** provider should already be enabled by default.
2. (Optional) Enable **Google**, **GitHub**, or other OAuth providers if desired.

### Email Confirmation (Optional but Recommended)

Go to **Authentication → Settings**:

- **Enable email confirmations**: ON for production, OFF for local dev (faster testing).
- **Site URL**: Set to your frontend URL (e.g. `http://localhost:5173` for dev, `https://yourdomain.com` for prod).
- **Redirect URLs**: Add your frontend URL.

---

## 7. Bulk Generation Limits

The app enforces limits at multiple layers:

| Limit                      | Default           | Config Variable               | Where              |
| -------------------------- | ----------------- | ----------------------------- | ------------------ |
| Daily uploads per user     | **200**           | `VITE_BULK_DAILY_LIMIT`       | Frontend `.env`    |
| Max queue size per session | **500**           | `VITE_BULK_MAX_QUEUE`         | Frontend `.env`    |
| API batch size             | **50**            | `BULK_BATCH_LIMIT`            | Backend `.env`     |
| API rate limit             | **100 req/15min** | Hardcoded in `rateLimiter.js` | Backend middleware |
| Auth rate limit            | **20 req/15min**  | Hardcoded in `rateLimiter.js` | Backend middleware |

To change limits, set the env vars in the respective `.env` files and restart.

---

## 8. Running the Project

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # then fill in real values
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:5000`.

---

## 9. Quick Checklist

- [ ] Supabase project created
- [ ] API keys copied to both `.env` files
- [ ] `members` table created with RLS enabled + policies
- [ ] `generated_ids` table created with RLS enabled + policies
- [ ] `id-cards` storage bucket created (private)
- [ ] Storage RLS policies created (upload/read/delete)
- [ ] Email auth provider enabled
- [ ] Backend running (`npm run dev`)
- [ ] Frontend running (`npm run dev`)
- [ ] First user signed up and approved via Supabase dashboard (set `approved = true` in members table)

---

## 10. First Admin User

After your first user signs up, promote them to admin by running this in the Supabase SQL Editor:

```sql
UPDATE public.members
SET approved = true
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

Replace `your-email@example.com` with the email you signed up with.

---

## 11. Troubleshooting

### Downloads not working / "Signed URL error"

**Cause**: Missing storage RLS policies on `storage.objects`.

**Fix**: Run all three storage policies from [Section 5b](#5b-storage-rls-policies). Without the `SELECT` policy, neither `download()` nor `createSignedUrl()` will work from the frontend.

**Verify** in Supabase SQL Editor:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

You should see three policies: INSERT, SELECT, DELETE for `id-cards`.

### Uploads fail with "new row violates row-level security policy"

**Cause**: Storage INSERT policy missing or file path doesn't match the user's ID folder.

**Fix**: Ensure the upload path follows the format `{user_id}/{filename}.png`. The storage policy checks that the first folder equals `auth.uid()::text`.

### "Account Pending Approval" after signup

**Expected**: New users must be approved by an admin. See [Section 10](#10-first-admin-user) to approve the first user via SQL.

### CORS errors when loading Google Drive photos

**Cause**: Google Drive blocks cross-origin requests. The app routes Drive images through `GET /api/proxy/image?url=...`.

**Fix**: Ensure the backend is running and `VITE_BACKEND_URL` in the frontend `.env` points to it (default: `http://localhost:5000`).

### "Missing Supabase environment variables" error on frontend

**Fix**: Create `frontend/.env` from `frontend/.env.example` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Restart the dev server after changes.

### Backend crashes on startup with "Missing environment variable"

**Fix**: Create `backend/.env` from `backend/.env.example`. All three Supabase keys are required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Rate limit hit (429 Too Many Requests)

The backend rate limits are 100 requests per 15 minutes (general) and 20 per 15 minutes (auth). Wait for the window to reset, or adjust the values in `backend/src/middleware/rateLimiter.js`.

### Daily bulk generation limit reached

The default is 200 cards per user per day. Change it by setting `VITE_BULK_DAILY_LIMIT` in `frontend/.env`:

```env
VITE_BULK_DAILY_LIMIT=500
```

### Cards not appearing on Dashboard

1. Check that the upload succeeded (look for errors in the browser console).
2. Verify the `generated_ids` table has rows with `expires_at > now()`.
3. Ensure the `file_url` path matches an actual file in the `id-cards` bucket.
4. Click the **Refresh** button on the Dashboard.

### Expired cards still showing (or not being cleaned up)

The backend auto-cleans every 6 hours. To trigger immediately:

- Restart the backend (cleanup runs on boot), or
- Call `POST /api/admin/cleanup` (requires admin auth).

---

## Complete SQL Setup Script

Setup requires **3 steps** (the storage bucket must be created via the dashboard UI):

### Step 1 — Run SQL: Tables + RLS Policies

Copy and run this in the Supabase **SQL Editor**:

```sql
-- ═══════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name       text NOT NULL,
  role       text DEFAULT 'Member',
  approved   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);

CREATE TABLE IF NOT EXISTS public.generated_ids (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url   text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_ids_user ON public.generated_ids(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_ids_expiry ON public.generated_ids(expires_at);

-- ═══════════════════════════════════════
-- ENABLE RLS
-- ═══════════════════════════════════════

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_ids ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- TABLE RLS POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Users can read own member"
  ON public.members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own member"
  ON public.members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own member"
  ON public.members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own generated_ids"
  ON public.generated_ids FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated_ids"
  ON public.generated_ids FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated_ids"
  ON public.generated_ids FOR DELETE
  USING (auth.uid() = user_id);
```

### Step 2 — Create Storage Bucket (Dashboard UI)

> **Note:** `INSERT INTO storage.buckets` does NOT work from the SQL Editor.
> You must create the bucket through the Supabase dashboard UI.

1. Go to **Storage** in the left sidebar
2. Click **New Bucket**
3. Set:
   - **Name**: `id-cards`
   - **Public bucket**: **OFF** (private)
   - **File size limit**: `10MB`
   - **Allowed MIME types**: `image/png, image/jpeg`
4. Click **Create bucket**

### Step 3 — Run SQL: Storage RLS Policies

After creating the bucket, go back to **SQL Editor** and run:

```sql
-- ═══════════════════════════════════════
-- STORAGE RLS POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```
