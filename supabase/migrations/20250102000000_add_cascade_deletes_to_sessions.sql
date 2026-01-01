-- Add CASCADE deletes to foreign key constraints for session-dependent tables
-- This ensures that when a session is deleted, all related participant and payment data is automatically removed
--
-- Dependent tables that reference sessions:
-- 1. participants (via participants_session_id_fkey)
-- 2. payment_proofs (via payment_proofs_session_id_fkey)

-- ============================================================================
-- PARTICIPANTS TABLE
-- ============================================================================

-- Drop existing FK constraint if it exists
ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_session_id_fkey;

-- Recreate FK constraint with CASCADE delete
ALTER TABLE public.participants
  ADD CONSTRAINT participants_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.sessions(id)
  ON DELETE CASCADE;

-- ============================================================================
-- PAYMENT_PROOFS TABLE
-- ============================================================================

-- Drop existing FK constraint if it exists
ALTER TABLE public.payment_proofs
  DROP CONSTRAINT IF EXISTS payment_proofs_session_id_fkey;

-- Recreate FK constraint with CASCADE delete
ALTER TABLE public.payment_proofs
  ADD CONSTRAINT payment_proofs_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.sessions(id)
  ON DELETE CASCADE;

-- Add comment
COMMENT ON CONSTRAINT participants_session_id_fkey ON public.participants IS 'Cascades delete: when a session is deleted, all participants are automatically removed';
COMMENT ON CONSTRAINT payment_proofs_session_id_fkey ON public.payment_proofs IS 'Cascades delete: when a session is deleted, all payment proofs are automatically removed';

