-- Migration: Add waitlist_enabled column to sessions table
-- This fixes the 500 error when joining sessions
-- Defaults to true (waitlist enabled by default)

alter table public.sessions
add column if not exists waitlist_enabled boolean not null default true;

-- Update existing sessions to have waitlist enabled (if column was just added)
-- This ensures all existing sessions have waitlist enabled
update public.sessions
set waitlist_enabled = true
where waitlist_enabled = false;

-- Verify the column was added
-- Run this separately to confirm:
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'sessions'
--   and column_name = 'waitlist_enabled';

