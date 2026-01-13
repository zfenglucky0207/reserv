-- Update sessions RLS policies to check session_hosts instead of host_id
-- This enables multi-host access control while maintaining backward compatibility

-- Drop existing host-based policies
DROP POLICY IF EXISTS "host_select_own_sessions" ON public.sessions;
DROP POLICY IF EXISTS "host_insert_own_sessions" ON public.sessions;
DROP POLICY IF EXISTS "host_update_own_sessions" ON public.sessions;
DROP POLICY IF EXISTS "host_delete_own_sessions" ON public.sessions;

-- Keep public access policy (unchanged)
-- Public access policy remains the same - anonymous users can read open sessions

-- HOST ACCESS: Authenticated users can read sessions where they are a host (owner or host role)
CREATE POLICY "sessions_select_via_hosts"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  status = 'open' -- Public sessions
  OR EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = sessions.id
    AND sh.user_id = auth.uid()
  )
);

-- HOST ACCESS: Authenticated users can insert sessions for themselves
-- On insert, application logic will create the owner row in session_hosts
CREATE POLICY "sessions_insert_own"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (host_id = auth.uid());

-- HOST ACCESS: Authenticated users can update sessions where they are a host
CREATE POLICY "sessions_update_via_hosts"
ON public.sessions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = sessions.id
    AND sh.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = sessions.id
    AND sh.user_id = auth.uid()
  )
);

-- OWNER ONLY: Only owners can delete sessions
CREATE POLICY "sessions_delete_owner_only"
ON public.sessions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = sessions.id
    AND sh.user_id = auth.uid()
    AND sh.role = 'owner'
  )
);

-- Update comment
COMMENT ON TABLE public.sessions IS 'Session invites with RLS enabled. Public (anon) can only read open sessions. Hosts (authenticated) can manage sessions where they have access via session_hosts table.';
