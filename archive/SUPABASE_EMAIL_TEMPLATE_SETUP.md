# Supabase Email Template Configuration - OTP Code (Not Magic Link)

## Issue

Supabase is currently sending **magic link emails** instead of **6-digit OTP codes** because the email template contains `{{ .ConfirmationURL }}`. 

According to Supabase docs:
- `{{ .ConfirmationURL }}` → Sends magic link email
- `{{ .Token }}` → Sends 6-digit OTP code

## Required Change in Supabase Dashboard

### Step 1: Navigate to Email Templates

1. Go to your Supabase Dashboard
2. Navigate to: **Authentication → Email Templates**
3. Find the template for **"Magic Link"** or **"Confirm signup"** (depending on your flow)

### Step 2: Update the Template

**Remove:**
- Any usage of `{{ .ConfirmationURL }}`
- Any links/URLs in the template

**Add:**
- Use `{{ .Token }}` for the 6-digit code

### Step 3: Template Example

**Subject:**
```
Your RESERV verification code
```

**Body:**
```
Your verification code is: {{ .Token }}

This code will expire in a few minutes.

If you didn't request this code, you can safely ignore this email.
```

**Important:**
- ✅ Include `{{ .Token }}` (the 6-digit code)
- ❌ Do NOT include `{{ .ConfirmationURL }}`
- ❌ Do NOT include any clickable links
- ✅ Keep it simple - just the code

### Step 4: Save Changes

Save the template changes in the Supabase dashboard.

---

## Code Implementation Status ✅

Your code is **already correct** for OTP verification:

### ✅ Sending OTP (`lib/auth.ts`)
```typescript
await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,
  },
  // ✅ Correct: No emailRedirectTo (that's for magic links)
})
```

### ✅ Verifying OTP (`lib/auth.ts`)
```typescript
await supabase.auth.verifyOtp({
  email,
  token: otp,  // 6-digit code from user
  type: 'email',
})
```

### ✅ UI Flow (`components/login-dialog.tsx`)
- ✅ Step 1: Enter email → "Send code"
- ✅ Step 2: Enter 6-digit code → "Verify"
- ✅ Error handling in place
- ✅ 60-second resend cooldown

**No code changes needed** - just update the Supabase email template!

---

## After Template Update

1. **Test the flow:**
   - Enter email → click "Send code"
   - Check email inbox (not spam)
   - You should receive a **6-digit code** (not a link)
   - Enter code → click "Verify"
   - Should authenticate successfully

2. **If still getting links:**
   - Double-check template doesn't have `{{ .ConfirmationURL }}`
   - Make sure you saved the template changes
   - Clear browser cache and try again

3. **Production recommendation:**
   - Configure custom SMTP (SendGrid, Resend, Mailgun, etc.)
   - Better deliverability than Supabase default email service
   - Location: Authentication → Emails → SMTP Settings

---

## Template Variables Reference

From Supabase docs:

- `{{ .Token }}` - The 6-digit OTP code
- `{{ .ConfirmationURL }}` - Magic link URL (don't use for OTP)
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your site URL

For OTP code entry flow, you only need `{{ .Token }}`.

