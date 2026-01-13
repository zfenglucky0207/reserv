-- Add is_host flag to participants table
-- Host participants should be excluded from payment selection flows.

ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS is_host boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.participants.is_host IS
'True if this participant row represents the host (auto-inserted on publish when host_joins_session is true). Hosts are excluded from payment-selection UX.';

-- Best-effort backfill: mark existing host participants (if any)
-- We consider a participant to be the host if profile_id matches sessions.host_id (stored as text).
UPDATE public.participants p
SET is_host = true
FROM public.sessions s
WHERE p.session_id = s.id
  AND p.profile_id IS NOT NULL
  AND p.profile_id = s.host_id::text;

