-- Add pulled_out status to participant_status enum
ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'pulled_out';

-- Add pull_out_reason and pull_out_seen columns to participants table
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS pull_out_reason text;

ALTER TABLE participants
ADD COLUMN IF NOT EXISTS pull_out_seen boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN participants.pull_out_reason IS 'Reason provided by participant when pulling out from session';
COMMENT ON COLUMN participants.pull_out_seen IS 'Whether the host has seen this pull-out reason (one-time notification)';

