-- ═══════════════════════════════════════════════════════════════
-- Migration 001: Form Fields + Member Uploads + Versioning
-- ═══════════════════════════════════════════════════════════════
--
-- Adds:
--   1. form_version column on projects
--   2. form_fields table — per-project field definitions
--   3. member_uploads table — file/photo uploads during registration
--   4. card_field_mapping column on projects
--   5. seed_system_fields() helper function
--
-- Run AFTER 000_full_setup.sql
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Add form_version to projects ─────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS form_version integer DEFAULT 1;

-- ── 2. Form Fields Table ────────────────────────────────────
-- Each row is one field in a project's registration form.
-- System fields (name, email, photo) have is_system = true and
-- cannot be deleted via the API.
CREATE TABLE IF NOT EXISTS public.form_fields (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field_key        text NOT NULL,                         -- machine name e.g. "department"
  label            text NOT NULL,                         -- display label
  type             text NOT NULL DEFAULT 'text',          -- text, email, phone, number, textarea, dropdown, radio, checkbox, date, file_upload, photo_upload
  required         boolean NOT NULL DEFAULT false,
  placeholder      text DEFAULT '',
  description      text DEFAULT '',                       -- help text shown below the field
  validation_rules jsonb DEFAULT '{}',                    -- e.g. {"minLength":2,"maxLength":100,"pattern":"^[A-Z]"}
  options          jsonb DEFAULT '[]',                    -- for dropdown/radio/checkbox: ["Option A","Option B"]
  default_value    text DEFAULT '',
  sort_order       integer NOT NULL DEFAULT 0,            -- display order
  is_system        boolean NOT NULL DEFAULT false,        -- true for name, email, photo (cannot be deleted)
  version          integer NOT NULL DEFAULT 1,            -- form version this field belongs to
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Composite index: fetch fields by project + version in display order
CREATE INDEX IF NOT EXISTS idx_form_fields_project_version
  ON public.form_fields(project_id, version, sort_order);

-- One field_key per project per version
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_fields_unique_key
  ON public.form_fields(project_id, field_key, version);

-- ── 3. Member Uploads Table ─────────────────────────────────
-- Tracks files/photos uploaded during registration.
CREATE TABLE IF NOT EXISTS public.member_uploads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id   uuid REFERENCES public.project_members(id) ON DELETE SET NULL,
  field_key   text NOT NULL,                              -- which form field this upload belongs to
  file_name   text NOT NULL,
  file_path   text NOT NULL,                              -- path in Supabase Storage
  file_size   integer DEFAULT 0,
  mime_type   text DEFAULT 'application/octet-stream',
  uploaded_by text,                                       -- user ID or 'public'
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_uploads_project
  ON public.member_uploads(project_id);

CREATE INDEX IF NOT EXISTS idx_member_uploads_member
  ON public.member_uploads(member_id);

-- ── 4. Add card_field_mapping to projects ───────────────────
-- Maps form field keys → card template positions
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS card_field_mapping jsonb DEFAULT '{}';

-- ── 5. Seed system fields function ──────────────────────────
-- Idempotent: call after creating a project to insert the 3 system fields.
CREATE OR REPLACE FUNCTION public.seed_system_fields(p_project_id uuid, p_version integer DEFAULT 1)
RETURNS void AS $$
BEGIN
  INSERT INTO public.form_fields (project_id, field_key, label, type, required, placeholder, is_system, sort_order, version)
  VALUES
    (p_project_id, 'name',  'Full Name', 'text',         true,  'John Doe',         true, 0, p_version),
    (p_project_id, 'email', 'Email',     'email',        true,  'john@example.com', true, 1, p_version),
    (p_project_id, 'photo', 'Photo',     'photo_upload', false, '',                 true, 2, p_version)
  ON CONFLICT (project_id, field_key, version) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ── 6. RLS Policies ────────────────────────────────────────
ALTER TABLE public.form_fields    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_uploads ENABLE ROW LEVEL SECURITY;

-- form_fields: public SELECT (needed for public registration forms)
CREATE POLICY "form_fields_select_all" ON public.form_fields
  FOR SELECT USING (true);

-- form_fields: backend (service_role) manages writes
CREATE POLICY "form_fields_service_manage" ON public.form_fields
  FOR ALL USING (true) WITH CHECK (true);

-- member_uploads: public SELECT (signed URL access controlled at storage layer)
CREATE POLICY "member_uploads_select_all" ON public.member_uploads
  FOR SELECT USING (true);

CREATE POLICY "member_uploads_service_manage" ON public.member_uploads
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- DONE. After running:
--   1. Create the 'member-uploads' storage bucket (private) in Supabase Dashboard
--   2. Restart the backend server
-- ═══════════════════════════════════════════════════════════════
