-- Fix RLS policy for payment_proofs to properly support guest inserts
-- The current policy only applies to 'anon' role, but we need a unified policy
-- that works for both guests (anon) and authenticated users

-- Drop existing policies
DROP POLICY IF EXISTS "participants_can_insert_own_payment_proofs_anon" ON public.payment_proofs;
DROP POLICY IF EXISTS "participants_can_insert_own_payment_proofs" ON public.payment_proofs;

-- Create unified policy for both anon and authenticated users
-- This allows guests AND logged-in users to insert payment proofs
-- Based on participant_id validation, NOT auth.uid()
CREATE POLICY "participants_can_upload_payment_proof"
ON public.payment_proofs
FOR INSERT
TO public -- Applies to both anon and authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.id = payment_proofs.participant_id
      AND p.session_id = payment_proofs.session_id
      -- Additional validation: session must be open
      AND EXISTS (
        SELECT 1
        FROM public.sessions s
        WHERE s.id = p.session_id
          AND s.status = 'open'
      )
  )
);

-- Ensure anon role has INSERT permission
GRANT INSERT ON TABLE public.payment_proofs TO anon;

-- Ensure authenticated role has INSERT permission
GRANT INSERT ON TABLE public.payment_proofs TO authenticated;

COMMENT ON POLICY "participants_can_upload_payment_proof" ON public.payment_proofs IS 'Allows both guests (anon) and authenticated users to insert payment proofs. Validates participant exists, belongs to session, and session is open. Based on participant_id, not auth.uid().';

