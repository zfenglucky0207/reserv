-- Add source_session_id column to session_drafts table
-- This links a draft to the source session it was saved from (for analytics page guard modal)

ALTER TABLE public.session_drafts 
ADD COLUMN IF NOT EXISTS source_session_id uuid NULL;

-- Add comment
COMMENT ON COLUMN public.session_drafts.source_session_id IS 'Links draft to the source session it was saved from. Used to determine if a session has been saved to drafts.';

