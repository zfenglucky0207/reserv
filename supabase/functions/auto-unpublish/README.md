# Auto-unpublish Expired Sessions

This Edge Function automatically removes (unpublishes) sessions 48 hours after their event end time.

## How it works

1. The function calls the database RPC `auto_unpublish_expired_sessions()`
2. The RPC function finds all sessions where:
   - `status = 'open'` (published/live)
   - `now() >= (end_at + 48 hours)` (or `start_at + 48 hours` if `end_at` is null)
3. These sessions are hard-deleted (same as manual unpublish)
4. FK CASCADE automatically removes:
   - All participants
   - All payment proofs

## Deployment

### 1. Deploy the function

```bash
supabase functions deploy auto-unpublish --no-verify-jwt
```

The `--no-verify-jwt` flag is required because this function uses the service role key and doesn't need authentication.

### 2. Configure the schedule

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to your Supabase project Dashboard
2. Navigate to **Database > Functions > auto-unpublish**
3. Click **"Schedule"** or **"Add Cron Job"**
4. Configure:
   - **Cron expression**: `*/15 * * * *` (runs every 15 minutes)
   - **Timezone**: Your preferred timezone (default is UTC)

**Option B: Via Supabase CLI** (if cron scheduling is supported)
```bash
supabase functions schedule auto-unpublish --cron "*/15 * * * *"
```

### 3. Verify it's working

After deployment, check the function logs in Supabase Dashboard:
1. Go to **Edge Functions > auto-unpublish**
2. Check **Logs** tab
3. You should see entries every 15 minutes showing how many sessions were removed

## Testing manually

You can test the function manually by:

1. **Calling the Edge Function directly:**
   ```bash
   curl -X POST https://[your-project-ref].supabase.co/functions/v1/auto-unpublish \
     -H "Authorization: Bearer [your-anon-key]"
   ```

2. **Or calling the RPC directly in SQL:**
   ```sql
   SELECT public.auto_unpublish_expired_sessions();
   ```

## Important Notes

- The function uses the **service role key** to bypass RLS (required for background jobs)
- The function is **idempotent** - safe to run multiple times
- Sessions must have `start_at` not null (required field)
- The function only acts on `status = 'open'` sessions
- The 48-hour window is calculated from `end_at` if available, otherwise `start_at`

## Monitoring

The function returns:
- `ok: true/false` - whether the operation succeeded
- `removed: number` - count of sessions deleted
- `message: string` - human-readable summary

Check logs regularly to ensure it's running correctly.

