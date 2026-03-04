-- ═══════════════════════════════════════════════════════════════
-- Supabase Migration: webhook_configs table
-- ═══════════════════════════════════════════════════════════════
-- 
-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor)
-- to create the webhook_configs table needed for Google Form automation.
--
-- This table stores webhook configurations that allow automatic
-- ID card generation when a Google Form is submitted.
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the webhook_configs table
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  secret          TEXT NOT NULL,
  template        TEXT NOT NULL DEFAULT 'custom',
  org_name        TEXT DEFAULT '',
  logo_url        TEXT DEFAULT '',
  field_mapping   JSONB DEFAULT '{}'::jsonb,
  card_styles     JSONB DEFAULT '{}'::jsonb,
  gradient_colors JSONB DEFAULT '{"start":"#1152d4","end":"#ef4444"}'::jsonb,
  field_visibility JSONB DEFAULT '{"dob":true,"gender":true,"blood_group":true,"role":true,"address":true}'::jsonb,
  orientation     TEXT DEFAULT 'horizontal',
  validity_text   TEXT DEFAULT 'Valid for 1 year from issue',
  watermark       JSONB DEFAULT '{}'::jsonb,
  auto_email      BOOLEAN DEFAULT true,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id 
  ON public.webhook_configs(user_id);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_is_active 
  ON public.webhook_configs(is_active);

-- 3. Enable Row Level Security
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can read their own webhook configs
CREATE POLICY "Users can read own webhook configs"
  ON public.webhook_configs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own webhook configs
CREATE POLICY "Users can insert own webhook configs"
  ON public.webhook_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own webhook configs
CREATE POLICY "Users can update own webhook configs"
  ON public.webhook_configs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own webhook configs
CREATE POLICY "Users can delete own webhook configs"
  ON public.webhook_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Service role bypass (for backend webhook handler)
-- The backend uses the service_role key which bypasses RLS,
-- so it can read any webhook config when processing incoming webhooks.

-- ═══════════════════════════════════════════════════════════════
-- DONE! Your webhook_configs table is ready.
-- ═══════════════════════════════════════════════════════════════
