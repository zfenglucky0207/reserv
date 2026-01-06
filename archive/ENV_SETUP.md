# Environment Variables Setup

## Required Environment Variables

### Local Development (`.env.local`)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URL (optional - defaults to window.location.origin)
# For local development:
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Debug Logging (optional)
NEXT_PUBLIC_DEBUG_LOGS=true
```

### Vercel Production

Set these in Vercel Dashboard → Project Settings → Environment Variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URL (REQUIRED for production)
# Use your Vercel domain or custom domain:
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
# OR if using custom domain:
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Debug Logging (optional, set to false in production)
NEXT_PUBLIC_DEBUG_LOGS=false
```

## Supabase Dashboard Configuration

### Authentication → URL Configuration

1. **Site URL**: Set to your production domain
   - Example: `https://your-app.vercel.app` or `https://yourdomain.com`

2. **Redirect URLs**: Add all allowed redirect URLs:
   ```
   http://localhost:3000/**
   https://your-app.vercel.app/**
   https://yourdomain.com/**
   ```

   The `/**` wildcard allows all paths under that domain.

### Authentication → Providers

1. **Google OAuth**: Enable and configure with:
   - Client ID: Your Google OAuth Client ID
   - Client Secret: Your Google OAuth Client Secret
   - Authorized redirect URIs in Google Console:
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```

2. **Email**: Enable Email provider (OTP is used, not magic links)

## Notes

- `NEXT_PUBLIC_SITE_URL` is optional but recommended for production to ensure correct redirect URLs
- If not set, the app will use `window.location.origin` (works but less explicit)
- Never commit `.env.local` to git
- `SUPABASE_SERVICE_ROLE_KEY` should NEVER be exposed to the client (it's server-only)




