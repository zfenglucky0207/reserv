# Waitlist Schema Validation Summary

## ⚠️ Critical: Supabase MCP Authentication Required

**Status**: Supabase MCP tools require authentication. Error encountered:
```
Unauthorized. Please provide a valid access token to the MCP server via the --access-token flag or SUPABASE_ACCESS_TOKEN.
```

**To proceed with live database validation**, configure Supabase MCP authentication.

---

## ✅ Code-Based Validation (Completed)

### Schema Verification from Types & Migrations

#### ✅ `sessions.waitlist_enabled`
- **Type**: `boolean` (NOT NULL, DEFAULT true)
- **References**: Found in 8 locations in `app/api/join/route.ts`
- **Status**: Column exists in `types/supabase.ts` line 271

#### ✅ `participants.status` Enum
- **Values**: `"invited" | "confirmed" | "cancelled" | "waitlisted"`
- **Usage**: `"waitlisted"` used correctly in join logic
- **Status**: Enum includes `waitlisted` (line 355)

### Query Fixes Applied

1. **Public Invite Page** (`app/[hostSlug]/[code]/page.tsx`):
   - ✅ Changed `.select("*")` → explicit field list (includes `waitlist_enabled`)
   - ✅ Queries participants with `.in("status", ["confirmed", "waitlisted"])`

2. **Shared Session Page** (`app/s/[code]/page.tsx`):
   - ✅ Changed `.select("*")` → explicit field list

3. **Join API Route** (`app/api/join/route.ts`):
   - ✅ Already uses explicit fields: `"id, status, capacity, public_code, host_id, host_slug, waitlist_enabled"`

### RLS Policy Fix

**Issue**: Public SELECT policy only allowed `status = 'confirmed'`, but code queries for both `confirmed` and `waitlisted`.

**Fix**: Created migration `20250115000000_allow_public_read_waitlisted_participants.sql`
- Drops old restrictive policy
- Creates new policy allowing both `confirmed` and `waitlisted` status
- **Status**: Migration created, needs to be applied to live database

---

## 📋 Required Actions (Once MCP Access Available)

### 1. Apply Migration
```bash
# Apply the RLS policy fix
supabase migration up 20250115000000_allow_public_read_waitlisted_participants.sql
```

### 2. Validate Live Schema (via Supabase MCP)

**A) Verify `waitlist_enabled` column exists:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessions'
  AND column_name = 'waitlist_enabled';
```

**B) Verify `waitlisted` in enum:**
```sql
SELECT unnest(enum_range(NULL::participant_status)) AS status;
```

**C) Check RLS policies:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'participants'
  AND policyname LIKE '%public%';
```

### 3. Test Waitlist Insert (via MCP SQL Runner)

```sql
-- Test 1: Insert waitlist participant
INSERT INTO participants (session_id, display_name, status, guest_key)
VALUES (
  (SELECT id FROM sessions WHERE public_code = 'TEST' LIMIT 1),
  'Test Waitlist User',
  'waitlisted',
  'test-guest-key-123'
)
RETURNING id, status, display_name;

-- Test 2: Verify can read as anonymous user
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

### 4. Regenerate Types (if schema differs)

```bash
# Using Supabase CLI
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > types/supabase.ts

# Or using the script
./scripts/regenerate-types.sh
```

---

## 📊 Validation Results

### ✅ Code Validation: PASS
- All schema references match types
- No missing columns detected
- Query logic is correct
- RLS policy fix created

### ⏸️ Database Validation: PENDING
- Requires Supabase MCP authentication
- Migration needs to be applied
- Live schema needs verification

---

## 📁 Files Changed

1. ✅ `app/[hostSlug]/[code]/page.tsx` - Fixed `.select("*")` to explicit fields
2. ✅ `app/s/[code]/page.tsx` - Fixed `.select("*")` to explicit fields
3. ✅ `supabase/migrations/20250115000000_allow_public_read_waitlisted_participants.sql` - NEW migration

---

## 🎯 Next Steps

1. **Configure Supabase MCP authentication** (set `SUPABASE_ACCESS_TOKEN`)
2. **Apply migration** `20250115000000_allow_public_read_waitlisted_participants.sql`
3. **Run validation queries** via Supabase MCP SQL runner
4. **Regenerate types** if schema differs from local types
5. **Test end-to-end** waitlist flow on live database

---

## 📝 Detailed Report

See `WAITLIST_VALIDATION_REPORT.md` for comprehensive analysis.

