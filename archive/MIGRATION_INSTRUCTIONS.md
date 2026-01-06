# Migration Instructions: Add waitlist_enabled Column

## Step 1: Run SQL Migration in Supabase

1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL:

```sql
-- Add waitlist_enabled column to sessions table
alter table public.sessions
add column if not exists waitlist_enabled boolean not null default false;
```

3. Verify the column was added:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sessions'
  and column_name = 'waitlist_enabled';
```

Expected result:
- `waitlist_enabled`
- `boolean`
- `NOT NULL`
- default: `false`

## Step 2: Regenerate Supabase Types

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
npx supabase login

# Link to your project (replace YOUR_PROJECT_REF with your actual project ref)
npx supabase link --project-ref YOUR_PROJECT_REF

# Generate types
npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > types/supabase.ts
```

### Option B: Using Supabase Dashboard

1. Go to Supabase Dashboard → Settings → API
2. Scroll to "TypeScript types"
3. Copy the generated types
4. Replace the contents of `types/supabase.ts`

### Option C: Manual Update (Already Done)

The types file has been manually updated to include:
- `waitlist_enabled: boolean` in Row
- `waitlist_enabled?: boolean` in Insert and Update
- `public_code: string | null` in Row, Insert, Update
- `host_slug: string | null` in Row, Insert, Update

**Note:** After running the SQL migration, you should regenerate types using Option A or B to ensure they match your actual database schema.

## Step 3: Verify the Fix

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Test the join flow:
   - Navigate to a session invite page
   - Try to join the session
   - Check browser console and server logs for any errors

3. Expected behavior:
   - No `42703` errors (column does not exist)
   - API returns 200 on successful join
   - Logs show `join_session_lookup` with `found: true`
   - UI shows joined state after swipe completes

## Troubleshooting

If you still see errors:

1. **Check if column exists:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'sessions' AND column_name = 'waitlist_enabled';
   ```

2. **Check types file:**
   - Search for `waitlist_enabled` in `types/supabase.ts`
   - It should appear in `sessions.Row`, `sessions.Insert`, and `sessions.Update`

3. **Check API route:**
   - Verify `app/api/join/route.ts` line 49 includes `waitlist_enabled` in the select
   - Check that line 184 uses `sessionRes.data.waitlist_enabled`

4. **Check logs:**
   - Look for `join_session_lookup` log entry
   - Check `errorCode` field - should not be `42703`

