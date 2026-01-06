# Mobile QA Checklist

This document outlines the mobile QA testing process for SessionLink/RESERV to ensure the UI works perfectly across all mobile devices.

## Target Devices

### Critical (Must Test)
- **iPhone SE 1st gen**: 320 × 568
- **iPhone 8**: 375 × 667
- **iPhone 12/13/14**: 390 × 844
- **iPhone 14 Pro Max / 15 Pro Max**: 428 × 926 (Primary target)

### Secondary
- **Android Small**: 360 × 640
- **Pixel 7**: 360 × 780
- **Pixel 8**: 393 × 852
- **iPhone XR/11**: 414 × 896
- **Samsung S22/S23**: 384 × 857

### Landscape (Sanity Check)
- iPhone 8 landscape: 667 × 375
- iPhone X landscape: 812 × 375

## Routes to Test

### Host Routes
- `/login` - Login page
- `/host/new` - Create new session
- `/host/sessions/[id]` - Analytics/session control
- `/host/sessions/[id]?mode=preview` - Preview mode
- `/host/sessions/[id]?mode=payments` - Payment uploads viewer

### Public Routes
- `/session/[id]` - Public invite page
- `/[hostSlug]/[code]` - Public invite with slug

## Key Components to Verify

### 1. Sticky Bottom Bars

#### RSVP Dock (Public Invite)
- **Location**: Bottom of `/session/[id]`
- **Check**:
  - [ ] Does not overlap content when scrolled to bottom
  - [ ] Respects iOS safe-area (home indicator)
  - [ ] Buttons are tappable (min 44px height)
  - [ ] Content padding (`pb-[200px]`) prevents content from being hidden
  - [ ] Joined state animation doesn't break layout

#### Analytics Bottom Bar (Host)
- **Location**: Bottom of `/host/sessions/[id]`
- **Check**:
  - [ ] Respects iOS safe-area
  - [ ] Icons are tappable (min 40x40px)
  - [ ] "Edit" pill button is fully visible
  - [ ] Content padding (`pb-[200px]`) prevents content from being hidden

### 2. Hero Section

#### Title
- **Check**:
  - [ ] Responsive sizing: `text-2xl sm:text-3xl` (not `text-4xl`)
  - [ ] Text wraps gracefully (2-3 lines max)
  - [ ] Always white text (visible on any background)
  - [ ] No horizontal overflow

#### Metadata (Date, Location, Price, Capacity)
- **Check**:
  - [ ] Icons are `flex-shrink-0`
  - [ ] Text uses `break-words` and `min-w-0`
  - [ ] Responsive text size: `text-sm sm:text-base`
  - [ ] Long location names wrap instead of overflow
  - [ ] All text remains white/visible

#### Host Name
- **Check**:
  - [ ] Uses `truncate` for long names
  - [ ] Container has `min-w-0 flex-1`
  - [ ] Avatar is `flex-shrink-0`

### 3. Modals & Dialogs

All modals should:
- [ ] Use `w-[calc(100vw-24px)]` width (not fixed `max-w-md`)
- [ ] Use `max-w-[520px]` for larger screens
- [ ] Use `max-h-[calc(100vh-24px)]` to prevent viewport overflow
- [ ] Have scrollable content area
- [ ] Footer buttons always visible
- [ ] Work on 320px wide screens

#### Specific Modals
- **Live Invites Modal**: Test with 0, 1, and multiple sessions
- **Cover Picker Modal**: Test scrolling through covers
- **Date Picker Modal**: Test calendar interaction
- **Save Draft Guard Modal**: Test with 0, 1, 2+ drafts
- **Unpublish Dialog**: Test confirmation flow
- **Theme Drawer**: Test theme selection

### 4. Tap Targets

All interactive elements must meet minimum sizes:
- **Primary buttons**: 44px height (`h-11`)
- **Icon buttons**: 40x40px minimum (`w-12 h-12`)
- **List items**: 48px height minimum
- **Text inputs**: 44px height minimum

### 5. Text Overflow & Truncation

- [ ] Session titles in lists: Use `line-clamp-2` if needed
- [ ] Long host names: Use `truncate`
- [ ] Button labels: Use `whitespace-nowrap` when appropriate
- [ ] Long locations: Use `break-words` (allow wrapping)
- [ ] No horizontal scrolling anywhere

### 6. Safe-Area Handling

- [ ] Sticky bottom bars use `.safe-bottom` class
- [ ] Top navigation respects notch (if applicable)
- [ ] Content doesn't sit behind home indicator on iOS
- [ ] CSS variables `--safe-top` and `--safe-bottom` are defined

### 7. Content Padding

Pages with sticky bars must have bottom padding:
- **Public invite**: `pb-[200px]` on main content
- **Analytics**: `pb-[200px]` on main content
- **Last card fully visible** when scrolled to bottom

## Common Failure Modes & Fixes

### Issue: Content Hidden Behind Sticky Bar
**Fix**: Increase bottom padding on content container (`pb-28` → `pb-32` → `pb-[200px]`)

### Issue: Modal Too Wide on Small Screen
**Fix**: Use `w-[calc(100vw-24px)]` instead of fixed `max-w-md`

### Issue: Text Overflowing Horizontally
**Fix**: Add `break-words` or `truncate`, ensure parent has `min-w-0`

### Issue: Button Too Small to Tap
**Fix**: Increase height to `h-11` (44px) minimum

### Issue: Sticky Bar Overlapping Home Indicator
**Fix**: Add `.safe-bottom` class to sticky bar container

### Issue: Title Too Large on Small Screen
**Fix**: Use responsive sizing: `text-2xl sm:text-3xl` instead of `text-4xl`

## Testing Checklist Per Route

### `/session/[id]` (Public Invite)
- [ ] Hero title responsive and wraps properly
- [ ] Metadata (date/location/price) wraps on small screens
- [ ] RSVP dock doesn't hide content
- [ ] RSVP dock respects safe-area
- [ ] Join/Decline buttons are tappable
- [ ] Payment proof upload works
- [ ] Guest list scrolls horizontally (no vertical overflow)
- [ ] Map embed (if present) doesn't overflow

### `/host/sessions/[id]` (Analytics)
- [ ] Analytics cards readable
- [ ] Bottom bar doesn't hide content
- [ ] Bottom bar respects safe-area
- [ ] All action buttons tappable
- [ ] Payments card displays correctly
- [ ] "View payment uploads" button visible and tappable

### `/host/sessions/[id]?mode=preview` (Preview)
- [ ] Same as public invite checks
- [ ] "Go to Analytics" button visible and tappable
- [ ] Preview mode is non-interactive (buttons disabled)

### `/host/sessions/[id]?mode=payments` (Payment Viewer)
- [ ] Payment list scrolls correctly
- [ ] Image previews don't overflow
- [ ] "Confirm paid" buttons are tappable
- [ ] Empty state displays correctly

## Browser Testing

Test in:
- [ ] Chrome DevTools (device toolbar)
- [ ] iOS Safari (physical device preferred)
- [ ] Chrome on Android (physical device preferred)

## Notes

- Always test with real content (long titles, long locations, etc.)
- Test with 0, 1, and multiple items in lists
- Test edge cases (very long text, many participants, etc.)
- Ensure animations don't break layout
- Check both light and dark mode

