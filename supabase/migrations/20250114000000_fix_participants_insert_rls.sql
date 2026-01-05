-- Fix RLS policy for participants INSERT
-- The issue: RLS policy might be failing due to how it checks the sessions table
-- Solution: Ensure the policy correctly allows inserts for open sessions

-- Drop existing policies
DROP POLICY IF EXISTS "public_insert_participants_open_sessions" ON public.participants;
DROP POLICY IF EXISTS "authenticated_insert_participants_open_sessions" ON public.participants;

-- PUBLIC INSERT: Anonymous users can insert participants for open sessions
-- This includes both 'confirmed' and 'waitlisted' status
-- The policy checks that the session exists and is open
CREATE POLICY "public_insert_participants_open_sessions"
ON public.participants
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE sessions.id = participants.session_id
      AND sessions.status = 'open'
  )
);

-- AUTHENTICATED INSERT: Authenticated users can also insert participants for open sessions
CREATE POLICY "authenticated_insert_participants_open_sessions"
ON public.participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE sessions.id = participants.session_id
      AND sessions.status = 'open'
  )
);

COMMENT ON POLICY "public_insert_participants_open_sessions" ON public.participants IS 
'Allows anonymous users to insert participants (confirmed or waitlisted) for open sessions. The policy verifies the session exists and is open.';

