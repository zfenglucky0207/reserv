import { NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server/server"
import { log } from "@/lib/logger"

// Explicitly use Node.js runtime (not Edge) for Supabase compatibility
export const runtime = "nodejs"

export async function POST(req: Request) {
  const traceId = req.headers.get("x-trace-id") ?? `join_${Date.now()}`
  const startedAt = Date.now()

  // Ensure we always return JSON, never HTML
  const jsonResponse = (data: any, status: number = 200) => {
    return NextResponse.json(data, {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  try {
    let body
    try {
      body = await req.json()
    } catch (parseError: any) {
      log("error", "join_request_parse_failed", {
        traceId,
        error: parseError?.message,
      })
      return jsonResponse(
        { error: "Invalid request body", traceId },
        400
      )
    }
    const { publicCode, name, phone, guestKey } = body ?? {}

    log("info", "join_request", {
      traceId,
      publicCode,
      hasName: !!name,
      hasPhone: !!phone,
      hasGuestKey: !!guestKey,
    })

    if (!publicCode || typeof publicCode !== "string") {
      log("warn", "join_bad_request", { traceId, reason: "missing_publicCode" })
      return jsonResponse(
        { error: "Missing invite code", traceId },
        400
      )
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      log("warn", "join_bad_request", { traceId, reason: "missing_name" })
      return jsonResponse(
        { error: "Name is required", traceId },
        400
      )
    }

    // Verify required environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      log("error", "join_missing_env_vars", {
        traceId,
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceRoleKey: !!serviceRoleKey,
      })
      return NextResponse.json(
        { 
          error: "Server configuration error", 
          detail: "Missing required Supabase environment variables. Please check Vercel environment variables.",
          traceId 
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
          }
        }
      )
    }
    
    // Use admin client for inserts to bypass RLS (trusted server-side operation)
    // We still validate session access using the regular client
    let supabase
    let adminSupabase
    
    try {
      supabase = await createClient()
    } catch (clientError: any) {
      log("error", "join_supabase_client_creation_failed", {
        traceId,
        error: clientError?.message,
        stack: clientError?.stack,
      })
      return NextResponse.json(
        { 
          error: "Server configuration error", 
          detail: "Failed to create Supabase client.",
          traceId 
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
          }
        }
      )
    }
    
    try {
      adminSupabase = createAdminClient()
    } catch (adminError: any) {
      log("error", "join_admin_client_creation_failed", {
        traceId,
        error: adminError?.message,
        stack: adminError?.stack,
      })
      return NextResponse.json(
        { 
          error: "Server configuration error", 
          detail: "Failed to create admin client.",
          traceId 
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json",
          }
        }
      )
    }

    // Log Supabase configuration (host only, not full keys) for debugging
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    log("info", "join_supabase_config", {
      traceId,
      supabaseHost: supabaseUrl ? new URL(supabaseUrl).hostname : "missing",
      hasServiceRoleKey: !!serviceRoleKey,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      runtime: "nodejs",
    })

    // 1) Fetch session by public code
    const sessionRes = await supabase
      .from("sessions")
      .select("id, status, capacity, public_code, host_id, host_slug, waitlist_enabled")
      .eq("public_code", publicCode)
      .maybeSingle()

    log("info", "join_session_lookup", {
      traceId,
      error: sessionRes.error?.message,
      errorCode: (sessionRes.error as any)?.code,
      found: !!sessionRes.data,
      sessionId: sessionRes.data?.id,
      status: sessionRes.data?.status,
      publicCodeQueried: publicCode,
      publicCodeInDB: sessionRes.data?.public_code,
    })

    // This is the exact place your current "not found or not available" is coming from
    if (sessionRes.error) {
      log("error", "join_session_lookup_error", {
        traceId,
        error: sessionRes.error.message,
        code: (sessionRes.error as any)?.code,
        details: (sessionRes.error as any)?.details,
        hint: (sessionRes.error as any)?.hint,
      })
      return NextResponse.json(
        {
          error: "Session lookup failed",
          detail: sessionRes.error.message,
          traceId,
        },
        { status: 500 }
      )
    }

    if (!sessionRes.data) {
      log("warn", "join_session_not_found", {
        traceId,
        publicCode,
        reason: "no_rows_returned",
      })
      return NextResponse.json(
        { error: "Session not found", traceId, publicCode },
        { status: 404 }
      )
    }

    // 2) Basic availability checks
    if (sessionRes.data.status !== "open") {
      log("warn", "join_session_not_open", {
        traceId,
        sessionId: sessionRes.data.id,
        status: sessionRes.data.status,
      })
      return NextResponse.json(
        { error: `Session is ${sessionRes.data.status}. Only open sessions can be joined.`, traceId },
        { status: 409 }
      )
    }

    // 3) Validate guest key (must be provided from client)
    if (!guestKey || typeof guestKey !== "string") {
      log("warn", "join_bad_request", { traceId, reason: "missing_guestKey" })
      return NextResponse.json(
        { error: "Guest key is required", traceId },
        { status: 400 }
      )
    }
    const finalGuestKey = guestKey

    // 4) Check if participant already exists by guest_key
    const { data: existingParticipant } = await supabase
      .from("participants")
      .select("id, status")
      .eq("session_id", sessionRes.data.id)
      .eq("guest_key", finalGuestKey)
      .maybeSingle()

    log("info", "join_participant_check", {
      traceId,
      existingParticipantId: existingParticipant?.id,
      existingStatus: existingParticipant?.status,
    })

    // 5) Insert or update participant
    const trimmedName = name.trim()
    const trimmedPhone = phone?.trim() || null

    let participantId: string | undefined
    let insertError: any = null

    if (existingParticipant) {
      // Check capacity before updating (in case they're waitlisted and session now has space)
      const { count, error: countError } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionRes.data.id)
        .eq("status", "confirmed")

      if (countError) {
        log("error", "join_capacity_check_error", {
          traceId,
          error: countError.message,
        })
        return NextResponse.json(
          { error: "Failed to check capacity", traceId },
          { status: 500 }
        )
      }

      const isFull = sessionRes.data.capacity && count !== null && count >= sessionRes.data.capacity
      const waitlistEnabled = sessionRes.data.waitlist_enabled !== false

      // If session is full and waitlist is enabled, keep them waitlisted
      // If session is full and waitlist is disabled, return error
      // If session has space, confirm them
      let newStatus: "confirmed" | "waitlisted" = "confirmed"
      if (isFull && waitlistEnabled) {
        newStatus = "waitlisted"
      } else if (isFull && !waitlistEnabled) {
        log("warn", "join_capacity_exceeded_existing", {
          traceId,
          capacity: sessionRes.data.capacity,
          currentCount: count,
          waitlistEnabled,
          waitlistEnabledRaw: sessionRes.data.waitlist_enabled,
          reason: "waitlist_disabled",
        })
        return NextResponse.json(
          { error: "Session is full", traceId, code: "CAPACITY_EXCEEDED" },
          { status: 409 }
        )
      }

      // Update existing participant
      // Use admin client to bypass RLS (we've already validated session is open)
      const updateRes = await adminSupabase
        .from("participants")
        .update({
          status: newStatus,
          display_name: trimmedName,
          contact_phone: trimmedPhone,
        })
        .eq("id", existingParticipant.id)
        .select("id")
        .single()

      log("info", "join_participant_update", {
        traceId,
        error: updateRes.error?.message,
        errorCode: (updateRes.error as any)?.code,
        participantId: updateRes.data?.id,
        newStatus,
        wasWaitlisted: existingParticipant.status === "waitlisted",
      })

      if (updateRes.error) {
        insertError = updateRes.error
      } else {
        participantId = updateRes.data.id
        // Return waitlisted response if they're still waitlisted
        if (newStatus === "waitlisted") {
          return NextResponse.json(
            { ok: true, traceId, participantId: updateRes.data.id, waitlisted: true },
            { status: 200 }
          )
        }
      }
    } else {
      // Check capacity before inserting
      const { count, error: countError } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionRes.data.id)
        .eq("status", "confirmed")

      if (countError) {
        log("error", "join_capacity_check_error", {
          traceId,
          error: countError.message,
        })
        return NextResponse.json(
          { error: "Failed to check capacity", traceId },
          { status: 500 }
        )
      }

      const isFull = sessionRes.data.capacity && count !== null && count >= sessionRes.data.capacity
      const waitlistEnabled = sessionRes.data.waitlist_enabled !== false

      log("info", "join_capacity_check", {
        traceId,
        capacity: sessionRes.data.capacity,
        currentCount: count,
        isFull,
        waitlistEnabled,
        waitlistEnabledRaw: sessionRes.data.waitlist_enabled,
      })

      if (isFull) {
        if (waitlistEnabled) {
          // Join waitlist instead
          // Use admin client to bypass RLS (we've already validated session is open)
          const waitlistRes = await adminSupabase
            .from("participants")
            .insert({
              session_id: sessionRes.data.id,
              display_name: trimmedName,
              contact_phone: trimmedPhone,
              guest_key: finalGuestKey,
              status: "waitlisted",
            })
            .select("id")
            .single()

          log("info", "join_waitlist_insert", {
            traceId,
            error: waitlistRes.error?.message,
            errorCode: (waitlistRes.error as any)?.code,
            participantId: waitlistRes.data?.id,
            hasData: !!waitlistRes.data,
            hasError: !!waitlistRes.error,
          })

          if (waitlistRes.error) {
            // Log full error details for production debugging
            log("error", "join_waitlist_insert_error", {
              traceId,
              error: waitlistRes.error.message,
              code: (waitlistRes.error as any)?.code,
              details: (waitlistRes.error as any)?.details,
              hint: (waitlistRes.error as any)?.hint,
              sessionId: sessionRes.data.id,
            })
            insertError = waitlistRes.error
          } else if (!waitlistRes.data) {
            // Edge case: no error but also no data
            log("error", "join_waitlist_insert_no_data", {
              traceId,
              sessionId: sessionRes.data.id,
            })
            return NextResponse.json(
              { error: "Failed to create waitlist entry", traceId },
              { status: 500 }
            )
          } else {
            participantId = waitlistRes.data.id
            log("info", "join_waitlist_success", {
              traceId,
              participantId: waitlistRes.data.id,
            })
            return NextResponse.json(
              { ok: true, traceId, participantId: waitlistRes.data.id, waitlisted: true },
              { status: 200 }
            )
          }
        } else {
          log("warn", "join_capacity_exceeded", {
            traceId,
            capacity: sessionRes.data.capacity,
            currentCount: count,
            waitlistEnabled,
            waitlistEnabledRaw: sessionRes.data.waitlist_enabled,
            reason: "waitlist_disabled",
          })
          return NextResponse.json(
            { 
              error: "Session is full", 
              traceId, 
              code: "CAPACITY_EXCEEDED",
              waitlistDisabled: true,
              message: "Session is full and waitlist is disabled. Please contact the host or enable waitlist for this session."
            },
            { status: 409 }
          )
        }
      } else {
        // Insert new participant
        // Use admin client to bypass RLS (we've already validated session is open)
        const insertRes = await adminSupabase
          .from("participants")
          .insert({
            session_id: sessionRes.data.id,
            display_name: trimmedName,
            contact_phone: trimmedPhone,
            guest_key: finalGuestKey,
            status: "confirmed",
          })
          .select("id")
          .single()

        log("info", "join_participant_insert", {
          traceId,
          error: insertRes.error?.message,
          errorCode: (insertRes.error as any)?.code,
          participantId: insertRes.data?.id,
          hasData: !!insertRes.data,
          hasError: !!insertRes.error,
        })

        if (insertRes.error) {
          // Log full error details for production debugging
          log("error", "join_participant_insert_error", {
            traceId,
            error: insertRes.error.message,
            code: (insertRes.error as any)?.code,
            details: (insertRes.error as any)?.details,
            hint: (insertRes.error as any)?.hint,
            sessionId: sessionRes.data.id,
          })
          insertError = insertRes.error
        } else if (!insertRes.data) {
          // Edge case: no error but also no data
          log("error", "join_participant_insert_no_data", {
            traceId,
            sessionId: sessionRes.data.id,
          })
          return NextResponse.json(
            { error: "Failed to create participant", traceId },
            { status: 500 }
          )
        } else {
          participantId = insertRes.data.id
          log("info", "join_participant_insert_success", {
            traceId,
            participantId: insertRes.data.id,
          })
        }
      }
    }

    if (insertError) {
      // RLS will usually show up here as "new row violates row-level security policy"
      const errorCode = (insertError as any)?.code
      const errorDetails = (insertError as any)?.details
      const errorHint = (insertError as any)?.hint
      const isRLSError = insertError.message?.includes("row-level security") || 
                        insertError.message?.includes("RLS") ||
                        errorCode === "42501"
      
      log("error", "join_participant_insert_failed", {
        traceId,
        error: insertError.message,
        code: errorCode,
        details: errorDetails,
        hint: errorHint,
        isRLSError,
        sessionId: sessionRes.data.id,
        guestKey: finalGuestKey,
      })
      
      return NextResponse.json(
        {
          error: isRLSError 
            ? "Permission denied. Please check your session permissions."
            : "Join failed",
          detail: insertError.message,
          code: errorCode,
          traceId,
        },
        { status: 403 }
      )
    }

    log("info", "join_success", {
      traceId,
      ms: Date.now() - startedAt,
      participantId,
    })

    return jsonResponse(
      { ok: true, traceId, participantId },
      200
    )
  } catch (e: any) {
    log("error", "join_unhandled", { 
      traceId, 
      message: e?.message, 
      stack: e?.stack,
      name: e?.name,
      cause: e?.cause,
    })
    
    // Always return JSON, never HTML
    return jsonResponse(
      { 
        error: "Internal error", 
        detail: e?.message || "An unexpected error occurred",
        traceId 
      },
      500
    )
  }
}

