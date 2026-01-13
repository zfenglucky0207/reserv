import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // No-op
          }
        },
      },
    }
  );
}

/**
 * Create an anonymous Supabase client that doesn't attempt to refresh sessions.
 * Use this for public endpoints where user authentication is not required.
 * This avoids "Invalid Refresh Token" errors when cookies contain stale tokens.
 * 
 * Uses createClient directly (not createServerClient) to ensure truly anonymous access
 * without any session/cookie handling that might interfere with RLS policies.
 * This is critical for Vercel deployments where createServerClient may behave differently.
 */
export function createAnonymousClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    const missing = []
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL")
    if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY")
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
      `On Vercel, ensure these are set in Project Settings > Environment Variables.`
    )
  }
  
  // Use createClient from @supabase/supabase-js directly for admin client
  // Passing service role key as second parameter automatically bypasses RLS
  // Keep configuration minimal - service role key handles authentication automatically
  // CRITICAL: On Vercel, ensure SUPABASE_SERVICE_ROLE_KEY is set in environment variables
  const client = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
  
  // Verify the client was created with service role (should bypass RLS)
  // If this fails, it means the service role key is invalid
  if (!client) {
    throw new Error("Failed to create admin client. Service role key may be invalid.")
  }
  
  return client
}

export async function createClientFromJwt(jwt: string) {
  if (!jwt) {
    console.error("No JWT provided");
    return;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op
        },
      },
    }
  );
}

export async function getUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error: error,
  } = await supabase.auth.getUser();

  if (error) {
    // Don't log expected "missing session" errors for unauthenticated users
    // These are normal on public routes
    if (error.message !== "Auth session missing!") {
      console.error("Error getting user:", error.message);
    }
    return null;
  }

  return user;
}

export async function getUserId(supabase: SupabaseClient) {
  const user = await getUser(supabase);

  if (!user) {
    // Unauthenticated users are expected on public routes or immediately after sign-out.
    return null;
  }

  return user.id || null;
}
