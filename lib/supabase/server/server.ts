import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";
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

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceRoleKey) {
    throw new Error(
      `Missing required environment variables: ${!url ? "NEXT_PUBLIC_SUPABASE_URL" : ""} ${!serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""}`
    )
  }
  
  return createServerClient(
    url,
    serviceRoleKey,
    {
      global: {
        headers: {
          "x-service-role": "true",
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
