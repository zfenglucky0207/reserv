# Waitlist Schema Validation Report

## ⚠️ Supabase MCP Authentication Required

**Status**: Supabase MCP tools require authentication via `SUPABASE_ACCESS_TOKEN` or `--access-token` flag.

**Error encountered**:
```
Unauthorized. Please provide a valid access token to the MCP server via the --access-token flag or SUPABASE_ACCESS_TOKEN.
```

**Action Required**: Configure Supabase MCP authentication to proceed with live database validation.

---

## ✅ Code-Based Schema Validation

### Step 1: Schema Analysis from Types & Migrations

#### `sessions` Table
- **Column**: `waitlist_enabled` (boolean, NOT NULL, DEFAULT true)
- **Source**: 
  - `types/supabase.ts` line 271: `waitlist_enabled: boolean`
  - Migrations:
    - `supabase/migrations/add_waitlist_enabled.sql`
    - `supabase/migrations/fix_waitlist_enabled_default.sql`
    - `supabase/migrations/20250112000000_add_waitlist_enabled_to_sessions.sql`
- **Status**: ✅ Column exists in types

#### `participants` Table
- **Column**: `status` (enum: `participant_status`)
- **Enum Values**: `"invited" | "confirmed" | "cancelled" | "waitlisted"`
- **Source**: `types/supabase.ts` line 355
- **Status**: ✅ `waitlisted` status exists in enum

#### Key Columns Referenced in Code:
- `sessions.waitlist_enabled` - ✅ Referenced in `app/api/join/route.ts` line 181, 291, 312, 380, 388, 401, 419, 638
- `participants.status` - ✅ Used with `"waitlisted"` value in multiple places
- `participants.display_name` - ✅ Used for public display
- `participants.guest_key` - ✅ Used for guest identification

---

### Step 2: Migration Validation

#### Applied Migrations (from file system):
1. ✅ `20250112000000_add_waitlist_enabled_to_sessions.sql` - Adds `waitlist_enabled` column
2. ✅ `add_waitlist_enabled.sql` - Adds column with default true
3. ✅ `fix_waitlist_enabled_default.sql` - Ensures default is true
4. ✅ `20250101000000_enable_rls_participants.sql` - Enables RLS on participants
5. ✅ `20250114000000_fix_participants_insert_rls.sql` - Fixes INSERT policy
6. ✅ `20250115000000_allow_public_read_waitlisted_participants.sql` - **NEW**: Allows public read of waitlisted participants

**Note**: Migration #6 needs to be applied to the live database.

---

### Step 3: Query Validation

#### ✅ Fixed Issues:
1. **Public Invite Page** (`app/[hostSlug]/[code]/page.tsx`):
   - Changed from `.select("*")` to explicit field list (line 125)
   - Includes `waitlist_enabled` in select list
   - Queries participants with `.in("status", ["confirmed", "waitlisted"])` (line 161)

2. **Join API Route** (`app/api/join/route.ts`):
   - Uses explicit select: `"id, status, capacity, public_code, host_id, host_slug, waitlist_enabled"` (line 181)
   - Uses admin client for inserts (bypasses RLS)
   - Properly handles waitlist logic when session is full

#### ⚠️ Remaining `.select("*")` Usage:
These are in protected/host routes (not public), so lower risk:
- `app/api/join/route.ts` lines 275, 364 - Used for count queries (head: true, safe)
- `app/host/sessions/[id]/actions.ts` line 881 - Host route
- `app/session/[id]/actions.ts` line 171 - Count query
- `app/host/sessions/[id]/edit/page.tsx` line 28 - Host route
- `app/host/settings/actions.ts` line 34 - Host route
- `app/session/[id]/page.tsx` line 19 - Host route
- `app/actions/drafts.ts` lines 94, 134 - Host route
- `app/s/[code]/page.tsx` line 39 - Needs review (may be public)

---

### Step 4: RLS Policy Analysis

#### Current Policies (from migrations):

**Participants Table**:
1. ✅ `public_insert_participants_open_sessions` - Allows anon INSERT for open sessions
2. ✅ `authenticated_insert_participants_open_sessions` - Allows authenticated INSERT for open sessions
3. ⚠️ `public_select_confirmed_participants_open_sessions` - **ISSUE**: Only allows `status = 'confirmed'`
4. ✅ `host_select_all_participants_own_sessions` - Hosts can read all participants
5. ✅ `host_update_participants_own_sessions` - Hosts can update
6. ✅ `host_delete_participants_own_sessions` - Hosts can delete

#### 🔧 Fix Applied:
Created migration `20250115000000_allow_public_read_waitlisted_participants.sql`:
- Drops old policy that only allowed `confirmed`
- Creates new policy allowing both `confirmed` and `waitlisted` status
- Enables public invite page to display waitlist

**Status**: Migration created, needs to be applied to live database.

---

### Step 5: Code Logic Validation

#### Waitlist Insert Logic (`app/api/join/route.ts`):

1. ✅ Session lookup includes `waitlist_enabled` (line 181)
2. ✅ Capacity check counts only `confirmed` participants (lines 275, 364)
3. ✅ Waitlist logic:
   - Checks if session is full (line 291)
   - Checks if `waitlist_enabled !== false` (line 291)
   - Sets `newStatus = "waitlisted"` when full (line 306)
4. ✅ Insert uses admin client (bypasses RLS) (line 473)
5. ✅ Status enum value matches: `"waitlisted"` (line 464)
6. ✅ Comprehensive logging added (lines 440-519)

#### Public Invite Page Logic (`app/[hostSlug]/[code]/page.tsx`):

1. ✅ Fetches session with explicit fields including `waitlist_enabled`
2. ✅ Queries participants with `.in("status", ["confirmed", "waitlisted"])`
3. ✅ Separates confirmed vs waitlisted (lines 169-170)
4. ✅ Passes both to `PublicSessionView` component

---

### Step 6: Type Safety Validation

#### ✅ TypeScript Types Match:
- `sessions.waitlist_enabled: boolean` - ✅ Matches code usage
- `participants.status: "waitlisted"` - ✅ In enum, matches code usage
- All queries use typed Supabase client

#### ⚠️ Potential Issues:
None found - all references to `waitlist_enabled` and `waitlisted` status are consistent.

---

## 📋 Action Items

### Immediate (Requires Supabase MCP Access):
1. **Authenticate Supabase MCP** - Configure `SUPABASE_ACCESS_TOKEN`
2. **Apply Migration** - Run `20250115000000_allow_public_read_waitlisted_participants.sql`
3. **Validate Live Schema** - Use MCP to confirm:
   - `sessions.waitlist_enabled` column exists
   - `participants.status` enum includes `waitlisted`
   - RLS policies match expected behavior
4. **Test Queries** - Use MCP SQL runner to:
   - Insert waitlist participant
   - Query waitlist participants
   - Verify RLS allows public read

### Code Changes Made:
1. ✅ Fixed public invite page to use explicit field selection
2. ✅ Created RLS policy migration for waitlisted participants
3. ✅ Validated all `waitlist_enabled` references exist in types

### Files Changed:
- `app/[hostSlug]/[code]/page.tsx` - Changed `.select("*")` to explicit fields
- `supabase/migrations/20250115000000_allow_public_read_waitlisted_participants.sql` - NEW

---

## 🧪 Test Plan (Once MCP Access Available)

### Test 1: Schema Validation
```sql
-- Verify waitlist_enabled column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessions'
  AND column_name = 'waitlist_enabled';
```

### Test 2: Enum Validation
```sql
-- Verify waitlisted is in enum
SELECT unnest(enum_range(NULL::participant_status)) AS status;
```

### Test 3: Waitlist Insert
```sql
-- Insert waitlist participant (using admin client or service role)
INSERT INTO participants (session_id, display_name, status, guest_key)
VALUES (
  (SELECT id FROM sessions WHERE public_code = 'TEST' LIMIT 1),
  'Test Waitlist User',
  'waitlisted',
  'test-guest-key-123'
)
RETURNING id, status;
```

### Test 4: Public Read (RLS)
```sql
-- As anonymous user, verify can read waitlisted participants
SET ROLE anon;
SELECT id, display_name, status
FROM participants
WHERE status = 'waitlisted'
  AND EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = participants.session_id
      AND sessions.status = 'open'
  );
```

### Test 5: Capacity Logic
```sql
-- Verify confirmed count excludes waitlisted
SELECT COUNT(*) as confirmed_count
FROM participants
WHERE session_id = 'SESSION_ID'
  AND status = 'confirmed';
```

---

## ✅ Summary

**Code Validation**: ✅ PASS
- All schema references match types
- No missing columns detected
- Query logic is correct
- RLS policy fix created

**Database Validation**: ⏸️ PENDING
- Requires Supabase MCP authentication
- Migration needs to be applied
- Live schema needs verification

**Next Steps**:
1. Configure Supabase MCP authentication
2. Apply migration `20250115000000_allow_public_read_waitlisted_participants.sql`
3. Run test queries via MCP SQL runner
4. Regenerate types if schema differs

