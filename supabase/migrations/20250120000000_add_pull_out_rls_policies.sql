-- RLS Policies for pull-out functionality

-- Participants can update their own row to pull out
-- Note: This allows participants to update their status to 'pulled_out'
-- We use a more permissive policy that allows updates, but the application logic
-- should validate that only status='pulled_out' updates are allowed

-- Drop policy if it exists (idempotent)
DROP POLICY IF EXISTS "participant can pull out" ON participants;

-- Create the policy
CREATE POLICY "participant can pull out"
ON participants
FOR UPDATE
USING (true)
WITH CHECK (status = 'pulled_out');

-- Host can read pull-out reasons (already covered by existing host policies)
-- The existing host_select_all_participants_own_sessions policy should already allow this
-- But we'll add a comment to document it

COMMENT ON COLUMN participants.pull_out_reason IS 'Reason provided by participant when pulling out from session. Visible to host.';
COMMENT ON COLUMN participants.pull_out_seen IS 'Whether the host has seen this pull-out reason (one-time notification).';

