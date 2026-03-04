-- ═══════════════════════════════════════════════════════════════
-- Migration 003: Form Fields Table + Photo Uploads + Versioning
-- ═══════════════════════════════════════════════════════════════
--
-- This migration adds:
--   1. form_fields table — dedicated per-project field definitions
--   2. form_version column on projects — versioning for form schemas
--   3. member_uploads table — tracks file/photo uploads by members
--   4. Indexes for fast lookups
--
-- Run this AFTER 001 and 002 migrations.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Add form_version to projects ─────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS form_version integer DEFAULT 1;

-- ── 2. Form Fields Table ────────────────────────────────────
-- Each row represents one field in a project's registration form.
-- System fields (name, email, photo) have is_system = true and
-- cannot be deleted via API.
CREATE TABLE IF NOT EXISTS form_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_key     text NOT NULL,                         -- machine name e.g. "department"
  label         text NOT NULL,                         -- display label
  type          text NOT NULL DEFAULT 'text',          -- text, email, phone, number, textarea, dropdown, radio, checkbox, date, file_upload, photo_upload
  required      boolean NOT NULL DEFAULT false,
  placeholder   text DEFAULT '',
  description   text DEFAULT '',                       -- help text shown below the field
  validation_rules jsonb DEFAULT '{}',                 -- e.g. {"minLength":2,"maxLength":100,"pattern":"^[A-Z]"}
  options       jsonb DEFAULT '[]',                    -- for dropdown/radio/checkbox: ["Option A","Option B"]
  default_value text DEFAULT '',
  sort_order    integer NOT NULL DEFAULT 0,            -- display order
  is_system     boolean NOT NULL DEFAULT false,        -- true for name, email, photo (cannot be deleted)
  version       integer NOT NULL DEFAULT 1,            -- form version this field belongs to
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Composite index for fetching fields by project + version
CREATE INDEX IF NOT EXISTS idx_form_fields_project_version
  ON form_fields(project_id, version, sort_order);

-- Unique constraint: one field_key per project per version
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_fields_unique_key
  ON form_fields(project_id, field_key, version);

-- ── 3. Member Uploads Table ─────────────────────────────────
-- Tracks files/photos uploaded during registration.
CREATE TABLE IF NOT EXISTS member_uploads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id   uuid REFERENCES project_members(id) ON DELETE SET NULL,
  field_key   text NOT NULL,                          -- which form field this upload belongs to
  file_name   text NOT NULL,
  file_path   text NOT NULL,                          -- path in Supabase Storage
  file_size   integer DEFAULT 0,
  mime_type   text DEFAULT 'application/octet-stream',
  uploaded_by text,                                   -- user ID or 'public'
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_uploads_project
  ON member_uploads(project_id);

CREATE INDEX IF NOT EXISTS idx_member_uploads_member
  ON member_uploads(member_id);

-- ── 4. Add card_field_mapping to projects ───────────────────
-- Maps form field keys → card template positions
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS card_field_mapping jsonb DEFAULT '{}';

-- ── 5. Seed system fields function ──────────────────────────
-- Call this after creating a project to insert the 3 system fields.
-- This is idempotent (uses ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION seed_system_fields(p_project_id uuid, p_version integer DEFAULT 1)
RETURNS void AS $$
BEGIN
  INSERT INTO form_fields (project_id, field_key, label, type, required, placeholder, is_system, sort_order, version)
  VALUES
    (p_project_id, 'name',  'Full Name', 'text',         true, 'John Doe',        true, 0, p_version),
    (p_project_id, 'email', 'Email',     'email',        true, 'john@example.com', true, 1, p_version),
    (p_project_id, 'photo', 'Photo',     'photo_upload',  false, '',                true, 2, p_version)
  ON CONFLICT (project_id, field_key, version) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ── 6. RLS Policies ────────────────────────────────────────
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_uploads ENABLE ROW LEVEL SECURITY;

-- form_fields: anyone can SELECT (needed for public registration forms)
CREATE POLICY "form_fields_select_all" ON form_fields
  FOR SELECT USING (true);

-- form_fields: only service role can INSERT/UPDATE/DELETE (backend manages these)
CREATE POLICY "form_fields_service_manage" ON form_fields
  FOR ALL USING (true) WITH CHECK (true);

-- member_uploads: anyone can SELECT (backend controls access via signed URLs)
CREATE POLICY "member_uploads_select_all" ON member_uploads
  FOR SELECT USING (true);

CREATE POLICY "member_uploads_service_manage" ON member_uploads
  FOR ALL USING (true) WITH CHECK (true);

-- ── 7. Create storage bucket for member uploads ─────────────
-- Note: Run this via Supabase Dashboard or supabase CLI:
--   supabase storage create member-uploads --public=false
-- The bucket should be PRIVATE (signed URL access only).
-- If you prefer SQL, this may not be supported in all Supabase versions.

-- ═══════════════════════════════════════════════════════════════
-- DONE. After running this migration:
--   1. Create the 'member-uploads' storage bucket (private) in Supabase Dashboard
--   2. Restart the backend server
-- ═══════════════════════════════════════════════════════════════
