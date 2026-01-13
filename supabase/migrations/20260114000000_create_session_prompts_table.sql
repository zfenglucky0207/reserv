-- Create session_prompts table for contextual WhatsApp share dialogs
-- Tracks attendance reminders and payment summaries with configurable timing

CREATE TABLE IF NOT EXISTS public.session_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('attendance_reminder', 'payment_summary')),
  default_offset_minutes int NOT NULL,
  custom_offset_minutes int NULL,
  shown_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint to ensure one prompt per type per session
CREATE UNIQUE INDEX IF NOT EXISTS session_prompts_session_type_unique
ON public.session_prompts (session_id, type);

-- Create index for efficient queries by session_id
CREATE INDEX IF NOT EXISTS idx_session_prompts_session_id
ON public.session_prompts (session_id);

-- Enable RLS
ALTER TABLE public.session_prompts ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_prompts TO authenticated;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- SELECT: Users can see prompts for sessions where they are a host (owner or host role)
CREATE POLICY "session_prompts_select_via_hosts"
ON public.session_prompts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = session_prompts.session_id
    AND sh.user_id = auth.uid()
  )
);

-- INSERT: Users can insert prompts for sessions where they are a host
CREATE POLICY "session_prompts_insert_via_hosts"
ON public.session_prompts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = session_prompts.session_id
    AND sh.user_id = auth.uid()
  )
);

-- UPDATE: Users can update prompts for sessions where they are a host
CREATE POLICY "session_prompts_update_via_hosts"
ON public.session_prompts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = session_prompts.session_id
    AND sh.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = session_prompts.session_id
    AND sh.user_id = auth.uid()
  )
);

-- DELETE: Users can delete prompts for sessions where they are a host
CREATE POLICY "session_prompts_delete_via_hosts"
ON public.session_prompts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = session_prompts.session_id
    AND sh.user_id = auth.uid()
  )
);

-- Add comments
COMMENT ON TABLE public.session_prompts IS 'Tracks contextual WhatsApp share dialogs for sessions. Attendance reminders (before session) and payment summaries (after session).';
COMMENT ON COLUMN public.session_prompts.type IS 'Type of prompt: attendance_reminder (before session) or payment_summary (after session)';
COMMENT ON COLUMN public.session_prompts.default_offset_minutes IS 'Default timing offset in minutes. Negative for before session start, positive for after session end.';
COMMENT ON COLUMN public.session_prompts.custom_offset_minutes IS 'Custom timing offset that overrides default. NULL means use default. Set to NULL to disable prompt.';
COMMENT ON COLUMN public.session_prompts.shown_at IS 'Timestamp when dialog was shown and message was copied/shared. Prevents auto-showing again.';
COMMENT ON COLUMN public.session_prompts.dismissed_at IS 'Timestamp when dialog was dismissed. Prevents auto-showing again.';
