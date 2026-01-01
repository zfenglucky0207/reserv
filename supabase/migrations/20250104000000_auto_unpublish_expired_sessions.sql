-- Auto-unpublish expired sessions 48 hours after event end time
-- This function deletes sessions that:
--   - Have status = 'open' (published/live)
--   - Have passed their end time + 48 hours
--   - Uses end_at if available, otherwise falls back to start_at
--
-- Behavior matches manual unpublish: hard-delete session row
-- FK CASCADE deletes will automatically remove:
--   - All participants (via participants_session_id_fkey)
--   - All payment_proofs (via payment_proofs_session_id_fkey)
--
-- This function is idempotent and safe to run multiple times.

CREATE OR REPLACE FUNCTION public.auto_unpublish_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete eligible sessions:
  --   - status = 'open' (must be published)
  --   - now() >= (coalesce(end_at, start_at) + interval '48 hours')
  --   - start_at must not be null (required field)
  WITH eligible_sessions AS (
    SELECT id
    FROM public.sessions
    WHERE status = 'open'
      AND start_at IS NOT NULL
      AND now() >= (
        COALESCE(end_at, start_at)::timestamptz + interval '48 hours'
      )
  ),
  deleted_sessions AS (
    DELETE FROM public.sessions s
    USING eligible_sessions e
    WHERE s.id = e.id
    RETURNING s.id
  )
  SELECT COUNT(*) INTO deleted_count
  FROM deleted_sessions;

  -- Return count of deleted sessions (for logging/observability)
  RETURN deleted_count;
END;
$$;

-- Lock down execution: only service role / postgres can call it
-- This prevents regular users from calling it directly
REVOKE ALL ON FUNCTION public.auto_unpublish_expired_sessions() FROM public;
GRANT EXECUTE ON FUNCTION public.auto_unpublish_expired_sessions() TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.auto_unpublish_expired_sessions() IS 
  'Automatically unpublishes (deletes) sessions 48 hours after their end time. '
  'Matches manual unpublish behavior: hard-deletes session row, CASCADE removes dependent data. '
  'Should be called by a scheduled Edge Function every 15 minutes. '
  'Returns the number of sessions that were deleted.';

-- Create index to optimize the query (if not already exists)
-- This helps with performance when checking expiration status
CREATE INDEX IF NOT EXISTS idx_sessions_status_start_end 
ON public.sessions(status, start_at, end_at)
WHERE status = 'open';

COMMENT ON INDEX idx_sessions_status_start_end IS 
  'Index to optimize auto-unpublish query for finding expired sessions';

