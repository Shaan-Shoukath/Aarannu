# 04 — RLS and Security

## Defense in Depth

This project uses **two independent security layers**:

1. **Backend middleware** — Express-side checks (verifyToken, checkApproval, admin role check).
2. **Supabase RLS** — Postgres Row Level Security policies on every table.

Neither layer alone is sufficient. Together, they make exploitation exponentially harder.

---

## Why Both Layers?

| Attack Vector                            |        Backend catches it?         |                    RLS catches it?                    |
| ---------------------------------------- | :--------------------------------: | :---------------------------------------------------: |
| No auth token                            |       ✅ verifyToken rejects       |                 ✅ anon has no access                 |
| Forged/expired token                     | ✅ Supabase `getUser()` validates  |              ✅ RLS checks `auth.uid()`               |
| Accessing another user's data            | ✅ queries scoped by `req.user.id` |               ✅ `user_id = auth.uid()`               |
| Unapproved user tries to generate        |    ✅ checkApproval middleware     |         ✅ RLS can enforce `approved = true`          |
| Non-admin tries admin endpoint           | ✅ `requireAdmin()` checks DB role |              ✅ RLS can restrict writes               |
| Direct SQL injection via Supabase client |    N/A (parameterised queries)     |               ✅ RLS is always enforced               |
| Backend bug leaks service-role scope     |    ❌ service-role bypasses RLS    | ❌ (but limited blast radius due to separate clients) |

---

## RLS Policies (Supabase-side)

### `members` Table

```sql
-- Users can read their own member row
CREATE POLICY "Users can read own member"
  ON members FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own member row (sign-up)
CREATE POLICY "Users can insert own member"
  ON members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only service-role can update (approve).
-- No user-facing UPDATE policy needed.
```

### `generated_ids` Table

```sql
-- Users can read their own generated IDs
CREATE POLICY "Users can read own IDs"
  ON generated_ids FOR SELECT
  USING (user_id = auth.uid());

-- Insert is done via service-role (backend), so no user-facing INSERT policy.
-- Delete is also via service-role (cleanup).
```

### Storage (bucket: `id-cards`)

```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload own cards"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files (for signed URL verification)
CREATE POLICY "Users can read own cards"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## Backend Security Stack

```
helmet()              → X-Content-Type-Options, X-Frame-Options, HSTS, etc.
cors()                → Only whitelisted origins
express-rate-limit    → 100 req / 15 min per IP (20 for auth)
express.json({1mb})   → Body size cap prevents memory abuse
verifyToken           → JWT verified via Supabase Auth round-trip
checkApproval         → Business rule: approved members only
validators.js         → Input shape, length, format checks
errorHandler          → Stack traces hidden in production
```

---

## Key Principle

> **Never trust the client.**

Every piece of data arriving from the frontend is treated as potentially malicious. The backend re-validates everything, even if the frontend already validated it.
