// Supabase Edge Function: Auto-unpublish expired sessions
// This function calls the database RPC to delete sessions that have expired
// (48 hours after their end time)
//
// SCHEDULE CONFIGURATION:
// This function should be scheduled to run every 15 minutes via Supabase Dashboard:
//   1. Go to Database > Functions > auto-unpublish
//   2. Click "Schedule" or configure cron job
//   3. Set cron expression: */15 * * * * (every 15 minutes)
//
// Alternatively, if using Supabase CLI:
//   supabase functions deploy auto-unpublish --no-verify-jwt
//   Then configure schedule in Dashboard

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[auto-unpublish] Missing required environment variables")
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Call the database RPC function
    console.log("[auto-unpublish] Calling auto_unpublish_expired_sessions()...")
    const { data, error } = await supabase.rpc("auto_unpublish_expired_sessions")

    if (error) {
      console.error("[auto-unpublish] RPC error:", error)
      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const deletedCount = data ?? 0
    console.log(`[auto-unpublish] Successfully removed ${deletedCount} expired session(s)`)

    return new Response(
      JSON.stringify({
        ok: true,
        removed: deletedCount,
        message: `Removed ${deletedCount} expired session(s)`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error: any) {
    console.error("[auto-unpublish] Unexpected error:", error)
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

