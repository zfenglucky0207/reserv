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
 */
export async function createAnonymousClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return []; // Return empty cookies - no auth attempted
        },
        setAll() {
          // No-op - don't set any cookies
        },
      },
    }
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    throw new Error(
      `Missing required environment variables: ${!url ? "NEXT_PUBLIC_SUPABASE_URL" : ""} ${!serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""}`
    )
  }
  
  // Use createClient from @supabase/supabase-js directly for admin client
  // This ensures service role key properly bypasses RLS
  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
    console.error("No session found");
    return null;
  }

  return user.id || null;
}
