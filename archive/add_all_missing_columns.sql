-- Add all missing columns to sessions table (safe to run multiple times)

-- Add host_name column
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS host_name VARCHAR(40);

-- Add host_slug column
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS host_slug TEXT;

-- Add public_code column
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS public_code TEXT;

-- Create unique index on public_code (for fast lookup and uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_public_code ON public.sessions(public_code)
WHERE public_code IS NOT NULL;

-- Create index on public_code and status for public queries
CREATE INDEX IF NOT EXISTS idx_sessions_public_code_status ON public.sessions(public_code, status)
WHERE public_code IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.sessions.host_name IS 'Custom host display name for this session. If NULL, defaults to user profile name.';
COMMENT ON COLUMN public.sessions.public_code IS 'Unique short code (6 characters) for public invite URL. Generated once when session is published.';
COMMENT ON COLUMN public.sessions.host_slug IS 'URL-friendly slug derived from host name for cosmetic URL purposes. Can change without breaking invites.';

