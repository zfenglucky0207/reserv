-- Note: In Supabase, when using the service role key (SUPABASE_SERVICE_ROLE_KEY),
-- RLS is automatically bypassed at the API level. No explicit database grants are needed.
-- 
-- This migration exists to document this behavior and ensure RLS policies are correctly
-- configured for anon and authenticated users only.
--
-- The service role key bypasses all RLS policies automatically when used with the
-- Supabase client (via createClient from @supabase/supabase-js).

-- Update comment on payment_proofs table to clarify service role behavior
COMMENT ON TABLE public.payment_proofs IS 'Payment proof uploads with RLS enabled. Participants (anon/authenticated) can insert their own proofs. Hosts can read and update payment status for their sessions. Service role key bypasses RLS automatically.';

