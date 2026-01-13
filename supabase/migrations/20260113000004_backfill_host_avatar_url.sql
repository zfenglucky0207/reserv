-- Backfill sessions.host_avatar_url from Supabase Auth user metadata for existing sessions.
-- This allows public invite pages to show host Google profile pictures without requiring a re-publish.

UPDATE public.sessions s
SET host_avatar_url = COALESCE(
  (u.raw_user_meta_data ->> 'avatar_url'),
  (u.raw_user_meta_data ->> 'picture')
)
FROM auth.users u
WHERE u.id = s.host_id
  AND s.host_avatar_url IS NULL;

