# Vercel Join Debugging Guide

## Environment Variables Checklist

Verify these exist in **Vercel Project Settings → Environment Variables**:

### Required Variables
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - **CRITICAL** - Service role key for admin operations

### Verification Steps

1. **Check Vercel Dashboard**:
   - Go to Project → Settings → Environment Variables
   - Ensure all three variables are set for **Production** environment
   - Check for typos or extra quotes

2. **Verify Service Role Key**:
   - The join endpoint uses `createAdminClient()` which requires `SUPABASE_SERVICE_ROLE_KEY`
   - If missing, inserts will fail silently or with 403 errors
   - Get it from: Supabase Dashboard → Settings → API → `service_role` key

3. **Test Locally**:
   ```bash
   # Check if service role key is set
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

## Debugging Steps

### Step 1: Check Vercel Function Logs

After deploying, trigger a join and check **Vercel Dashboard → Functions → `/api/join`**:

Look for these log entries:
- `join_request` - Confirms request received
- `join_supabase_config` - Shows if service role key exists
- `join_waitlist_insert` or `join_participant_insert` - Shows insert result
- `join_success` or `join_participant_insert_failed` - Final outcome

### Step 2: Check Network Tab

In browser DevTools → Network:
1. Find the `POST /api/join` request
2. Check:
   - **Status Code**: Should be 200 (success) or 4xx/5xx (error)
   - **Response Body**: Should contain `{"ok": true, ...}` or error details
   - **Request Payload**: Should include `publicCode`, `name`, `guestKey`

### Step 3: Common Issues

#### Issue: Missing Service Role Key
**Symptoms**: 500 error, "Server configuration error"
**Fix**: Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables

#### Issue: RLS Blocking (Even with Service Role)
**Symptoms**: 403 error, "new row violates row-level security policy"
**Fix**: 
- Verify service role key is correct
- Check that `createAdminClient()` is being used (not regular client)
- Run migration: `supabase/migrations/20250114000000_fix_participants_insert_rls.sql`

#### Issue: Silent Failure
**Symptoms**: Request returns 200 but no participant created
**Fix**: 
- Check logs for `join_participant_insert_no_data`
- Verify Supabase connection is working
- Check if insert is actually executing (look for `join_participant_insert` log)

#### Issue: Edge Runtime Incompatibility
**Symptoms**: Function crashes or times out
**Fix**: 
- Already fixed: `export const runtime = "nodejs"` is set
- Verify it's not being overridden elsewhere

## Expected Log Flow (Success)

```
join_request → join_supabase_config → join_session_lookup → 
join_capacity_check → join_participant_insert → join_success
```

## Expected Log Flow (Failure)

```
join_request → join_supabase_config → [error log] → 
join_participant_insert_failed → [error response]
```

## Quick Test

1. Deploy to Vercel
2. Open browser DevTools → Network tab
3. Try to join a session
4. Check:
   - Network request status
   - Response body
   - Vercel function logs
5. Compare with local behavior

## Next Steps if Still Failing

1. **Check Vercel Logs** for the trace ID from the failed request
2. **Verify Environment Variables** are set correctly
3. **Test Service Role Key** by making a direct Supabase call
4. **Check RLS Policies** in Supabase Dashboard → Authentication → Policies

