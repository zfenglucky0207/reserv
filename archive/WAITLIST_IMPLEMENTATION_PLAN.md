# Waitlist Implementation Plan

## 📋 Findings Summary

### ✅ What Already Exists

#### 1. **Database Schema (Complete)**
- ✅ `participants.status` enum includes `"waitlisted"` (types/supabase.ts:355)
- ✅ `sessions.waitlist_enabled` boolean column exists (defaults to `true`)
- ✅ Migration already applied: `add_waitlist_enabled.sql`

#### 2. **Backend Logic (Mostly Complete)**
- ✅ **Join API Route** (`app/api/join/route.ts`):
  - Lines 183-216: Capacity check + waitlist insertion logic
  - When full + `waitlist_enabled !== false`: Creates participant with `status: "waitlisted"`
  - Returns `{ waitlisted: true }` flag
  - ✅ **WORKING AS INTENDED**

- ✅ **Server Action** (`app/session/[id]/actions.ts`):
  - `joinSession()`: Lines 178-220 - Same waitlist logic (duplicate of API route)
  - `getParticipantRSVPStatus()`: Lines 54-55 - Returns `"waitlisted"` status
  - `getSessionParticipants()`: Lines 373-388 - Fetches waitlisted participants separately
  - ✅ **WORKING AS INTENDED**

#### 3. **Data Fetching (Complete)**
- ✅ `app/[hostSlug]/[code]/page.tsx`: 
  - Currently only fetches `status: "confirmed"` (line 161)
  - ❌ **MISSING**: Does NOT fetch waitlisted participants
  - Uses `getSessionParticipants()` server action exists but is NOT called

- ✅ `app/session/[id]/page.tsx`:
  - Lines 45-59: Fetches both confirmed AND waitlisted
  - Separates them correctly
  - ✅ **WORKING AS INTENDED**

#### 4. **UI Components (Partially Complete)**

**Public Invite Page (`components/session-invite.tsx`):**
- ✅ Lines 2983-3024: Waitlist card exists with:
  - Header: "Waiting list" + badge count
  - Horizontal scroll layout
  - ❌ **ISSUE**: Uses large avatars (w-16 h-16) with gradient rings - violates requirements
  - ❌ **ISSUE**: Same visual style as main participant list (should be subtle)

- ✅ Lines 3853-3887: Waitlisted state in RSVP bar
  - Shows "You're on the waitlist ✅"
  - ✅ **WORKING AS INTENDED**

**Public Session View (`components/session/public-session-view.tsx`):**
- ✅ Lines 51, 87, 560: Accepts `waitlist` prop
- ✅ Lines 141-142: Handles `rsvpState === "waitlisted"`
- ✅ Lines 291-292: Sets waitlisted state from API response
- ✅ **WORKING AS INTENDED**

**Host Analytics (`components/host/host-session-analytics.tsx`):**
- ✅ Line 48: `waitlistEnabled` in analytics data
- ✅ Lines 487-506: Waitlist toggle in quick settings
- ❌ **MISSING**: Waitlisted participants display in attendees list

### ❌ What's Missing or Needs Fix

#### 1. **Public Invite Page Data Fetching**
**File**: `app/[hostSlug]/[code]/page.tsx`
- **Current**: Only fetches `status: "confirmed"` (line 161)
- **Required**: Also fetch `status: "waitlisted"` and pass to `PublicSessionView`
- **Fix**: Update query to include waitlisted OR use `getSessionParticipants()` server action

#### 2. **Waitlist UI Styling (Public View)**
**File**: `components/session-invite.tsx` (lines 2983-3024)
- **Current**: 
  - Large avatars (w-16 h-16) with gradient rings
  - Same visual weight as main participant list
- **Required**:
  - Soft pills (no avatars)
  - Small font
  - Minimal contrast
  - Horizontal scroll
  - Subtle, secondary visual priority

#### 3. **Host View Waitlist Display**
**File**: `components/host/host-session-analytics.tsx`
- **Current**: Shows only confirmed participants in attendees list
- **Required**: Show waitlisted participants below confirmed, clearly labeled

#### 4. **Payment Proof Restriction**
- **Current**: Waitlisted users can upload payment proof
- **Required**: Block payment proof upload for waitlisted users
- **Location**: `components/session-invite.tsx` payment upload section

#### 5. **Auto-Promotion Logic (Future)**
- **Current**: Not implemented
- **Required**: When confirmed participant is removed, promote first waitlisted
- **Status**: Defer to future (flag as TODO)

---

## 🔄 Proposed Data Flow

### Current Flow (Working)
```
User swipes to join
  ↓
POST /api/join
  ↓
Check capacity (count confirmed participants)
  ↓
If full + waitlist_enabled:
  → Insert participant with status="waitlisted"
  → Return { waitlisted: true }
  ↓
Client sets rsvpState="waitlisted"
  ↓
UI shows waitlisted state in RSVP bar
```

### What Needs Extension
1. **Data Fetching**: Public invite page must fetch waitlisted participants
2. **UI Display**: Waitlist section needs subtle pill-based styling
3. **Payment Block**: Prevent payment upload for waitlisted users

---

## 📝 Implementation Plan

### Phase 1: Fix Data Fetching (Critical)
**File**: `app/[hostSlug]/[code]/page.tsx`

**Change**:
```typescript
// Current (line 156-162):
const { data: participants } = await supabase
  .from("participants")
  .select("id, display_name")
  .eq("session_id", session.id)
  .eq("status", "confirmed")  // ❌ Only confirmed

// New:
const { data: allParticipants } = await supabase
  .from("participants")
  .select("id, display_name, status")
  .eq("session_id", session.id)
  .in("status", ["confirmed", "waitlisted"])
  .order("created_at", { ascending: true })

const confirmedParticipants = (allParticipants || []).filter(p => p.status === "confirmed")
const waitlistParticipants = (allParticipants || []).filter(p => p.status === "waitlisted")

// Pass both to PublicSessionView:
<PublicSessionView
  session={session}
  participants={confirmedParticipants}
  waitlist={waitlistParticipants}  // ✅ Add this
  hostSlug={currentHostSlug}
/>
```

**Impact**: Waitlist data will be available on public invite page

---

### Phase 2: Redesign Waitlist UI (Public View)
**File**: `components/session-invite.tsx` (lines 2983-3024)

**Current Structure**:
```tsx
<Card>
  <h2>Waiting list</h2>
  <Badge>{waitlist.length} waiting</Badge>
  <div className="flex gap-3 overflow-x-auto">
    {waitlist.map(participant => (
      <motion.div>
        <div className="w-16 h-16 rounded-full bg-gradient...">  // ❌ Large avatar
          <span>{initial}</span>
        </div>
        <p>{participant.display_name}</p>
      </motion.div>
    ))}
  </div>
</Card>
```

**New Structure** (Subtle Pills):
```tsx
<Card className="...">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-medium text-white/60">Waitlist</h3>  // Smaller, muted
    <Badge className="bg-amber-500/10 text-amber-400/70 border-amber-500/20 text-xs">
      {waitlist.length}
    </Badge>
  </div>
  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
    {waitlist.map(participant => (
      <div
        key={participant.id}
        className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 whitespace-nowrap"
      >
        {participant.display_name}
      </div>
    ))}
  </div>
</Card>
```

**Key Changes**:
- ❌ Remove avatars (no circles)
- ✅ Use soft pills with names only
- ✅ Smaller font (`text-xs`)
- ✅ Lower opacity (`text-white/70`)
- ✅ Minimal background (`bg-white/5`)
- ✅ Subtle border (`border-white/10`)
- ✅ Horizontal scroll with comfortable spacing

---

### Phase 3: Block Payment for Waitlisted Users
**File**: `components/session-invite.tsx` (payment upload section, ~line 3125)

**Current**: Payment upload enabled for all participants
**Required**: Disable for `rsvpState === "waitlisted"`

**Change**:
```tsx
// Find payment upload section
{rsvpState === "waitlisted" ? (
  <p className="text-sm text-white/60">
    Payment can be made once you're confirmed from the waitlist.
  </p>
) : (
  // Existing payment upload UI
)}
```

**OR** add condition to existing upload:
```tsx
const canUploadPayment = rsvpState === "joined" && !isHostPreview
// Use canUploadPayment to disable upload input
```

---

### Phase 4: Host View Waitlist Display (Optional Enhancement)
**File**: `components/host/host-session-analytics.tsx`

**Current**: Only shows confirmed participants in attendees list
**Required**: Show waitlisted below confirmed

**Approach**:
1. Fetch waitlisted participants in `getSessionAnalytics` (if not already)
2. Add waitlisted section in attendees list
3. Label clearly as "Waitlisted" with count

**Defer if**: Host view already has sufficient waitlist visibility elsewhere

---

## 🎯 Files to Modify

### High Priority (Required)
1. ✅ `app/[hostSlug]/[code]/page.tsx` - Fetch waitlisted participants
2. ✅ `components/session-invite.tsx` - Redesign waitlist UI (lines 2983-3024)
3. ✅ `components/session-invite.tsx` - Block payment for waitlisted (payment section)

### Medium Priority (Enhancement)
4. `components/host/host-session-analytics.tsx` - Show waitlisted in host view
5. `app/host/sessions/[id]/actions.ts` - Ensure `getSessionAnalytics` returns waitlisted count

### Low Priority (Future)
6. Auto-promotion logic when participant removed (TODO)

---

## ✅ Acceptance Criteria

### Public Invite Page
- [ ] Waitlisted participants appear below main participant list
- [ ] Waitlist uses subtle pill design (no avatars)
- [ ] Waitlist is visually secondary (smaller, muted)
- [ ] Horizontal scroll works on mobile
- [ ] Waitlisted users cannot upload payment proof
- [ ] Waitlisted users see "You're on the waitlist ✅" in RSVP bar

### Host View
- [ ] Waitlisted participants visible in analytics/attendees list
- [ ] Clearly labeled as "Waitlisted"
- [ ] Host cannot confirm payment for waitlisted users

### Data Flow
- [ ] Public invite page fetches both confirmed and waitlisted
- [ ] Join API correctly places users in waitlist when full
- [ ] RSVP state correctly reflects waitlisted status

---

## 🚫 What NOT to Change

- ❌ Database schema (already complete)
- ❌ Join API logic (already working)
- ❌ RSVP state machine (already correct)
- ❌ Main participant list UI (keep as-is)
- ❌ Auto-promotion (defer to future)

---

## 📊 Current State Assessment

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Database Schema | ✅ Complete | None |
| Join API Logic | ✅ Working | None |
| Server Actions | ✅ Working | None |
| Public Page Data Fetch | ❌ Missing waitlisted | **FIX REQUIRED** |
| Waitlist UI Styling | ⚠️ Wrong style | **REDESIGN REQUIRED** |
| Payment Block | ❌ Not blocked | **FIX REQUIRED** |
| Host View Display | ⚠️ Partial | Enhancement |
| Auto-Promotion | ❌ Not implemented | Defer |

---

## 🎨 UI Design Spec (Waitlist Section)

### Visual Hierarchy
```
Main Participant List (unchanged)
  ↓ [clear spacing]
Waitlist Section (subtle, secondary)
  - Header: "Waitlist" (small, muted)
  - Badge: count (amber, low opacity)
  - Pills: horizontal scroll, soft background
```

### Pill Design
- **Size**: `px-3 py-1.5` (comfortable touch target)
- **Shape**: `rounded-full`
- **Background**: `bg-white/5` (very subtle)
- **Border**: `border border-white/10` (minimal)
- **Text**: `text-xs text-white/70` (small, muted)
- **Spacing**: `gap-2` (comfortable for thumb scroll)

### Mobile Constraints
- Max width: viewport width
- Horizontal scroll: `overflow-x-auto scrollbar-hide`
- Touch-friendly: min pill width ensures easy tap
- No overlap with main participant list

---

## 🔍 Next Steps

1. **Immediate**: Fix data fetching in `app/[hostSlug]/[code]/page.tsx`
2. **Immediate**: Redesign waitlist UI in `components/session-invite.tsx`
3. **Immediate**: Block payment upload for waitlisted users
4. **Enhancement**: Add waitlisted display in host analytics view
5. **Future**: Implement auto-promotion logic (when participant removed)

---

## 📝 Notes

- The waitlist logic is **already functional** - this is primarily a UI/UX refinement
- No new database migrations needed
- No new API endpoints needed
- Focus on making waitlist **visible but subtle** on public invite page
- Ensure waitlisted users understand they cannot pay until confirmed

