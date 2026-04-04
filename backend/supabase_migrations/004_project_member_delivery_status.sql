-- Persist client-side approval delivery progress for project members.
-- This lets the admin dashboard resume or inspect the last known state
-- even after the browser tab is closed.

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS delivery_phase TEXT
    CHECK (
      delivery_phase IS NULL OR delivery_phase IN (
        'queued',
        'generating_pdf',
        'pdf_ready',
        'sending_email',
        'sent',
        'failed_prepare',
        'failed_generate',
        'failed_send',
        'skipped_no_email'
      )
    ),
  ADD COLUMN IF NOT EXISTS delivery_error TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_attempt_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_card_id UUID REFERENCES public.generated_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_verification_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_message_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_pmembers_delivery_phase
  ON public.project_members(delivery_phase);
