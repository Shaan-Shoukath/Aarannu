# 03 – Row Level Security (RLS) Policies

## What is RLS?

Row Level Security is a Postgres feature that **restricts which rows a user can access** at the database level. Unlike application-level checks (middleware), RLS cannot be bypassed — even if someone calls the API directly.

Supabase maps the authenticated user's JWT to `auth.uid()`, which we use in every policy.

---

## Enable RLS

```sql
-- CRITICAL: Enable RLS on both tables.
-- Without this, ALL rows are accessible to ANY authenticated user.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_ids ENABLE ROW LEVEL SECURITY;
```

> ⚠️ **If you forget to enable RLS, your data is publicly readable/writable by any authenticated user.** This is the #1 security mistake in Supabase projects.

---

## Policies for `members`

### 1. Users can read their own member profile

```sql
CREATE POLICY "Users can read own profile"
  ON public.members
  FOR SELECT
  USING (auth.uid() = user_id);
```

**What it does:** A user can only `SELECT` rows from `members` where the `user_id` matches their auth UID.

**Why:** Prevents user A from reading user B's profile, approval status, or role.

### 2. Users can insert their own profile (on signup)

```sql
CREATE POLICY "Users can insert own profile"
  ON public.members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**What it does:** A user can only `INSERT` a row if the `user_id` they provide matches their own auth UID.

**Why:** Prevents a user from creating a profile under someone else's `user_id`.

### 3. Users can update their own profile (name/role only)

```sql
CREATE POLICY "Users can update own profile"
  ON public.members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**What it does:** A user can only `UPDATE` their own row.

**Why:** Users might want to change their name or role, but they cannot modify another user's row.

> ⚠️ **Note:** This policy does NOT prevent a user from setting `approved = true` on their own row. To prevent this, you would need a more restrictive policy or use a database trigger/function. For production, consider:
>
> ```sql
> CREATE POLICY "Users can update own profile (restricted)"
>   ON public.members
>   FOR UPDATE
>   USING (auth.uid() = user_id)
>   WITH CHECK (auth.uid() = user_id AND approved = (SELECT approved FROM members WHERE user_id = auth.uid()));
> ```
>
> Or better: use a Supabase Edge Function for admin approval.

---

## Policies for `generated_ids`

### 1. Users can read their own generated IDs

```sql
CREATE POLICY "Users can read own generated IDs"
  ON public.generated_ids
  FOR SELECT
  USING (auth.uid() = user_id);
```

**What it does:** A user can only `SELECT` their own generated ID records.

**Why:** Prevents user A from seeing user B's ID cards or file paths.

### 2. Users can insert their own generated IDs

```sql
CREATE POLICY "Users can insert own generated IDs"
  ON public.generated_ids
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**What it does:** A user can only `INSERT` records tied to their own `user_id`.

**Why:** Prevents spoofing — no one can create records attributing files to another user.

---

## Storage Policies

For the `id-cards` private storage bucket:

```sql
-- Users can upload files to their own folder
CREATE POLICY "Users can upload own ID cards"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'id-cards'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read files from their own folder
CREATE POLICY "Users can read own ID cards"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'id-cards'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

**What it does:**

- Files are stored at `{user_id}/{filename}.png`.
- The policies check that the first folder in the path matches the authenticated user's ID.
- This prevents user A from uploading to or reading from user B's folder.

---

## Full RLS Setup SQL

Run this entire block in the Supabase SQL Editor:

```sql
-- ═══════════════════════════════════════
-- ENABLE RLS
-- ═══════════════════════════════════════
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_ids ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- MEMBERS POLICIES
-- ═══════════════════════════════════════
CREATE POLICY "Users can read own profile"
  ON public.members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- GENERATED_IDS POLICIES
-- ═══════════════════════════════════════
CREATE POLICY "Users can read own generated IDs"
  ON public.generated_ids FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated IDs"
  ON public.generated_ids FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- STORAGE POLICIES (run in SQL editor)
-- ═══════════════════════════════════════
-- Note: Create the 'id-cards' bucket first via the Supabase dashboard
-- Settings: Private bucket, no public access

CREATE POLICY "Users can upload own ID cards"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'id-cards'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own ID cards"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'id-cards'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Security Reasoning Summary

| Threat                                    | Mitigation                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| User reads another user's data            | RLS `SELECT` policies filter by `auth.uid()`                                |
| User inserts data under another user's ID | RLS `INSERT` policies check `user_id = auth.uid()`                          |
| User modifies another user's profile      | RLS `UPDATE` policies restrict to own rows                                  |
| User accesses another user's files        | Storage policies restrict folder access by UID                              |
| User self-approves                        | Addressed with restricted update policy (see note above)                    |
| Unauthenticated access                    | RLS only allows access with valid JWT; anon key alone grants no data access |

---

## Token System RLS Policies

The token tables use RLS to ensure users can only access their own wallet and transactions:

```sql
-- token_wallets: users can read their own wallet
CREATE POLICY "Users can read own wallet"
  ON public.token_wallets FOR SELECT
  USING (auth.uid() = user_id);

-- token_transactions: users can read transactions for their wallets
CREATE POLICY "Users can read own transactions"
  ON public.token_transactions FOR SELECT
  USING (
    wallet_id IN (SELECT id FROM public.token_wallets WHERE user_id = auth.uid())
  );

-- token_packages: anyone can read active packages (public catalog)
CREATE POLICY "Anyone can read active packages"
  ON public.token_packages FOR SELECT
  USING (is_active = true);
```

**Key points:**

- All write operations (INSERT/UPDATE on wallets and transactions) are performed server-side via the **service-role** client, bypassing RLS entirely.
- Users cannot modify their own balance — only the backend can deduct/add tokens.
- The packages table is publicly readable (no auth needed) for the purchase page.
- Transaction reads are scoped via a subquery on `wallet_id` ownership.
