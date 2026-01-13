-- Add host_joins_session column to sessions table
-- This column stores the host's intent to join their own session.
-- IMPORTANT: This is intent only. The actual participant insertion happens only on publish.

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS host_joins_session boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.sessions.host_joins_session IS
'Host intent to join their own session. This is intent only; the host participant row is created/removed on publish.';

