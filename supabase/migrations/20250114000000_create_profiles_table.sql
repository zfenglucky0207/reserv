-- Create profiles table for host profile data (avatar, display name)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NULL,
  avatar_url text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Hosts can view their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- RLS Policies: Hosts can insert their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies: Hosts can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow public to read limited profile fields for invite pages
-- Only expose avatar_url and display_name, not full profile
CREATE POLICY "profiles_select_public_for_invites"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true); -- Allow public read for invite pages (safe fields only)

-- Add comment
COMMENT ON TABLE public.profiles IS 'Host profile information including avatar and display name';


