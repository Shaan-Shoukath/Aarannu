# 02 – Database Schema

## Overview

The application uses two tables in Supabase (Postgres):

1. **`members`** — Stores user profile information and approval status.
2. **`generated_ids`** — Stores metadata for each generated ID card image.

Both tables reference `auth.users.id` to tie data to authenticated users.

---

## Table: `members`

```sql
CREATE TABLE public.members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'Member',
  approved   BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by user_id (used in every dashboard load)
CREATE INDEX idx_members_user_id ON public.members(user_id);
```

### Column Explanations

| Column       | Type        | Purpose                                                                                                           |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`         | UUID        | Primary key. Auto-generated. No sequential IDs to prevent enumeration.                                            |
| `user_id`    | UUID (FK)   | Links to `auth.users.id`. `ON DELETE CASCADE` ensures cleanup when a user is deleted from auth.                   |
| `name`       | TEXT        | Display name for the member. Trimmed on insert to prevent whitespace issues.                                      |
| `role`       | TEXT        | Free-text role/designation (e.g., "Developer", "Admin"). Defaults to "Member".                                    |
| `approved`   | BOOLEAN     | **Critical field.** Defaults to `false`. Only an admin can flip this to `true`. Controls access to ID generation. |
| `created_at` | TIMESTAMPTZ | Automatic timestamp. Useful for audit trails and sorting.                                                         |

### Why UUID for Primary Keys?

- Sequential integer IDs (1, 2, 3) are **predictable** and allow attackers to enumerate records.
- UUIDs are **random** and **globally unique**, making them safe for use in URLs and APIs.
- Supabase uses UUIDs natively for `auth.users.id`, so this keeps the schema consistent.

---

## Table: `generated_ids`

```sql
CREATE TABLE public.generated_ids (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for the most common query: user's non-expired IDs
CREATE INDEX idx_generated_ids_user_expire
  ON public.generated_ids(user_id, expires_at);
```

### Column Explanations

| Column       | Type        | Purpose                                                                                                                    |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`         | UUID        | Primary key. Auto-generated.                                                                                               |
| `user_id`    | UUID (FK)   | Links to the user who generated this ID card.                                                                              |
| `file_url`   | TEXT        | **Storage path** (not a full URL). Example: `user-uuid/John_Doe_1707984000000.png`. The signed URL is generated on-demand. |
| `expires_at` | TIMESTAMPTZ | Absolute expiry timestamp. Set to `now() + 15 days` on insert. Used to filter out expired records.                         |
| `created_at` | TIMESTAMPTZ | When the record was created.                                                                                               |

### Why `file_url` Stores a Path, Not a Full URL

- Full URLs include the Supabase project domain and can change if you migrate projects.
- Storing just the **relative path** makes the system portable.
- Signed URLs are generated on-demand with `supabase.storage.from('id-cards').createSignedUrl(path, expiry)`.

### Why `expires_at` is an Absolute Timestamp

- An absolute timestamp (`2026-03-02T00:00:00Z`) is unambiguous regardless of timezone.
- The query `WHERE expires_at > now()` is simple, indexable, and timezone-safe.
- Alternative: storing a `duration` and computing expiry at query time adds unnecessary complexity.

---

## Relationship Diagram

```
auth.users (Supabase-managed)
    │
    ├── 1:1 ──→ members
    │              (profile, approval status)
    │
    └── 1:N ──→ generated_ids
                   (each generated ID card)
```

### Why 1:1 for `members`?

- Each auth user has **exactly one** member profile.
- The `members` table extends `auth.users` with application-specific fields (name, role, approved).
- We don't store `name` in `auth.users.user_metadata` because:
  - `user_metadata` is client-writable (the user could change their own name to anything).
  - A dedicated table allows RLS policies to control who can modify what.

### Why 1:N for `generated_ids`?

- A user can generate **multiple** ID cards over time.
- Each generation creates a new record with its own expiry.
- Old expired records remain in the DB for audit purposes but are filtered out of the UI.

---

## Full Setup SQL

Run this in the Supabase SQL Editor to create both tables:

```sql
-- 1. Members table
CREATE TABLE IF NOT EXISTS public.members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'Member',
  approved   BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);

-- 2. Generated IDs table
CREATE TABLE IF NOT EXISTS public.generated_ids (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_ids_user_expire
  ON public.generated_ids(user_id, expires_at);
```
