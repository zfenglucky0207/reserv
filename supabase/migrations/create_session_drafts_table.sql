-- Create session_drafts table for storing user draft sessions
CREATE TABLE IF NOT EXISTS public.session_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_session_drafts_user_updated 
  ON public.session_drafts(user_id, updated_at DESC);

-- Optional: unique constraint on (user_id, name) to prevent duplicate names
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_session_drafts_user_name 
--   ON public.session_drafts(user_id, name);

-- Enable RLS
ALTER TABLE public.session_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: users can only see their own drafts
CREATE POLICY "Users can view their own drafts"
  ON public.session_drafts FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can only create drafts for themselves
CREATE POLICY "Users can create their own drafts"
  ON public.session_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own drafts
CREATE POLICY "Users can update their own drafts"
  ON public.session_drafts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own drafts
CREATE POLICY "Users can delete their own drafts"
  ON public.session_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.session_drafts IS 'Stores draft session data for authenticated users. Max 2 drafts per user enforced in application logic.';


