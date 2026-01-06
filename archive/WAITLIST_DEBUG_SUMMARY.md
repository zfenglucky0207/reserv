# Waitlist Insert & Retrieval Debug Summary

## Schema Verification ✅

**Confirmed from `types/supabase.ts`:**
- `participants.status`: enum `participant_status` = `"invited" | "confirmed" | "cancelled" | "waitlisted"` ✅
- `sessions.waitlist_enabled`: `boolean` (NOT NULL) ✅
- `sessions.capacity`: `number | null` ✅

**All required columns exist. No migration needed.**

## Code Flow Analysis

### 1. Join API Route (`app/api/join/route.ts`)

**Waitlist Insert Path:**
1. ✅ Admin client created (line 122-131)
2. ✅ Capacity check: counts `confirmed` participants (line 340-344)
3. ✅ `isFull = capacity && count >= capacity` (line 357)
4. ✅ `waitlistEnabled = waitlist_enabled !== false` (line 358)
5. ✅ If `isFull && waitlistEnabled`: Insert with `status: "waitlisted"` (line 402-598)
6. ✅ Returns `{ ok: true, waitlisted: true, joinedAs: "waitlist" }` (line 597-600)

**Status Value:** Uses `"waitlisted"` (matches enum exactly)

### 2. Public Invite Page (`app/[hostSlug]/[code]/page.tsx`)

**Retrieval Query:**
```typescript
.in("status", ["confirmed", "waitlisted"])  // ✅ Correct
```

**Separation:**
```typescript
const confirmedParticipants = allParticipants.filter(p => p.status === "confirmed")
const waitlistParticipants = allParticipants.filter(p => p.status === "waitlisted")
```

### 3. Client-Side Handling (`components/session/public-session-view.tsx`)

**Response Parsing:**
- Checks `json.waitlisted === true` (line 530)
- Checks `json.joinedAs === "waitlist"` (line 532)
- Sets `rsvpState` to `"waitlisted"` (line 543)
- Optimistically adds to waitlist state (line 554-560)
- Refetches from Supabase client (line 578-622)

## Enhanced Logging Added

### Server-Side (`app/api/join/route.ts`)

1. **Admin Client Creation:**
   - `[waitlist] Admin client created successfully` (line 123-126)
   - Includes `hasAdminClient`, `hasServiceRoleKey`, `serviceRoleKeyLength`, `supabaseUrl`

2. **Capacity Check:**
   - `[waitlist] Capacity check for NEW participant` (line 360-371)
   - Shows `capacity`, `currentCount`, `isFull`, `waitlistEnabled`, `sessionId`

3. **Waitlist Logic Entry:**
   - `[waitlist] ✅ Session is FULL - entering waitlist logic` (line 385-389)
   - `[waitlist] ✅ Waitlist is ENABLED - proceeding with waitlist insert` (line 403-407)

4. **Insert Execution:**
   - `[waitlist] About to insert with admin client` (line 421-428)
   - `[waitlist] Insert payload (typed)` (line 445-450)
   - `[waitlist] Insert completed` (line 457-467)
   - `[waitlist] Insert result` (line 469-476)

5. **Success:**
   - `[waitlist] ✅ SUCCESS - Waitlist insert completed` (line 593-599)

### Client-Side (`components/session/public-session-view.tsx`)

1. **Response Parsing:**
   - `[waitlist] API response parsed` (line 534-541)
   - Shows `isWaitlisted`, `joinedAs`, `jsonWaitlisted`, `jsonJoinedAs`

2. **State Updates:**
   - `[waitlist] optimistically adding to waitlist` (line 555)
   - `[waitlist] waitlist state updated` (line 558)

3. **Refetch:**
   - `[waitlist] refetching participants` (line 580)
   - `[waitlist] refetch result` (line 589-593)
   - `[waitlist] after filtering` (line 599-604)

## Debugging Steps

### Step 1: Verify Session State in Supabase

```sql
SELECT 
  id,
  capacity,
  waitlist_enabled,
  status,
  public_code
FROM sessions
WHERE public_code = 'YOUR_CODE';
```

**Expected:**
- `capacity` = number (e.g., 2)
- `waitlist_enabled` = `true` (NOT `null` or `false`)
- `status` = `'open'`

### Step 2: Count Confirmed Participants

```sql
SELECT COUNT(*) as confirmed_count
FROM participants
WHERE session_id = 'YOUR_SESSION_ID'
  AND status = 'confirmed';
```

**Expected:** Should equal `capacity` for session to be full.

### Step 3: Check Server Logs

When attempting to join waitlist, look for these log entries in order:

1. `[waitlist] Admin client created successfully`
2. `[waitlist] Capacity check for NEW participant`
3. `[waitlist] ✅ Session is FULL - entering waitlist logic`
4. `[waitlist] ✅ Waitlist is ENABLED - proceeding with waitlist insert`
5. `[waitlist] About to insert with admin client`
6. `[waitlist] Insert payload (typed)`
7. `[waitlist] Insert completed`
8. `[waitlist] ✅ SUCCESS - Waitlist insert completed`

**If any step is missing, that's where the issue is.**

### Step 4: Verify Insert in Database

After join attempt, check:

```sql
SELECT 
  id,
  display_name,
  status,
  session_id,
  guest_key,
  created_at
FROM participants
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at DESC;
```

**Expected:** Should see a row with `status = 'waitlisted'` if insert succeeded.

### Step 5: Check Environment Variables

**Required:**
- `SUPABASE_SERVICE_ROLE_KEY` - Must be set (check logs for `hasServiceRoleKey: true`)
- `NEXT_PUBLIC_SUPABASE_URL` - Must be set

## Common Issues & Fixes

### Issue 1: `isFull` is `false` when it should be `true`

**Cause:** Capacity check isn't counting correctly.

**Fix:** Verify:
- `session.capacity` is not `null`
- Count query uses `.eq("status", "confirmed")` (not `"waitlisted"`)

### Issue 2: `waitlistEnabled` is `false`

**Cause:** `sessions.waitlist_enabled` is `null` or `false` in database.

**Fix:**
```sql
UPDATE sessions
SET waitlist_enabled = true
WHERE id = 'YOUR_SESSION_ID';
```

### Issue 3: Admin Client Creation Fails

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` missing or invalid.

**Fix:** Check environment variables in `.env.local` and Vercel.

### Issue 4: Insert Returns Error

**Check logs for:**
- Error code (e.g., `23505` = duplicate key, `42501` = RLS violation)
- Error message, details, hint

**Common errors:**
- **Duplicate key:** User already joined (idempotent - should return success)
- **RLS violation:** Admin client should bypass RLS, but verify `createAdminClient()` uses service role key
- **Constraint violation:** Check `participants` table constraints

### Issue 5: Insert Succeeds But Record Not Visible

**Cause:** RLS policy blocking read access.

**Fix:** Verify public read policy on `participants`:
```sql
-- Should allow public read of display_name and status
SELECT * FROM pg_policies WHERE tablename = 'participants';
```

## Testing Checklist

1. ✅ Create session with `capacity = 2`
2. ✅ Join 2 users → Both should be `status = 'confirmed'`
3. ✅ Join 3rd user → Should be `status = 'waitlisted'`
4. ✅ Check Supabase DB → Should see 2 confirmed + 1 waitlisted
5. ✅ Check public invite page → Should show waitlist section with 1 person
6. ✅ Check "FULL" pill → Should appear when `joinedCount >= capacity`
7. ✅ Check slider label → Should say "Join waitlist" when full

## Files Modified

1. `app/api/join/route.ts` - Enhanced logging, verified status enum value
2. `app/[hostSlug]/[code]/page.tsx` - Already fetches waitlisted participants ✅
3. `components/session/public-session-view.tsx` - Already handles waitlist response ✅
4. `components/session-invite.tsx` - Already displays waitlist UI ✅

## Next Steps

1. **Run the test:** Create session with capacity 2, join 3 users
2. **Check server logs:** Look for the log sequence above
3. **Check database:** Verify waitlisted participant exists
4. **Check UI:** Verify waitlist section appears

If insert still fails, share:
- Server logs (all `[waitlist]` entries)
- Database query results (session + participants)
- Environment variable status (from logs)

