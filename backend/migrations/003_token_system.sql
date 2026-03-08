-- ============================================================
-- 003  TOKEN / CREDIT SYSTEM
-- ============================================================
-- Adds usage-based billing tables:
--   • token_wallets       – one row per user (or per org)
--   • token_transactions  – immutable ledger of all movements
--   • token_packages      – purchasable bundles
-- ============================================================

-- ── 1. Token Wallets ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID,  -- nullable; FK to organizations added by migration 002 if present
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased  INTEGER NOT NULL DEFAULT 0,
  lifetime_used       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One wallet per user per org (NULL org = personal wallet)
  UNIQUE (user_id, org_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_wallets_user   ON token_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_token_wallets_org    ON token_wallets(org_id);

-- Auto-update `updated_at`
CREATE OR REPLACE FUNCTION update_token_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_token_wallet_updated ON token_wallets;
CREATE TRIGGER trg_token_wallet_updated
  BEFORE UPDATE ON token_wallets
  FOR EACH ROW EXECUTE FUNCTION update_token_wallet_timestamp();


-- ── 2. Token Transactions (immutable ledger) ────────────────
CREATE TABLE IF NOT EXISTS token_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID NOT NULL REFERENCES token_wallets(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        UUID,  -- nullable; FK to organizations added by migration 002 if present
  amount        INTEGER NOT NULL,               -- positive = credit, negative = debit
  type          TEXT NOT NULL CHECK (type IN ('purchase','usage','refund','bonus','adjustment')),
  description   TEXT,
  reference_id  TEXT,                            -- e.g. card ID, payment ID
  balance_after INTEGER NOT NULL,               -- snapshot of wallet balance after txn
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_txn_wallet    ON token_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_token_txn_user      ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_txn_type      ON token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_token_txn_created   ON token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_txn_reference ON token_transactions(reference_id);


-- ── 3. Token Packages (purchasable bundles) ─────────────────
CREATE TABLE IF NOT EXISTS token_packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  tokens      INTEGER NOT NULL CHECK (tokens > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),  -- price in cents (USD)
  currency    TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default packages
INSERT INTO token_packages (name, tokens, price_cents, currency, description, sort_order) VALUES
  ('Starter',    100,   499, 'USD', '100 ID card credits – great for small teams',     1),
  ('Growth',     500,  1999, 'USD', '500 ID card credits – best for growing orgs',     2),
  ('Enterprise', 2000, 5999, 'USD', '2 000 ID card credits – bulk pricing',            3)
ON CONFLICT DO NOTHING;


-- ── 4. Row Level Security ───────────────────────────────────

-- token_wallets
ALTER TABLE token_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
  ON token_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages wallets"
  ON token_wallets FOR ALL
  USING (auth.role() = 'service_role');

-- token_transactions
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON token_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages transactions"
  ON token_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- token_packages (public read)
ALTER TABLE token_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON token_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages packages"
  ON token_packages FOR ALL
  USING (auth.role() = 'service_role');
