-- Fix: Update waitlist_enabled default to true for existing sessions
-- This migration fixes sessions that were created with waitlist_enabled = false
-- Run this after the initial add_waitlist_enabled migration

-- Update the default value for future sessions
ALTER TABLE public.sessions
ALTER COLUMN waitlist_enabled SET DEFAULT true;

-- Update all existing sessions to have waitlist enabled
UPDATE public.sessions
SET waitlist_enabled = true
WHERE waitlist_enabled = false;

COMMENT ON COLUMN public.sessions.waitlist_enabled IS 'Whether the waiting list feature is enabled for this session. When enabled and session is full, users can join the waitlist. Defaults to true.';

