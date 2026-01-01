-- Enable RLS on payment_proofs table so policies actually apply
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- Revoke default grants
REVOKE ALL ON TABLE public.payment_proofs FROM anon;
REVOKE ALL ON TABLE public.payment_proofs FROM authenticated;

-- Grant back only what policies will allow
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_proofs TO authenticated;
GRANT SELECT ON TABLE public.payment_proofs TO anon; -- Allow read for public invite pages if needed

-- ============================================================================
-- RLS POLICIES
-- Drop existing policies if they exist (idempotent)
-- ============================================================================

DROP POLICY IF EXISTS "participants_can_insert_own_payment_proofs" ON public.payment_proofs;
DROP POLICY IF EXISTS "hosts_can_select_session_payment_proofs" ON public.payment_proofs;
DROP POLICY IF EXISTS "hosts_can_update_session_payment_proofs" ON public.payment_proofs;
DROP POLICY IF EXISTS "public_can_select_payment_proofs_for_open_sessions" ON public.payment_proofs;

-- PARTICIPANTS: Can insert their own payment proofs for sessions they're participating in
CREATE POLICY "participants_can_insert_own_payment_proofs"
ON public.payment_proofs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.id = payment_proofs.participant_id
      AND p.session_id = payment_proofs.session_id
      -- Allow insert if participant exists (participant_id is validated via FK)
  )
);

-- HOSTS: Can read payment proofs for their own sessions
CREATE POLICY "hosts_can_select_session_payment_proofs"
ON public.payment_proofs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = payment_proofs.session_id
      AND s.host_id = auth.uid()
  )
);

-- HOSTS: Can update payment status for their own sessions
CREATE POLICY "hosts_can_update_session_payment_proofs"
ON public.payment_proofs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = payment_proofs.session_id
      AND s.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = payment_proofs.session_id
      AND s.host_id = auth.uid()
  )
);

-- PUBLIC: Can read payment proofs for open sessions (optional - for display on public invite pages if needed)
-- Commented out by default - uncomment if you want public visibility
-- CREATE POLICY "public_can_select_payment_proofs_for_open_sessions"
-- ON public.payment_proofs
-- FOR SELECT
-- TO anon
-- USING (
--   EXISTS (
--     SELECT 1
--     FROM public.sessions s
--     WHERE s.id = payment_proofs.session_id
--       AND s.status = 'open'
--   )
-- );

-- Add comment
COMMENT ON TABLE public.payment_proofs IS 'Payment proof uploads with RLS enabled. Participants can insert their own proofs. Hosts can read and update payment status for their sessions.';

