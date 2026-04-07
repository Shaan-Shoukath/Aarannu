# Level 11 — PostgreSQL and Supabase: The Database Layer

From what a database actually is to writing production-quality queries in this project.

---

## Part A — What a Relational Database Is

A database is not just a place to store data. It is a system that:

1. **Persists** data (survives server restarts — unlike JavaScript variables or files)
2. **Queries** data efficiently (find a member by email across 1 million rows in milliseconds)
3. **Enforces structure** (the database rejects data that doesn't match the schema)
4. **Guarantees consistency** (transactions — either all changes succeed or none do)
5. **Controls access** (who can read, write, or delete what)

A **relational** database organises data into **tables** (like spreadsheets), and tables can **relate** to each other.

### Tables, rows, and columns

```
Table: project_members
┌──────────────┬──────────────┬──────────────────────┬──────────┬────────────────────────────┐
│ id (UUID)    │ name (TEXT)  │ email (TEXT)          │ status   │ custom_fields (JSONB)       │
├──────────────┼──────────────┼──────────────────────┼──────────┼────────────────────────────┤
│ 550e8400...  │ Ali Hassan   │ ali@example.com       │ approved │ {"department": "CS"}        │
│ 660f9500...  │ Priya Nair   │ priya@test.com        │ pending  │ {"department": "Math"}      │
└──────────────┴──────────────┴──────────────────────┴──────────┴────────────────────────────┘
    ↑ column        ↑ column         ↑ column           ↑ column    ↑ column
← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  row  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ →
```

- **Column**: a named field with a fixed data type
- **Row**: one record (one member in this case)
- **Table**: a collection of rows with the same columns

### PostgreSQL vs MySQL vs SQLite

All are relational databases. Key differences:

| | PostgreSQL | MySQL | SQLite |
|---|---|---|---|
| Type | Full server | Full server | File-based (no server) |
| Best for | Complex apps, production | Web apps (LAMP stack) | Development, simple apps |
| Notable features | JSONB, arrays, full-text search, RLS | Wide hosting support | Zero setup, single file |
| Used in this project? | ✅ (via Supabase) | ❌ | ❌ |

PostgreSQL ("Postgres") is the most feature-rich open-source relational DB. Supabase hosts a managed PostgreSQL instance for you.

---

## Part B — SQL: The Language of Databases

SQL (Structured Query Language) is how you communicate with any relational database. PostgreSQL uses standard SQL with some powerful extensions.

### The 4 core operations (CRUD)

**Create → INSERT**
```sql
-- Add a new member
INSERT INTO project_members (id, project_id, name, email, status)
VALUES (
  gen_random_uuid(),        -- auto-generate UUID
  'project-uuid-here',
  'Ali Hassan',
  'ali@example.com',
  'pending'
);
```

**Read → SELECT**
```sql
-- Get all approved members for a project
SELECT id, name, email, created_at
FROM project_members
WHERE project_id = 'project-uuid-here'
  AND status = 'approved'
ORDER BY created_at DESC
LIMIT 50;              -- max 50 rows (pagination)
```

**Update → UPDATE**
```sql
-- Approve a member
UPDATE project_members
SET status = 'approved'
WHERE id = 'member-uuid-here'
RETURNING *;           -- return the updated row (PostgreSQL extension)
```

**Delete → DELETE**
```sql
-- Delete a member
DELETE FROM project_members
WHERE id = 'member-uuid-here'
RETURNING id;          -- confirm which row was deleted
```

### WHERE: filtering rows

```sql
-- Single condition
WHERE status = 'approved'

-- Multiple conditions (AND)
WHERE status = 'approved' AND project_id = 'abc'

-- OR
WHERE status = 'pending' OR status = 'approved'

-- NOT
WHERE status != 'rejected'

-- NULL check (never use = NULL — always IS NULL or IS NOT NULL)
WHERE email IS NOT NULL
WHERE delivery_error IS NULL

-- Pattern matching (LIKE)
WHERE email LIKE '%@gmail.com'   -- ends with @gmail.com
WHERE name ILIKE 'ali%'          -- starts with 'ali', case-insensitive

-- IN list
WHERE status IN ('pending', 'approved')

-- Range
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'
-- or equivalently:
WHERE created_at BETWEEN '2026-01-01' AND '2026-12-31'
```

### ORDER BY and LIMIT: sorting and pagination

```sql
-- Newest first
ORDER BY created_at DESC

-- Alphabetical
ORDER BY name ASC

-- Multiple sort keys: by status, then by name within status
ORDER BY status, name

-- Pagination: page 2 of 20 rows per page
ORDER BY created_at DESC
LIMIT 20
OFFSET 20    -- skip the first 20 (page 1)
```

**Warning about OFFSET at scale:** `OFFSET 10000` makes PostgreSQL scan and discard 10,000 rows before returning your 20. Slow. Use cursor-based pagination for large datasets (see `05_ENGINEERING_PATTERNS.md`).

### JOINs: combining tables

Tables relate to each other through shared IDs. JOINs combine rows from multiple tables.

```sql
-- Get generated cards WITH the member's name and email
-- (generated_cards table has member_id, but no name/email — those are in project_members)

SELECT
  gc.id        AS card_id,
  gc.status    AS card_status,
  gc.expires_at,
  pm.name      AS member_name,
  pm.email     AS member_email
FROM generated_cards gc
JOIN project_members pm ON gc.member_id = pm.id
WHERE gc.project_id = 'project-uuid'
ORDER BY gc.created_at DESC;
```

**JOIN types:**

```sql
-- INNER JOIN (most common): only rows that match in BOTH tables
FROM table_a a
JOIN table_b b ON a.id = b.a_id

-- LEFT JOIN: all rows from table_a + matching rows from table_b (NULL if no match)
FROM project_members pm
LEFT JOIN generated_cards gc ON pm.id = gc.member_id
-- Returns all members, even those without a card (gc columns will be NULL)

-- Use LEFT JOIN when: "give me all members and, if they have a card, show it"
-- Use INNER JOIN when: "only show me members who have a card"
```

### Aggregations: counting and summarising

```sql
-- Count members by status
SELECT status, COUNT(*) AS count
FROM project_members
WHERE project_id = 'project-uuid'
GROUP BY status;
-- Result:
-- pending  | 12
-- approved | 47
-- rejected |  3

-- Average token usage last 30 days
SELECT
  AVG(ABS(amount)) AS avg_daily_usage,
  SUM(ABS(amount)) AS total_usage
FROM token_transactions
WHERE user_id = 'user-uuid'
  AND type = 'usage'
  AND created_at >= NOW() - INTERVAL '30 days';
```

---

## Part C — PostgreSQL Data Types

Choosing the right type matters for storage efficiency, query performance, and data integrity.

### Types used in this project

| Type | What it stores | Example |
|---|---|---|
| `UUID` | 128-bit unique identifier | `550e8400-e29b-41d4-a716-446655440000` |
| `TEXT` | Variable-length string (no limit) | `'Ali Hassan'` |
| `INT` / `INTEGER` | Whole number (-2B to +2B) | `47` |
| `BOOLEAN` | True or false | `true`, `false` |
| `TIMESTAMPTZ` | Date + time with timezone | `2026-04-07T10:30:00+05:30` |
| `JSONB` | JSON stored as binary (queryable!) | `{"department": "CS", "year": 3}` |
| `uuid[]` | Array of UUIDs | `{uuid1, uuid2, uuid3}` |

### UUID as primary key

```sql
-- Auto-generate a UUID on insert:
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supabase uses gen_random_uuid() (PostgreSQL built-in)
-- Your code uses the uuid npm package to generate UUIDs before inserting
```

**Why UUID instead of auto-increment integer?**
- Sequential integers are guessable (attackers can iterate: `/api/members/1`, `/api/members/2`)
- UUIDs can be generated client-side without a DB round-trip
- Merging data from multiple sources has no ID collisions

### JSONB: the flexible column

`JSONB` stores JSON and allows querying individual keys:

```sql
-- Store:
INSERT INTO project_members (id, name, custom_fields)
VALUES (gen_random_uuid(), 'Ali Hassan', '{"department": "CS", "year": 3}');

-- Query by JSON field:
SELECT name
FROM project_members
WHERE custom_fields->>'department' = 'CS';
--           ↑
-- ->> extracts a key as TEXT
-- -> extracts a key as JSON (for nested objects)

-- Check if key exists:
WHERE custom_fields ? 'department'

-- Index a JSONB field for performance:
CREATE INDEX idx_members_department ON project_members ((custom_fields->>'department'));
```

This project stores per-member custom data (form fields) in `custom_fields JSONB` because different projects have different fields — you can't predict the column names at schema design time.

### TIMESTAMPTZ: always use timezone-aware timestamps

```sql
-- BAD: TIMESTAMP (no timezone)
-- Stores "2026-04-07 10:30:00" — is this UTC? IST? No way to know.

-- GOOD: TIMESTAMPTZ (with timezone)
-- Stores "2026-04-07 05:00:00+00" — always UTC internally, displayed in local TZ

-- Common operations:
WHERE created_at >= NOW()                        -- today onwards
WHERE created_at >= NOW() - INTERVAL '7 days'   -- last 7 days
WHERE expires_at < NOW()                         -- already expired

-- Cast to date:
WHERE DATE(created_at) = '2026-04-07'
```

---

## Part D — Constraints: Enforcing Data Rules

Constraints prevent bad data from entering the database. They are your last line of defence after application validation.

### Common constraints

```sql
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- PRIMARY KEY: must be unique, cannot be NULL, indexed automatically

  org_id      UUID NOT NULL,
  -- NOT NULL: this field must always have a value

  slug        TEXT UNIQUE NOT NULL,
  -- UNIQUE: no two rows can have the same slug value

  type        TEXT NOT NULL CHECK (type IN ('membership', 'event', 'student', 'corporate')),
  -- CHECK: value must be one of these options (poor man's enum)

  member_limit INT CHECK (member_limit > 0),
  -- CHECK: must be positive if provided (NULLs are allowed — no NOT NULL here)

  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
  -- FOREIGN KEY: org_id must exist in organizations.id
  -- ON DELETE CASCADE: if the org is deleted, all its projects are deleted too
);
```

### What happens when a constraint fails

```sql
-- Insert with duplicate slug:
INSERT INTO projects (slug, ...) VALUES ('aarannu-tech', ...);
-- → ERROR: duplicate key value violates unique constraint "projects_slug_key"

-- Insert with invalid type:
INSERT INTO projects (type, ...) VALUES ('university', ...);
-- → ERROR: new row violates check constraint "projects_type_check"
```

The database throws an error — the insert is rolled back. In Supabase's SDK:
```js
const { data, error } = await supabase.from('projects').insert({ ... });
if (error) {
  // error.code = '23505' for unique violation
  // error.code = '23514' for check constraint violation
  console.error(error.message);
}
```

---

## Part E — Indexes: Making Queries Fast

By default, finding a row requires scanning every row in the table. For 1,000,000 rows, that's slow.

An **index** is a separate data structure (usually a B-tree) that lets the database jump directly to matching rows, like a book's index vs reading every page.

```sql
-- Without index: PostgreSQL scans all 1M rows
SELECT * FROM project_members WHERE email = 'ali@example.com';
-- With index: PostgreSQL jumps to O(log n) matching rows

-- Create an index:
CREATE INDEX idx_members_email ON project_members (email);
CREATE INDEX idx_members_project_status ON project_members (project_id, status);
--                                                           ↑ compound index
--                                     covers queries like: WHERE project_id = ? AND status = ?
```

### When to add an index

```sql
-- Check how slow a query is (EXPLAIN ANALYZE):
EXPLAIN ANALYZE
SELECT * FROM project_members WHERE project_id = 'abc' AND status = 'approved';

-- If you see "Seq Scan" (sequential scan), you need an index
-- If you see "Index Scan", it's already using one
```

**Rules of thumb:**
- Index foreign key columns (`project_id`, `org_id`, `user_id`)
- Index columns used in frequent WHERE or ORDER BY clauses
- Don't index columns that are updated very frequently (indexes slow down writes)
- Don't over-index — each index adds overhead to INSERTs/UPDATEs

### Indexes in this project

The migration SQL should include:
```sql
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_status ON project_members(status);
CREATE INDEX IF NOT EXISTS idx_generated_cards_member_id ON generated_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id, created_at DESC);
```

---

## Part F — Transactions: All or Nothing

A **transaction** groups multiple SQL operations into one atomic unit. Either all succeed, or none do.

### Why you need them

```sql
-- Scenario: Deduct 10 tokens AND log the transaction
-- Without a transaction:
UPDATE token_wallets SET balance = balance - 10 WHERE id = 'wallet-id';
-- [server crashes here]
INSERT INTO token_transactions (...) VALUES (...);
-- The deduction happened but the log wasn't written. Financial inconsistency.

-- With a transaction:
BEGIN;

UPDATE token_wallets SET balance = balance - 10 WHERE id = 'wallet-id';
INSERT INTO token_transactions (...) VALUES (...);

COMMIT;   -- only if both succeed
-- If anything fails, everything is rolled back automatically
```

### In Supabase SDK

The Supabase JavaScript client doesn't expose raw transactions directly. Instead:

1. **Use PostgreSQL functions (RPC)** for multi-step atomic operations:

```sql
-- Create a function in Supabase SQL Editor:
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_wallet_id UUID,
  p_amount INT,
  p_description TEXT
) RETURNS VOID AS $$
BEGIN
  -- Atomic deduction: only updates if balance >= amount
  UPDATE token_wallets
  SET balance = balance - p_amount
  WHERE id = p_wallet_id AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  -- Log the transaction in the same atomic operation
  INSERT INTO token_transactions (wallet_id, amount, description)
  VALUES (p_wallet_id, -p_amount, p_description);
END;
$$ LANGUAGE plpgsql;
```

```js
// Call it from Node.js:
const { data, error } = await supabase.rpc('deduct_tokens', {
  p_wallet_id: walletId,
  p_amount: 10,
  p_description: 'Card generation',
});
```

2. **Use the atomic guard pattern** (this project's approach for token deduction):

```sql
-- Single UPDATE with WHERE guard — if balance < amount, zero rows updated
UPDATE token_wallets
SET balance = balance - $1
WHERE id = $2
  AND balance >= $1   -- ← atomic guard: only happens if enough balance
RETURNING *;

-- If RETURNING returns no rows → insufficient balance
-- No partial state possible
```

---

## Part G — What Supabase Is

Supabase is a hosted platform that provides:

```
┌──────────────────────────────────────────────────────┐
│  SUPABASE                                            │
│                                                      │
│  ┌────────────────┐    ← Managed PostgreSQL          │
│  │   Database     │      Your tables, your SQL       │
│  └────────────────┘                                  │
│                                                      │
│  ┌────────────────┐    ← Auto-generated REST API     │
│  │   PostgREST    │      For your tables              │
│  └────────────────┘                                  │
│                                                      │
│  ┌────────────────┐    ← Auth server (GoTrue)        │
│  │   Auth         │      JWTs, OTP, sessions         │
│  └────────────────┘                                  │
│                                                      │
│  ┌────────────────┐    ← S3-compatible storage       │
│  │   Storage      │      Files, images, buckets      │
│  └────────────────┘                                  │
│                                                      │
│  ┌────────────────┐    ← Multiplexed WebSockets      │
│  │   Realtime     │      Listen to DB changes        │
│  └────────────────┘                                  │
└──────────────────────────────────────────────────────┘
```

**Supabase is not a database.** It is a platform that hosts PostgreSQL and wraps it in useful services. You can always connect to the underlying PostgreSQL directly (Supabase gives you a connection string).

### PostgREST: the auto-generated API

PostgREST reads your PostgreSQL schema and generates a REST API automatically. Every table becomes an endpoint.

When you call the Supabase SDK:
```js
supabase.from('project_members').select('*').eq('status', 'approved')
```

The SDK sends:
```
GET /rest/v1/project_members?status=eq.approved&select=*
Header: apikey: <anon-key>
Header: Authorization: Bearer <jwt>
```

PostgREST converts this to SQL:
```sql
SELECT * FROM project_members
WHERE status = 'approved'
  -- AND standard RLS policies apply based on auth.uid() from the JWT
```

### The two clients and when to use each

```js
// config/supabaseClient.js

const { createClient } = require('@supabase/supabase-js');

// Client 1: SERVICE ROLE — bypasses Row Level Security
// Use for: backend operations, admin tasks, reading any user's data
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // ← NEVER put this in frontend
);

// Client 2: ANON (public) — respects Row Level Security
// Use for: operations where RLS should apply
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY           // safe for frontend
);
```

**When the backend uses which:**
- `supabase` (service role): most operations — approve members, create cards, read other users' data for admin
- `supabasePublic` (anon): verifying a user's JWT via `supabasePublic.auth.getUser(token)` — this enforces that it's the real user's token

---

## Part H — Row Level Security (RLS)

RLS is a PostgreSQL feature that adds a WHERE clause to **every query**, automatically, based on who is running it.

### Enabling RLS

```sql
-- Enable RLS on a table (disabled by default)
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Once enabled: all queries return 0 rows unless a policy exists
-- This is intentional — deny by default, explicitly grant access
```

### Writing policies

```sql
-- Policy structure:
CREATE POLICY "policy name"
ON table_name
FOR operation         -- SELECT, INSERT, UPDATE, DELETE, or ALL
USING (condition)     -- for SELECT/UPDATE/DELETE: which rows are visible
WITH CHECK (condition); -- for INSERT/UPDATE: which values are allowed
```

**Example 1: Users see only their own records**

```sql
CREATE POLICY "users see own wallet"
ON token_wallets
FOR SELECT
USING (auth.uid() = user_id);
--      ↑ built-in function: returns the user_id from the current JWT
```

**Example 2: Only the service role can modify wallets**

```sql
CREATE POLICY "service role manages wallets"
ON token_wallets
FOR ALL                      -- SELECT, INSERT, UPDATE, DELETE
USING (auth.role() = 'service_role');
-- auth.role() = 'service_role' when using the SERVICE_ROLE_KEY
-- auth.role() = 'authenticated' for normal logged-in users
```

**Example 3: Users see project members if they belong to the same org**

```sql
CREATE POLICY "org members see project members"
ON project_members
FOR SELECT
USING (
  project_id IN (
    SELECT p.id
    FROM projects p
    JOIN org_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);
-- Subquery runs for EVERY row being considered
-- PostgreSQL optimises this with proper indexes
```

**Example 4: Public read (no auth needed)**

```sql
-- Anyone can verify a card (the QR scan page is public)
CREATE POLICY "public can read active cards"
ON generated_cards
FOR SELECT
USING (status = 'active');
-- No auth.uid() check — works even without a JWT
```

### How auth.uid() works

When a request arrives at PostgREST with `Authorization: Bearer <JWT>`, Supabase:
1. Decodes the JWT
2. Extracts the user's UUID from `sub` claim
3. Makes it available as `auth.uid()` in all SQL running during that request

No code needed — it's automatic.

### Testing your policies

In Supabase SQL Editor, test as a specific user:

```sql
-- Set the role to simulate a regular user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here", "role": "authenticated"}';

-- Now run your query — it will apply RLS as if this user is logged in
SELECT * FROM project_members WHERE project_id = 'abc';
```

---

## Part I — Supabase Auth

Supabase Auth (built on GoTrue) handles user accounts, sessions, and JWTs.

### The `auth.users` table

Supabase creates and manages this table. You cannot modify it directly through normal queries — use Supabase Auth APIs.

```sql
-- Read user info (admin only — service role):
SELECT id, email, created_at, email_confirmed_at
FROM auth.users;

-- Your own tables reference auth.users via foreign key:
ALTER TABLE public.members
ADD CONSTRAINT members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Common Auth operations (from backend)

```js
const { supabasePublic } = require('./config/supabaseClient');

// Verify a user's JWT (used in verifyToken middleware)
const { data: { user }, error } = await supabasePublic.auth.getUser(jwtToken);
// Returns null if token is invalid or expired

// Admin: list all users (requires service role)
const { data: { users } } = await supabase.auth.admin.listUsers();

// Admin: delete a user
await supabase.auth.admin.deleteUser(userId);

// Admin: create a user directly (bypasses signup flow)
const { data: { user } } = await supabase.auth.admin.createUser({
  email: 'test@example.com',
  password: 'secure-password',
  email_confirm: true,   // skip OTP
});
```

---

## Part J — Supabase Storage

Supabase Storage is an S3-compatible object store for files.

### Concepts

- **Bucket**: a container for files (like a folder at the top level). This project uses the `id-cards` bucket.
- **Object**: a file stored in a bucket, identified by its path: `org-id/project-id/member-name_card-uuid.png`
- **Policy**: who can upload, download, or delete objects (separate from table RLS policies)
- **Signed URL**: a temporary URL that grants access to a private object for a limited time

### Storage policies (set in Supabase Dashboard → Storage → Policies)

```sql
-- Allow authenticated users to upload their own photos:
CREATE POLICY "authenticated users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'id-cards'
  AND auth.role() = 'authenticated'
);

-- Only service role can read (backend generates signed URLs for clients):
CREATE POLICY "service role can read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-cards'
  AND auth.role() = 'service_role'
);
```

### Working with storage in Node.js

```js
// Upload a file
const { data, error } = await supabase.storage
  .from('id-cards')                           // bucket name
  .upload(
    'org-id/project-id/ali_abc12345.png',     // object path
    pngBuffer,                                 // Buffer or File
    { contentType: 'image/png', upsert: false } // options
  );

// Generate a signed URL (temporary access, expires in 1 hour)
const { data: { signedUrl } } = await supabase.storage
  .from('id-cards')
  .createSignedUrl('org-id/project-id/ali_abc12345.png', 3600);
// signedUrl = "https://supabase.co/storage/v1/object/sign/id-cards/..."

// Delete a file
await supabase.storage
  .from('id-cards')
  .remove(['org-id/project-id/ali_abc12345.png']);
```

---

## Part K — Supabase SDK Patterns Used in This Project

### Pattern 1: Always check for errors

```js
// WRONG — ignores errors
const { data } = await supabase.from('members').select('*');
// data could be null if there was an error, and you'd never know

// CORRECT — always destructure and check both
const { data, error } = await supabase.from('members').select('*');
if (error) {
  console.error('DB error:', error.message);
  throw error;   // or return { data: null, error }
}
// Now data is guaranteed to exist
```

### Pattern 2: `.single()` vs `.maybeSingle()`

```js
// .single() — expects exactly 1 row; errors if 0 or 2+ rows
const { data, error } = await supabase
  .from('token_wallets')
  .select('*')
  .eq('user_id', userId)
  .is('org_id', null)
  .single();
// error if no wallet found

// .maybeSingle() — returns null if 0 rows (doesn't error)
const { data, error } = await supabase
  .from('token_wallets')
  .select('*')
  .eq('user_id', userId)
  .maybeSingle();
// data = null if not found, error only if DB problem
```

Use `.single()` when you know the row must exist (primary key lookup).  
Use `.maybeSingle()` when the row might not exist (first login, optional data).

### Pattern 3: Select only what you need

```js
// WRONG — fetches all columns including blobs, unused data
const { data } = await supabase.from('project_members').select('*');

// CORRECT — fetch only what the response needs
const { data } = await supabase
  .from('project_members')
  .select('id, name, email, status, created_at');
```

This reduces data transfer and makes your code self-documenting about what it uses.

### Pattern 4: Joins in the SDK

```js
// Select from generated_cards and include the member's name:
const { data } = await supabase
  .from('generated_cards')
  .select(`
    id,
    status,
    expires_at,
    project_members (
      name,
      email
    )
  `)
  .eq('project_id', projectId);

// Result: [{
//   id: "uuid",
//   status: "active",
//   project_members: { name: "Ali Hassan", email: "ali@test.com" }
// }]
```

This translates to a JOIN query in PostgREST using foreign key relationships defined in your schema.

### Pattern 5: Bulk insert

```js
// Insert many rows in a single API call (one DB round-trip)
const rows = members.map(m => ({
  project_id: projectId,
  org_id: orgId,
  name: m.name,
  email: m.email,
  status: 'approved',
}));

const { data, error } = await supabase
  .from('project_members')
  .insert(rows)      // array of objects
  .select();
// data = array of inserted rows with IDs
```

---

## Part L — Writing Migrations

A **migration** is a SQL file that makes a specific change to the database schema. Migrations are run in order — they're the history of your schema.

### Structure

```
backend/
└── migrations/
    └── 000_full_setup.sql    ← creates all tables from scratch
```

For this project there's one large migration (full setup). In professional projects, you'd have many small ones:

```
001_create_orgs.sql
002_create_projects.sql
003_add_card_styles_to_projects.sql
004_add_delivery_status_to_members.sql
```

### Writing a migration

```sql
-- Always make migrations idempotent (safe to run twice):

-- Tables: use CREATE TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  logo_url   TEXT,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columns: use IF NOT EXISTS
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT NULL;

-- Indexes: use IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);

-- RLS: always enable and write policies
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "org members can read their org"
ON public.organizations
FOR SELECT
USING (
  id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  )
);
```

### Running migrations

Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → run).

Or via the Supabase CLI (advanced):
```bash
supabase db push   # applies all pending migrations
```

---

## Part M — The Quick Reference

### SQL snippets you'll use constantly

```sql
-- Most recent N records
SELECT * FROM table ORDER BY created_at DESC LIMIT 10;

-- Count matching rows
SELECT COUNT(*) FROM project_members WHERE status = 'pending';

-- Find duplicates
SELECT email, COUNT(*) FROM project_members GROUP BY email HAVING COUNT(*) > 1;

-- Records from the last 30 days
WHERE created_at >= NOW() - INTERVAL '30 days'

-- Update and return the updated row
UPDATE table SET col = val WHERE id = 'uuid' RETURNING *;

-- UPSERT (insert or update on conflict)
INSERT INTO token_wallets (user_id, balance)
VALUES ('uuid', 50)
ON CONFLICT (user_id) DO UPDATE
SET balance = token_wallets.balance + 50;

-- Delete and return deleted row
DELETE FROM table WHERE id = 'uuid' RETURNING *;

-- Search JSON field
WHERE custom_fields->>'department' = 'CS'

-- Check if JSON key exists
WHERE custom_fields ? 'department'
```

### Supabase SDK equivalents

| SQL | Supabase SDK |
|---|---|
| `SELECT * FROM t WHERE a = 'x'` | `.from('t').select('*').eq('a', 'x')` |
| `WHERE a != 'x'` | `.neq('a', 'x')` |
| `WHERE a > 5` | `.gt('a', 5)` |
| `WHERE a >= 5` | `.gte('a', 5)` |
| `WHERE a IS NULL` | `.is('a', null)` |
| `WHERE a IN (1,2,3)` | `.in('a', [1, 2, 3])` |
| `WHERE a LIKE '%x%'` | `.ilike('a', '%x%')` |
| `ORDER BY a DESC` | `.order('a', { ascending: false })` |
| `LIMIT 20 OFFSET 40` | `.range(40, 59)` |
| `INSERT INTO t VALUES (...)` | `.from('t').insert({...})` |
| `UPDATE t SET ... WHERE id=x` | `.from('t').update({...}).eq('id', x)` |
| `DELETE FROM t WHERE id=x` | `.from('t').delete().eq('id', x)` |
| Call stored function | `.rpc('function_name', { param: value })` |
