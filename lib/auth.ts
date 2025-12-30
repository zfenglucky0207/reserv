/**
 * Supabase Auth utilities
 * 
 * Configure these environment variables in your .env.local:
 * - NEXT_PUBLIC_SUPABASE_URL: Your Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Your Supabase anonymous key
 */

import { createClient } from './supabase/client'

export const handleGoogleOAuth = async () => {
  if (typeof window === 'undefined') return

  const supabase = createClient()
  
  // Use window.location.origin for Vercel compatibility - automatically works on any domain
  // (localhost for dev, *.vercel.app for production, custom domains, etc.)
  // This ensures the redirect URL is always correct without hardcoding
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('Error signing in with Google:', error)
    // Throw error so it can be caught by the calling component
    throw new Error(
      error.message === 'Unsupported provider: provider is not enabled'
        ? 'Google OAuth is not enabled in your Supabase project. Please enable it in Authentication > Providers > Google in your Supabase dashboard.'
        : error.message || 'Failed to sign in with Google'
    )
  }

  // If successful, data.url will be set and Supabase will handle the redirect
  return data
}

export const handleEmailAuth = () => {
  if (typeof window === 'undefined') return
  
  // Redirect to email sign-in page where user can enter their email
  // The sign-in page can use Supabase's signInWithOtp or signInWithPassword
  const emailSignInUrl = process.env.NEXT_PUBLIC_EMAIL_SIGNIN_URL || '/auth/signin'
  window.location.href = emailSignInUrl
}

