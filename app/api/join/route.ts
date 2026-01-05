import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server/server"
import { log } from "@/lib/logger"

export async function POST(req: Request) {
  const traceId = req.headers.get("x-trace-id") ?? `join_${Date.now()}`
  const startedAt = Date.now()

  try {
    const body = await req.json()
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
      return NextResponse.json(
        { error: "Missing invite code", traceId },
        { status: 400 }
      )
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      log("warn", "join_bad_request", { traceId, reason: "missing_name" })
      return NextResponse.json(
        { error: "Name is required", traceId },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Log Supabase URL (host only, not full key) for debugging
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    log("info", "join_supabase_config", {
      traceId,
      supabaseHost: supabaseUrl ? new URL(supabaseUrl).hostname : "missing",
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
      const updateRes = await supabase
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
          const waitlistRes = await supabase
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
          })

          if (waitlistRes.error) {
            insertError = waitlistRes.error
          } else {
            participantId = waitlistRes.data.id
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
        const insertRes = await supabase
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
        })

        if (insertRes.error) {
          insertError = insertRes.error
        } else {
          participantId = insertRes.data.id
        }
      }
    }

    if (insertError) {
      // RLS will usually show up here as "new row violates row-level security policy"
      log("error", "join_participant_insert_failed", {
        traceId,
        error: insertError.message,
        code: (insertError as any)?.code,
        details: (insertError as any)?.details,
        hint: (insertError as any)?.hint,
      })
      return NextResponse.json(
        {
          error: "Join failed",
          detail: insertError.message,
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

    return NextResponse.json(
      { ok: true, traceId, participantId },
      { status: 200 }
    )
  } catch (e: any) {
    log("error", "join_unhandled", { traceId, message: e?.message, stack: e?.stack })
    return NextResponse.json(
      { error: "Internal error", traceId },
      { status: 500 }
    )
  }
}

