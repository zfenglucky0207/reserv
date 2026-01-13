-- Add price column to sessions table (cost per person)
-- NULL means TBD. 0 means Free.

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS price integer;

COMMENT ON COLUMN public.sessions.price IS
'Cost per person (integer dollars). NULL = TBD, 0 = Free.';

