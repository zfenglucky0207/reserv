-- Backfill host participant rows for already-published sessions.
-- If host_joins_session is true, ensure the host has a participant row (is_host=true).
-- This is safe and idempotent.

INSERT INTO public.participants (
  session_id,
  display_name,
  status,
  profile_id,
  is_host
)
SELECT
  s.id as session_id,
  COALESCE(NULLIF(s.host_name, ''), 'Host') as display_name,
  'confirmed'::participant_status as status,
  s.host_id::text as profile_id,
  true as is_host
FROM public.sessions s
WHERE s.status = 'open'
  AND COALESCE(s.host_joins_session, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.session_id = s.id
      AND p.profile_id = s.host_id::text
  );

