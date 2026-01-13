-- Create session_hosts table for multi-host role-based access control
-- This table manages explicit access control per session with owner/host roles

CREATE TABLE IF NOT EXISTS public.session_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('owner', 'host')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create unique constraint to prevent duplicate invites per session
CREATE UNIQUE INDEX IF NOT EXISTS session_hosts_session_email_unique
ON public.session_hosts (session_id, email);

-- Create unique partial index to enforce one owner per session
CREATE UNIQUE INDEX IF NOT EXISTS session_hosts_session_owner_unique
ON public.session_hosts (session_id)
WHERE role = 'owner';

-- Create index for efficient queries by user_id
CREATE INDEX IF NOT EXISTS idx_session_hosts_user_id
ON public.session_hosts (user_id)
WHERE user_id IS NOT NULL;

-- Create index for efficient queries by email (for pending invites)
CREATE INDEX IF NOT EXISTS idx_session_hosts_email
ON public.session_hosts (email)
WHERE user_id IS NULL;

-- Create index for efficient queries by session_id
CREATE INDEX IF NOT EXISTS idx_session_hosts_session_id
ON public.session_hosts (session_id);

-- Enable RLS
ALTER TABLE public.session_hosts ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_hosts TO authenticated;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- SELECT: Users can see rows where they are the user_id OR where email matches their auth email (for pending invites)
CREATE POLICY "session_hosts_select_own_or_pending"
ON public.session_hosts
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR (user_id IS NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
);

-- INSERT: Only owners can invite (check via session_hosts where role = 'owner' and user_id = auth.uid())
CREATE POLICY "session_hosts_insert_owner_only"
ON public.session_hosts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = session_hosts.session_id
    AND sh.role = 'owner'
    AND sh.user_id = auth.uid()
  )
);

-- UPDATE: Users can update their own row (when accepting invite by linking user_id)
-- Also allow owners to update host rows (for removing hosts)
CREATE POLICY "session_hosts_update_own_or_owner"
ON public.session_hosts
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    role = 'host'
    AND EXISTS (
      SELECT 1 FROM public.session_hosts sh
      WHERE sh.session_id = session_hosts.session_id
      AND sh.role = 'owner'
      AND sh.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR (
    role = 'host'
    AND EXISTS (
      SELECT 1 FROM public.session_hosts sh
      WHERE sh.session_id = session_hosts.session_id
      AND sh.role = 'owner'
      AND sh.user_id = auth.uid()
    )
  )
);

-- DELETE: Only owners can delete host rows (not their own owner row)
CREATE POLICY "session_hosts_delete_owner_only"
ON public.session_hosts
FOR DELETE
TO authenticated
USING (
  role = 'host'
  AND EXISTS (
    SELECT 1 FROM public.session_hosts sh
    WHERE sh.session_id = session_hosts.session_id
    AND sh.role = 'owner'
    AND sh.user_id = auth.uid()
  )
);

-- Add comment
COMMENT ON TABLE public.session_hosts IS 'Manages multi-host access control for sessions. Each session has exactly one owner and can have multiple hosts (editors).';

-- ============================================================================
-- BACKFILL: Create owner rows for all existing sessions
-- ============================================================================

INSERT INTO public.session_hosts (session_id, email, user_id, role, invited_at, accepted_at)
SELECT 
  s.id as session_id,
  COALESCE(
    (SELECT email FROM auth.users WHERE id = s.host_id),
    'unknown@example.com' -- Fallback for sessions without valid user email
  ) as email,
  s.host_id as user_id,
  'owner' as role,
  s.created_at as invited_at,
  s.created_at as accepted_at
FROM public.sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM public.session_hosts sh
  WHERE sh.session_id = s.id
  AND sh.role = 'owner'
)
ON CONFLICT (session_id, email) DO NOTHING;

-- Add comment explaining the backfill
COMMENT ON COLUMN public.session_hosts.email IS 'Email of invited user. Used for pending invites before user signs up.';
COMMENT ON COLUMN public.session_hosts.user_id IS 'User ID once user signs up/logs in. NULL for pending invites.';
COMMENT ON COLUMN public.session_hosts.role IS 'Role: owner (can unpublish/delete) or host (editor, cannot unpublish/delete).';
COMMENT ON COLUMN public.session_hosts.accepted_at IS 'Timestamp when user_id was linked (user signed up/logged in).';
