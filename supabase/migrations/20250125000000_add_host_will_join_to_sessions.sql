-- Add host_will_join column to sessions table
-- This column stores the host's intent to join their own session
-- The actual participant insertion happens only when the session is published

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS host_will_join boolean DEFAULT false;

COMMENT ON COLUMN public.sessions.host_will_join IS 'Host intent to join their own session. Participant is inserted only on publish if this is true.';

