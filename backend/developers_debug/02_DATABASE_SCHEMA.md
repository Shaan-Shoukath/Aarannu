# 02 — Database Schema

All tables live in Supabase Postgres. The backend interacts with them via the `@supabase/supabase-js` client.

---

## Tables

### `members`

Stores one row per registered user. Created at sign-up.

```sql
CREATE TABLE IF NOT EXISTS members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'Member',
  approved    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT members_user_id_unique UNIQUE (user_id)
);

CREATE INDEX idx_members_user_id  ON members(user_id);
CREATE INDEX idx_members_approved ON members(approved);
```

| Column       | Type        | Notes                                                  |
| ------------ | ----------- | ------------------------------------------------------ |
| `id`         | UUID        | Auto-generated PK                                      |
| `user_id`    | UUID        | FK → `auth.users(id)`. One member per auth user.       |
| `name`       | TEXT        | Display name                                           |
| `role`       | TEXT        | "Member", "Admin", etc. Used for authorization checks. |
| `approved`   | BOOLEAN     | `false` on sign-up. Admin sets `true`.                 |
| `created_at` | TIMESTAMPTZ | Auto-set at insert                                     |

#### Why `user_id` is UNIQUE

One auth account = one membership. This prevents a single person from creating multiple member profiles.

#### Why index `approved`?

The admin "pending" endpoint queries `WHERE approved = false`. An index avoids a full table scan.

---

### `generated_ids`

Stores metadata for every generated ID card image.

```sql
CREATE TABLE IF NOT EXISTS generated_ids (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_ids_user_id    ON generated_ids(user_id);
CREATE INDEX idx_generated_ids_expires_at ON generated_ids(expires_at);
```

| Column       | Type        | Notes                                                                  |
| ------------ | ----------- | ---------------------------------------------------------------------- |
| `id`         | UUID        | Auto-generated PK                                                      |
| `user_id`    | UUID        | FK → `auth.users(id)`. Who generated this card.                        |
| `file_url`   | TEXT        | Path inside the `id-cards` storage bucket (e.g. `userId/name_ts.png`). |
| `expires_at` | TIMESTAMPTZ | `created_at + 15 days`. Records past this date are considered dead.    |
| `created_at` | TIMESTAMPTZ | Auto-set at insert                                                     |

#### Why index `expires_at`?

Every fetch filters `WHERE expires_at > NOW()`. The index allows Postgres to efficiently skip expired rows.

---

## Relationship Diagram

```
auth.users
    │
    ├── 1:1 ── members        (user_id FK, UNIQUE)
    │
    └── 1:N ── generated_ids   (user_id FK)
```

Both tables cascade-delete when the auth user is removed.
