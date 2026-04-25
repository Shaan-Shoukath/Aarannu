-- ══════════════════════════════════════════════════════════════════════
-- Aarannu — FULL DATABASE SETUP (run once, in order)
-- ══════════════════════════════════════════════════════════════════════
--
-- Copy this entire file into Supabase → SQL Editor → Run
--
-- What this creates:
--   STEP 1  — Core tables  (members, generated_ids)
--   STEP 2  — SaaS tables  (orgs, projects, project_members, generated_cards)
--   STEP 3  — Token system (wallets, transactions, packages)
--   STEP 4  — RLS policies for every table
--   STEP 5  — Indexes for performance
--   STEP 6  — Helper functions and triggers
--
-- NOTE: The storage bucket (id-cards) CANNOT be created via SQL.
--       Create it manually: Storage → New Bucket → "id-cards" (private).
-- ══════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────
-- STEP 1 — CORE TABLES (legacy single-tenant)
-- ──────────────────────────────────────────────────────────────────────

-- members: one row per authenticated user.
-- Each user creates this row on signup; admin sets approved = true.
CREATE TABLE IF NOT EXISTS public.members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'Member',          -- display label (e.g. "Admin", "Staff")
  approved   BOOLEAN DEFAULT false,          -- gate: false = blocked from dashboard
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);

-- generated_ids: tracks every card a user generates (legacy flow)
CREATE TABLE IF NOT EXISTS public.generated_ids (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url   TEXT NOT NULL,                  -- path in Supabase Storage
  expires_at TIMESTAMPTZ NOT NULL,           -- auto-cleanup after this date
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_ids_user   ON public.generated_ids(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_ids_expiry ON public.generated_ids(expires_at);


-- ──────────────────────────────────────────────────────────────────────
-- STEP 2 — SAAS MULTI-TENANT TABLES
-- ──────────────────────────────────────────────────────────────────────

-- subscription_plans: lookup table for plan limits
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id             TEXT PRIMARY KEY,
  display_name   TEXT NOT NULL,
  max_members    INT DEFAULT 50,
  max_projects   INT DEFAULT 3,
  max_storage_mb INT DEFAULT 500,
  rate_limit_rpm INT DEFAULT 60,
  price_monthly  NUMERIC(10,2) DEFAULT 0
);

INSERT INTO public.subscription_plans
  (id, display_name, max_members, max_projects, max_storage_mb, rate_limit_rpm, price_monthly)
VALUES
  ('free',       'Free',       50,    3,    500,   60,   0),
  ('starter',    'Starter',    500,   10,   2000,  120,  29),
  ('pro',        'Pro',        5000,  50,   10000, 300,  99),
  ('enterprise', 'Enterprise', NULL,  NULL, NULL,  NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- organizations: tenant root entity
CREATE TABLE IF NOT EXISTS public.organizations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,        -- URL-safe identifier (e.g. "tinkerspace")
  logo_url     TEXT DEFAULT '',
  plan         TEXT DEFAULT 'free' REFERENCES public.subscription_plans(id),
  plan_expires TIMESTAMPTZ,
  settings     JSONB DEFAULT '{}',
  created_by   UUID REFERENCES auth.users(id) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_slug    ON public.organizations(slug);
CREATE INDEX       IF NOT EXISTS idx_org_creator  ON public.organizations(created_by);

-- org_members: junction table — user ↔ org with per-org role
CREATE TABLE IF NOT EXISTS public.org_members (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id    UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role      TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_orgmembers_user ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_orgmembers_org  ON public.org_members(org_id);

-- projects: each org owns multiple projects (card campaigns)
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('service','bulk')),
  name         TEXT NOT NULL,
  template     TEXT DEFAULT 'default',
  member_limit INT,
  expiry_days  INT DEFAULT 365,
  form_schema  JSONB DEFAULT '[]',           -- custom registration form fields
  card_config  JSONB DEFAULT '{}',           -- card styling config
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','archived','completed')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(org_id);

-- project_members: people who registered via a public form
CREATE TABLE IF NOT EXISTS public.project_members (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  org_id        UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT,
  photo_url     TEXT DEFAULT '',
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  custom_fields JSONB DEFAULT '{}',          -- submitted form data
  submitted_by  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmembers_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pmembers_org     ON public.project_members(org_id);
CREATE INDEX IF NOT EXISTS idx_pmembers_status  ON public.project_members(status);

-- generated_cards: multi-tenant card records with full metadata
CREATE TABLE IF NOT EXISTS public.generated_cards (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  member_id  UUID REFERENCES public.project_members(id) ON DELETE CASCADE NOT NULL,
  file_path  TEXT NOT NULL,                  -- storage path: {orgId}/{projectId}/{memberId}.png
  qr_data    TEXT,                           -- encoded verification URL
  status     TEXT DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcards_org     ON public.generated_cards(org_id);
CREATE INDEX IF NOT EXISTS idx_gcards_project ON public.generated_cards(project_id);
CREATE INDEX IF NOT EXISTS idx_gcards_member  ON public.generated_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_gcards_expiry  ON public.generated_cards(expires_at);


-- ──────────────────────────────────────────────────────────────────────
-- STEP 3 — TOKEN SYSTEM
-- ──────────────────────────────────────────────────────────────────────

-- token_wallets: one per user (or per user+org for org billing)
CREATE TABLE IF NOT EXISTS public.token_wallets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id             UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- NULL = personal wallet
  balance            INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  lifetime_used      INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_token_wallets_user ON public.token_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_token_wallets_org  ON public.token_wallets(org_id);

-- Auto-bump updated_at on every wallet change
CREATE OR REPLACE FUNCTION update_token_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_token_wallet_updated ON public.token_wallets;
CREATE TRIGGER trg_token_wallet_updated
  BEFORE UPDATE ON public.token_wallets
  FOR EACH ROW EXECUTE FUNCTION update_token_wallet_timestamp();

-- token_transactions: immutable ledger (never UPDATE or DELETE rows here)
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID NOT NULL REFERENCES public.token_wallets(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  amount        INTEGER NOT NULL,            -- positive = credit, negative = debit
  type          TEXT NOT NULL CHECK (type IN ('purchase','usage','refund','bonus','adjustment')),
  description   TEXT,
  reference_id  TEXT,                        -- card ID, payment ID, etc.
  balance_after INTEGER NOT NULL,            -- wallet snapshot after this transaction
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_txn_wallet    ON public.token_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_token_txn_user      ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_txn_type      ON public.token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_token_txn_created   ON public.token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_txn_reference ON public.token_transactions(reference_id);

-- token_packages: purchasable bundles shown on /tokens/purchase
CREATE TABLE IF NOT EXISTS public.token_packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  tokens      INTEGER NOT NULL CHECK (tokens > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency    TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default packages (idempotent)
INSERT INTO public.token_packages (name, tokens, price_cents, currency, description, sort_order)
VALUES
  ('Starter',    100,   499, 'USD', '100 ID card credits – great for small teams',  1),
  ('Growth',     500,  1999, 'USD', '500 ID card credits – best for growing orgs',  2),
  ('Enterprise', 2000, 5999, 'USD', '2000 ID card credits – bulk pricing',          3)
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────────────
-- STEP 4 — ROW LEVEL SECURITY (enable + policies)
-- ──────────────────────────────────────────────────────────────────────

-- Enable RLS on every table
ALTER TABLE public.members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_ids        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_cards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_wallets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_packages       ENABLE ROW LEVEL SECURITY;

-- ── members ──────────────────────────────────────────────────────────
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

-- ── generated_ids ─────────────────────────────────────────────────────
CREATE POLICY "Users can read own generated_ids"
  ON public.generated_ids FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated_ids"
  ON public.generated_ids FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated_ids"
  ON public.generated_ids FOR DELETE
  USING (auth.uid() = user_id);

-- ── subscription_plans ───────────────────────────────────────────────
CREATE POLICY "Anyone can read plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

-- ── organizations ────────────────────────────────────────────────────
CREATE POLICY "Org members can read their org"
  ON public.organizations FOR SELECT
  USING (id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Only owner can update org"
  ON public.organizations FOR UPDATE
  USING (id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- ── org_members ───────────────────────────────────────────────────────
CREATE POLICY "Users can see org memberships in their orgs"
  ON public.org_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

CREATE POLICY "Admins can add org members"
  ON public.org_members FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
    OR user_id = auth.uid()   -- self-insert when creating an org
  );

CREATE POLICY "Admins can update org members"
  ON public.org_members FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

CREATE POLICY "Owners can remove org members"
  ON public.org_members FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- ── projects ─────────────────────────────────────────────────────────
CREATE POLICY "Org members can read projects"
  ON public.projects FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Admins can update projects"
  ON public.projects FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- ── project_members ───────────────────────────────────────────────────
CREATE POLICY "Org admins can read project members"
  ON public.project_members FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- Public registration forms insert without auth
CREATE POLICY "Public form submission"
  ON public.project_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update project members"
  ON public.project_members FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Admins can delete project members"
  ON public.project_members FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- ── generated_cards ───────────────────────────────────────────────────
CREATE POLICY "Org admins can read cards"
  ON public.generated_cards FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Org admins can insert cards"
  ON public.generated_cards FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Org admins can update cards"
  ON public.generated_cards FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Org admins can delete cards"
  ON public.generated_cards FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- ── token_wallets ─────────────────────────────────────────────────────
CREATE POLICY "Users can view own wallets"
  ON public.token_wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Backend (service_role) manages all wallet writes
CREATE POLICY "Service role manages wallets"
  ON public.token_wallets FOR ALL
  USING (auth.role() = 'service_role');

-- ── token_transactions ────────────────────────────────────────────────
CREATE POLICY "Users can view own transactions"
  ON public.token_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages transactions"
  ON public.token_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- ── token_packages ────────────────────────────────────────────────────
CREATE POLICY "Anyone can view active packages"
  ON public.token_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages packages"
  ON public.token_packages FOR ALL
  USING (auth.role() = 'service_role');


-- ──────────────────────────────────────────────────────────────────────
-- STEP 5 — STORAGE RLS (run AFTER creating the id-cards bucket in the UI)
-- ──────────────────────────────────────────────────────────────────────

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


-- ──────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Expected tables: members, generated_ids, subscription_plans,
--   organizations, org_members, projects, project_members,
--   generated_cards, token_wallets, token_transactions, token_packages
-- ──────────────────────────────────────────────────────────────────────
