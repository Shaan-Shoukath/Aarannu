-- ═══════════════════════════════════════════════════════════
-- Aarannu SaaS Platform — Migration 002
-- Multi-tenant schema: organizations, projects, members, cards
-- ═══════════════════════════════════════════════════════════

-- ─── 1. SUBSCRIPTION PLANS (reference table) ───────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id             TEXT PRIMARY KEY,
  display_name   TEXT NOT NULL,
  max_members    INT DEFAULT 50,
  max_projects   INT DEFAULT 3,
  max_storage_mb INT DEFAULT 500,
  rate_limit_rpm INT DEFAULT 60,
  price_monthly  NUMERIC(10,2) DEFAULT 0
);

INSERT INTO public.subscription_plans (id, display_name, max_members, max_projects, max_storage_mb, rate_limit_rpm, price_monthly)
VALUES
  ('free',       'Free',       50,    3,    500,   60,   0),
  ('starter',    'Starter',    500,   10,   2000,  120,  29),
  ('pro',        'Pro',        5000,  50,   10000, 300,  99),
  ('enterprise', 'Enterprise', NULL,  NULL, NULL,  NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. ORGANIZATIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  logo_url      TEXT DEFAULT '',
  plan          TEXT DEFAULT 'free' REFERENCES public.subscription_plans(id),
  plan_expires  TIMESTAMPTZ,
  settings      JSONB DEFAULT '{}',
  created_by    UUID REFERENCES auth.users(id) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_creator ON public.organizations(created_by);

-- ─── 3. ORG_MEMBERS (user ↔ org link with roles) ───────────
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

-- ─── 4. PROJECTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('service','bulk')),
  name          TEXT NOT NULL,
  template      TEXT DEFAULT 'default',
  member_limit  INT,
  expiry_days   INT DEFAULT 365,
  form_schema   JSONB DEFAULT '[]',
  card_config   JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','archived','completed')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(org_id);

-- ─── 5. PROJECT_MEMBERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_members (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  org_id        UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT,
  photo_url     TEXT DEFAULT '',
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  custom_fields JSONB DEFAULT '{}',
  submitted_by  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmembers_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pmembers_org     ON public.project_members(org_id);
CREATE INDEX IF NOT EXISTS idx_pmembers_status  ON public.project_members(status);

-- ─── 6. GENERATED_CARDS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generated_cards (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  member_id     UUID REFERENCES public.project_members(id) ON DELETE CASCADE NOT NULL,
  file_path     TEXT NOT NULL,
  qr_data       TEXT,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcards_org     ON public.generated_cards(org_id);
CREATE INDEX IF NOT EXISTS idx_gcards_project ON public.generated_cards(project_id);
CREATE INDEX IF NOT EXISTS idx_gcards_member  ON public.generated_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_gcards_expiry  ON public.generated_cards(expires_at);

-- ═══════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on all new tables
ALTER TABLE public.organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- subscription_plans: readable by everyone (reference data)
CREATE POLICY "Anyone can read plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

-- ─── ORGANIZATIONS ──────────────────────────────────────────

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

-- ─── ORG_MEMBERS ────────────────────────────────────────────

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
    OR user_id = auth.uid()  -- self-insert when creating org
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

-- ─── PROJECTS ───────────────────────────────────────────────

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

-- ─── PROJECT_MEMBERS ───────────────────────────────────────

CREATE POLICY "Org admins can read project members"
  ON public.project_members FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Public form submission (insert)"
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

-- ─── GENERATED_CARDS ───────────────────────────────────────

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

-- ═══════════════════════════════════════════════════════════
-- DONE — Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════
