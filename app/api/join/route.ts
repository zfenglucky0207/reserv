import { NextResponse } from "next/server"
import { createAnonymousClient, createAdminClient } from "@/lib/supabase/server/server"
import { log, logInfo, logWarn, logError, withTrace, debugEnabled } from "@/lib/logger"

// Explicitly use Node.js runtime (not Edge) for Supabase compatibility
export const runtime = "nodejs"

// Force dynamic rendering to avoid static generation issues
export const dynamic = "force-dynamic"

// Disable static generation for this route
export const revalidate = 0

// Ensure we always return JSON, never HTML
const jsonResponse = (data: any, status: number = 200) => {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

export async function POST(req: Request) {
  // Initialize traceId early to use in error handling
  let traceId = `join_${Date.now()}`
  let startedAt = Date.now()
  
  try {
    traceId = req.headers.get("x-trace-id") ?? traceId
    startedAt = Date.now()
    
    // Log request start
    const origin = req.headers.get("origin") || "unknown"
    const userAgent = req.headers.get("user-agent") || "unknown"
    const hasAuthHeader = !!req.headers.get("authorization")
    
    logInfo("join_api_start", withTrace({
      method: req.method,
      url: req.url,
      origin,
      userAgent: userAgent.substring(0, 100), // Truncate for logs
      hasAuthHeader,
    }, traceId))
  } catch (headerError: any) {
    console.error("[join] Error reading headers:", headerError)
    // Continue with default traceId - don't throw, just log
  }

  try {
    let body
    try {
      body = await req.json()
    } catch (parseError: any) {
      logError("join_request_parse_failed", withTrace({
        error: parseError?.message,
        stage: "request_parse",
      }, traceId))
      return jsonResponse(
        { error: "Invalid request body", traceId },
        400
      )
    }
    const { publicCode, name, phone, guestKey } = body ?? {}

    logInfo("join_request", withTrace({
      publicCode,
      hasName: !!name,
      nameLength: name?.length || 0,
      hasPhone: !!phone,
      hasGuestKey: !!guestKey,
      bodyParsed: debugEnabled() ? body : { publicCode, hasName: !!name, hasPhone: !!phone, hasGuestKey: !!guestKey },
    }, traceId))

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
      return jsonResponse(
        { 
          error: "Server configuration error", 
          detail: "Missing required Supabase environment variables. Please check Vercel environment variables.",
          traceId 
        },
        500
      )
    }
    
    // Use anonymous client for public operations (doesn't try to refresh sessions)
    // This avoids "Invalid Refresh Token" errors when cookies contain stale tokens
    // Use admin client for inserts to bypass RLS (trusted server-side operation)
    let supabase
    let adminSupabase
    
    try {
      // Use anonymous client - doesn't attempt auth, avoids refresh token errors
      supabase = await createAnonymousClient()
      log("info", "join_anonymous_client_created", {
        traceId,
        note: "Using anonymous client for public join endpoint",
      })
    } catch (clientError: any) {
      // This should rarely happen, but handle it gracefully
      log("error", "join_supabase_client_creation_failed", {
        traceId,
        error: clientError?.message,
        stack: clientError?.stack,
      })
      return jsonResponse(
        { 
          error: "Server configuration error", 
          detail: "Failed to create Supabase client.",
          traceId 
        },
        500
      )
    }
    
    try {
      adminSupabase = createAdminClient()
      console.log("[waitlist] Admin client created successfully", {
        hasAdminClient: !!adminSupabase,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      })
    } catch (adminError: any) {
      console.error("[waitlist] Failed to create admin client", {
        error: adminError.message,
        stack: adminError.stack
      })
      log("error", "join_admin_client_creation_failed", {
        traceId,
        error: adminError?.message,
        stack: adminError?.stack,
      })
      return jsonResponse(
        { 
          error: "Server configuration error", 
          detail: "Failed to create admin client.",
          traceId 
        },
        500
      )
    }

    // Log Supabase configuration (host only, not full keys) for debugging
    log("info", "join_supabase_config", {
      traceId,
      supabaseHost: supabaseUrl ? new URL(supabaseUrl).hostname : "missing",
      hasServiceRoleKey: !!serviceRoleKey,
      hasAnonKey: !!supabaseAnonKey,
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
      return jsonResponse(
        {
          error: "Session lookup failed",
          detail: sessionRes.error.message,
          traceId,
        },
        500
      )
    }

    if (!sessionRes.data) {
      log("warn", "join_session_not_found", {
        traceId,
        publicCode,
        reason: "no_rows_returned",
      })
      return jsonResponse(
        { error: "Session not found", traceId, publicCode },
        404
      )
    }

    // 2) Basic availability checks
    if (sessionRes.data.status !== "open") {
      log("warn", "join_session_not_open", {
        traceId,
        sessionId: sessionRes.data.id,
        status: sessionRes.data.status,
      })
      return jsonResponse(
        { error: `Session is ${sessionRes.data.status}. Only open sessions can be joined.`, traceId },
        409
      )
    }

    // 3) Validate guest key (must be provided from client)
    if (!guestKey || typeof guestKey !== "string") {
      log("warn", "join_bad_request", { traceId, reason: "missing_guestKey" })
      return jsonResponse(
        { error: "Guest key is required", traceId },
        400
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
      return jsonResponse(
        { error: "Failed to check capacity", traceId },
        500
      )
      }

      const isFull = sessionRes.data.capacity && count !== null && count >= sessionRes.data.capacity
      const waitlistEnabled = sessionRes.data.waitlist_enabled !== false

      logInfo("join_capacity_check", withTrace({
        capacity: sessionRes.data.capacity,
        joinedCount: count,
        isFull,
        isClosed: sessionRes.data.status !== "open",
        waitlistEnabled,
      }, traceId))

      // If session is full and waitlist is enabled, keep them waitlisted
      // If session is full and waitlist is disabled, return error
      // If session has space, confirm them
      let newStatus: "confirmed" | "waitlisted" = "confirmed"
      if (isFull && waitlistEnabled) {
        newStatus = "waitlisted"
      } else if (isFull && !waitlistEnabled) {
        logWarn("join_capacity_exceeded_existing", withTrace({
          capacity: sessionRes.data.capacity,
          currentCount: count,
          waitlistEnabled,
          waitlistEnabledRaw: sessionRes.data.waitlist_enabled,
          reason: "waitlist_disabled",
          stage: "capacity_check",
        }, traceId))
        return jsonResponse(
          { error: "Session is full", traceId, code: "CAPACITY_EXCEEDED" },
          409
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
        .select("id, status")
        .single()

      logInfo("join_participant_write_result", withTrace({
        participantId: updateRes.data?.id || null,
        rsvp_status: updateRes.data?.status || null,
        payment_status: null,
        error: updateRes.error?.message || null,
        errorCode: updateRes.error ? (updateRes.error as any)?.code : null,
        errorDetails: updateRes.error ? (updateRes.error as any)?.details : null,
        hint: updateRes.error ? (updateRes.error as any)?.hint : null,
        newStatus,
        wasWaitlisted: existingParticipant.status === "waitlisted",
        stage: "participant_update",
      }, traceId))

      if (updateRes.error) {
        insertError = updateRes.error
      } else {
        participantId = updateRes.data.id
        // Return waitlisted response if they're still waitlisted
        if (newStatus === "waitlisted") {
          return jsonResponse(
            { ok: true, traceId, participantId: updateRes.data.id, waitlisted: true, joinedAs: "waitlist" },
            200
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
      return jsonResponse(
        { error: "Failed to check capacity", traceId },
        500
      )
      }

      const isFull = sessionRes.data.capacity && count !== null && count >= sessionRes.data.capacity
      const waitlistEnabled = sessionRes.data.waitlist_enabled !== false

      console.log("[waitlist] Capacity check for NEW participant", {
        traceId,
        capacity: sessionRes.data.capacity,
        currentCount: count,
        isFull,
        waitlistEnabled,
        waitlistEnabledRaw: sessionRes.data.waitlist_enabled,
        waitlistEnabledType: typeof sessionRes.data.waitlist_enabled,
        waitlistEnabledValue: sessionRes.data.waitlist_enabled,
        sessionId: sessionRes.data.id,
        condition: `capacity=${sessionRes.data.capacity}, count=${count}, isFull=${isFull}`
      })

      log("info", "join_capacity_check", {
        traceId,
        capacity: sessionRes.data.capacity,
        currentCount: count,
        isFull,
        waitlistEnabled,
        waitlistEnabledRaw: sessionRes.data.waitlist_enabled,
        waitlistEnabledType: typeof sessionRes.data.waitlist_enabled,
        waitlistEnabledValue: sessionRes.data.waitlist_enabled,
      })

      if (isFull) {
        console.log("[waitlist] ✅ Session is FULL - entering waitlist logic", {
          traceId,
          isFull,
          waitlistEnabled,
          willInsertWaitlist: waitlistEnabled,
          capacity: sessionRes.data.capacity,
          currentCount: count,
          sessionId: sessionRes.data.id
        })
        console.log("[waitlist] Session is full, checking waitlist_enabled", {
          isFull,
          waitlistEnabled,
          waitlistEnabledRaw: sessionRes.data.waitlist_enabled,
          capacity: sessionRes.data.capacity,
          count
        })
        
        if (waitlistEnabled) {
          console.log("[waitlist] ✅ Waitlist is ENABLED - proceeding with waitlist insert", {
            traceId,
            sessionId: sessionRes.data.id,
            hasAdminClient: !!adminSupabase
          })
          // Join waitlist instead
          console.log("[waitlist] Waitlist enabled, inserting as waitlisted", {
            sessionId: sessionRes.data.id,
            name: trimmedName,
            guestKey: finalGuestKey
          })
          
          logInfo("join_participant_write_start", withTrace({
            sessionId: sessionRes.data.id,
            action: "insert_waitlist",
          }, traceId))
          
          // Use admin client to bypass RLS (we've already validated session is open)
          console.log("[waitlist] About to insert with admin client", {
            hasAdminClient: !!adminSupabase,
            sessionId: sessionRes.data.id,
            name: trimmedName,
            phone: trimmedPhone,
            guestKey: finalGuestKey,
            status: "waitlisted"
          })
          
          // Use exact enum value from schema: "waitlisted" (from participant_status enum)
          const insertPayload: {
            session_id: string
            display_name: string
            contact_phone: string | null
            guest_key: string
            status: "waitlisted"
          } = {
            session_id: sessionRes.data.id,
            display_name: trimmedName,
            contact_phone: trimmedPhone,
            guest_key: finalGuestKey,
            status: "waitlisted", // Must match enum: "invited" | "confirmed" | "cancelled" | "waitlisted"
          }
          
          console.log("[waitlist] Insert payload (typed)", {
            ...insertPayload,
            statusType: typeof insertPayload.status,
            statusValue: insertPayload.status
          })
          
          const waitlistRes = await adminSupabase
            .from("participants")
            .insert(insertPayload)
            .select("id, status")
            .single()
          
          console.log("[waitlist] Insert completed", {
            hasData: !!waitlistRes.data,
            hasError: !!waitlistRes.error,
            data: waitlistRes.data,
            error: waitlistRes.error ? {
              message: waitlistRes.error.message,
              code: (waitlistRes.error as any)?.code,
              details: (waitlistRes.error as any)?.details,
              hint: (waitlistRes.error as any)?.hint
            } : null
          })

          console.log("[waitlist] Insert result", {
            success: !!waitlistRes.data,
            error: waitlistRes.error?.message,
            participantId: waitlistRes.data?.id,
            status: waitlistRes.data?.status,
            errorCode: (waitlistRes.error as any)?.code,
            errorDetails: (waitlistRes.error as any)?.details
          })
          
          logInfo("join_participant_write_result", withTrace({
            participantId: waitlistRes.data?.id || null,
            rsvp_status: waitlistRes.data?.status || null,
            payment_status: null,
            error: waitlistRes.error?.message || null,
            errorCode: waitlistRes.error ? (waitlistRes.error as any)?.code : null,
            errorDetails: waitlistRes.error ? (waitlistRes.error as any)?.details : null,
            hint: waitlistRes.error ? (waitlistRes.error as any)?.hint : null,
            hasData: !!waitlistRes.data,
            hasError: !!waitlistRes.error,
            stage: "waitlist_insert",
          }, traceId))

          if (waitlistRes.error) {
            console.error("[waitlist] Insert failed", {
              error: waitlistRes.error.message,
              code: (waitlistRes.error as any)?.code,
              details: (waitlistRes.error as any)?.details,
              hint: (waitlistRes.error as any)?.hint
            })
            const errorCode = (waitlistRes.error as any)?.code
            const isDuplicateKey = errorCode === "23505" || 
                                   waitlistRes.error.message?.includes("duplicate key") ||
                                   waitlistRes.error.message?.includes("unique constraint")
            
            // Handle duplicate key error (idempotent join)
            if (isDuplicateKey) {
              logInfo("join_duplicate_detected_waitlist", withTrace({
                error: waitlistRes.error.message,
                code: errorCode,
                details: (waitlistRes.error as any)?.details,
                sessionId: sessionRes.data.id,
                guestKey: finalGuestKey,
                stage: "duplicate_waitlist_join_handling",
              }, traceId))
              
              // Fetch existing participant
              const { data: existingParticipant, error: fetchError } = await adminSupabase
                .from("participants")
                .select("id, status, display_name")
                .eq("session_id", sessionRes.data.id)
                .eq("guest_key", finalGuestKey)
                .single()
              
              if (fetchError || !existingParticipant) {
                logError("join_duplicate_fetch_failed_waitlist", withTrace({
                  error: fetchError?.message || "Participant not found after duplicate error",
                  code: errorCode,
                  sessionId: sessionRes.data.id,
                  guestKey: finalGuestKey,
                }, traceId))
                insertError = waitlistRes.error // Fall back to original error
              } else {
                // Successfully found existing participant - treat as success
                participantId = existingParticipant.id
                logInfo("join_already_joined_waitlist", withTrace({
                  participantId: existingParticipant.id,
                  status: existingParticipant.status,
                  displayName: existingParticipant.display_name,
                  sessionId: sessionRes.data.id,
                  stage: "duplicate_waitlist_join_success",
                }, traceId))
                
                // Return success with alreadyJoined flag
                return jsonResponse(
                  { 
                    ok: true, 
                    traceId, 
                    participantId: existingParticipant.id,
                    alreadyJoined: true,
                    waitlisted: existingParticipant.status === "waitlisted",
                    joinedAs: existingParticipant.status === "waitlisted" ? "waitlist" : "joined",
                  },
                  200
                )
              }
            } else {
              // Log full error details for production debugging
              console.error("[waitlist] Non-duplicate error during waitlist insert", {
                error: waitlistRes.error.message,
                code: errorCode,
                details: (waitlistRes.error as any)?.details,
                hint: (waitlistRes.error as any)?.hint
              })
              logError("join_waitlist_insert_error", withTrace({
                error: waitlistRes.error.message,
                code: errorCode,
                details: (waitlistRes.error as any)?.details,
                hint: (waitlistRes.error as any)?.hint,
                sessionId: sessionRes.data.id,
                stage: "waitlist_insert",
              }, traceId))
              // Return error immediately - don't fall through to confirmed insert
              return jsonResponse(
                { 
                  error: waitlistRes.error?.message || "Failed to join waitlist", 
                  traceId,
                  code: errorCode || "WAITLIST_INSERT_FAILED"
                },
                500
              )
            }
          } else if (!waitlistRes.data) {
            // Edge case: no error but also no data
            logError("join_waitlist_insert_no_data", withTrace({
              sessionId: sessionRes.data.id,
              stage: "waitlist_insert",
            }, traceId))
            return jsonResponse(
              { error: "Failed to create waitlist entry", traceId },
              500
            )
          } else {
            // SUCCESS: Waitlist insert succeeded
            participantId = waitlistRes.data.id
            console.log("[waitlist] ✅ SUCCESS - Waitlist insert completed", {
              traceId,
              participantId: waitlistRes.data.id,
              status: waitlistRes.data.status,
              sessionId: sessionRes.data.id,
              name: trimmedName
            })
            log("info", "join_waitlist_success", {
              traceId,
              participantId: waitlistRes.data.id,
              status: waitlistRes.data.status,
            })
            return jsonResponse(
              { ok: true, traceId, participantId: waitlistRes.data.id, waitlisted: true, joinedAs: "waitlist" },
              200
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
          return jsonResponse(
            { 
              error: "Session is full", 
              traceId, 
              code: "CAPACITY_EXCEEDED",
              waitlistDisabled: true,
              message: "Session is full and waitlist is disabled. Please contact the host or enable waitlist for this session."
            },
            409
          )
        }
      } else {
        // Insert new participant
        logInfo("join_participant_write_start", withTrace({
          sessionId: sessionRes.data.id,
          action: "insert_confirmed",
        }, traceId))
        
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
          const errorCode = (insertRes.error as any)?.code
          const isDuplicateKey = errorCode === "23505" || 
                                 insertRes.error.message?.includes("duplicate key") ||
                                 insertRes.error.message?.includes("unique constraint")
          
          // Handle duplicate key error (idempotent join)
          if (isDuplicateKey) {
            logInfo("join_duplicate_detected", withTrace({
              error: insertRes.error.message,
              code: errorCode,
              details: (insertRes.error as any)?.details,
              sessionId: sessionRes.data.id,
              guestKey: finalGuestKey,
              stage: "duplicate_join_handling",
            }, traceId))
            
            // Fetch existing participant
            const { data: existingParticipant, error: fetchError } = await adminSupabase
              .from("participants")
              .select("id, status, display_name")
              .eq("session_id", sessionRes.data.id)
              .eq("guest_key", finalGuestKey)
              .single()
            
            if (fetchError || !existingParticipant) {
              logError("join_duplicate_fetch_failed", withTrace({
                error: fetchError?.message || "Participant not found after duplicate error",
                fetchErrorCode: (fetchError as any)?.code,
                fetchErrorDetails: (fetchError as any)?.details,
                code: errorCode,
                sessionId: sessionRes.data.id,
                guestKey: finalGuestKey,
                stage: "duplicate_fetch_failed",
              }, traceId))
              // Even if fetch fails, we know the participant exists (duplicate key error)
              // Try one more time with a simpler query or return success anyway
              // For now, fall back to original error - it will be caught in final handler
              insertError = insertRes.error // Fall back to original error
            } else {
              // Successfully found existing participant - treat as success
              participantId = existingParticipant.id
              logInfo("join_already_joined", withTrace({
                participantId: existingParticipant.id,
                status: existingParticipant.status,
                displayName: existingParticipant.display_name,
                sessionId: sessionRes.data.id,
                stage: "duplicate_join_success",
              }, traceId))
              
              // Return success with alreadyJoined flag
              return jsonResponse(
                { 
                  ok: true, 
                  traceId, 
                  participantId: existingParticipant.id,
                  alreadyJoined: true,
                  waitlisted: existingParticipant.status === "waitlisted",
                },
                200
              )
            }
          } else {
            // Log full error details for production debugging
            log("error", "join_participant_insert_error", {
              traceId,
              error: insertRes.error.message,
              code: errorCode,
              details: (insertRes.error as any)?.details,
              hint: (insertRes.error as any)?.hint,
              sessionId: sessionRes.data.id,
            })
            insertError = insertRes.error
          }
        } else if (!insertRes.data) {
          // Edge case: no error but also no data
          log("error", "join_participant_insert_no_data", {
            traceId,
            sessionId: sessionRes.data.id,
          })
          return jsonResponse(
            { error: "Failed to create participant", traceId },
            500
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
      const isDuplicateKey = errorCode === "23505" || 
                            insertError.message?.includes("duplicate key") ||
                            insertError.message?.includes("unique constraint")
      
      // If we still have a duplicate key error here, try one more time to fetch existing participant
      if (isDuplicateKey && !participantId) {
        logInfo("join_duplicate_final_attempt", withTrace({
          error: insertError.message,
          code: errorCode,
          sessionId: sessionRes.data.id,
          guestKey: finalGuestKey,
          stage: "final_duplicate_handling",
        }, traceId))
        
        const { data: existingParticipant, error: fetchError } = await adminSupabase
          .from("participants")
          .select("id, status, display_name")
          .eq("session_id", sessionRes.data.id)
          .eq("guest_key", finalGuestKey)
          .single()
        
        if (fetchError) {
          logError("join_duplicate_final_fetch_error", withTrace({
            error: fetchError.message,
            code: (fetchError as any)?.code,
            details: (fetchError as any)?.details,
            sessionId: sessionRes.data.id,
            guestKey: finalGuestKey,
            stage: "final_duplicate_fetch_error",
          }, traceId))
          // Even if fetch fails, we know participant exists (duplicate key error)
          // Return success anyway - the frontend will handle refreshing to get the participant
          return jsonResponse(
            { 
              ok: true, 
              traceId, 
              participantId: null, // We couldn't fetch it, but it exists
              alreadyJoined: true,
              waitlisted: false, // Unknown status, but treat as joined
            },
            200
          )
        }
        
        if (existingParticipant) {
          participantId = existingParticipant.id
          logInfo("join_already_joined_final", withTrace({
            participantId: existingParticipant.id,
            status: existingParticipant.status,
            displayName: existingParticipant.display_name,
            sessionId: sessionRes.data.id,
            stage: "final_duplicate_success",
          }, traceId))
          
          // Return success with alreadyJoined flag
          return jsonResponse(
            { 
              ok: true, 
              traceId, 
              participantId: existingParticipant.id,
              alreadyJoined: true,
              waitlisted: existingParticipant.status === "waitlisted",
              joinedAs: existingParticipant.status === "waitlisted" ? "waitlist" : "joined",
            },
            200
          )
        } else {
          logError("join_duplicate_final_no_participant", withTrace({
            sessionId: sessionRes.data.id,
            guestKey: finalGuestKey,
            stage: "final_duplicate_no_participant",
          }, traceId))
          // Even if we can't find the participant, we know it exists (duplicate key error)
          // Return success anyway
          return jsonResponse(
            { 
              ok: true, 
              traceId, 
              participantId: null,
              alreadyJoined: true,
              waitlisted: false,
              joinedAs: "joined", // Default to joined if we can't determine
            },
            200
          )
        }
      }
      
      log("error", "join_participant_insert_failed", {
        traceId,
        error: insertError.message,
        code: errorCode,
        details: errorDetails,
        hint: errorHint,
        isRLSError,
        isDuplicateKey,
        sessionId: sessionRes.data.id,
        guestKey: finalGuestKey,
      })
      
      // For duplicate key errors that we couldn't resolve, return 500 (shouldn't happen in normal flow)
      if (isDuplicateKey && !participantId) {
        logError("join_duplicate_unresolved", withTrace({
          error: insertError.message,
          code: errorCode,
          sessionId: sessionRes.data.id,
          guestKey: finalGuestKey,
          stage: "unresolved_duplicate",
        }, traceId))
        return jsonResponse(
          {
            error: "Internal error: Unable to resolve duplicate join",
            detail: insertError.message,
            code: errorCode,
            traceId,
          },
          500
        )
      }
      
      return jsonResponse(
        {
          error: isRLSError 
            ? "Permission denied. Please check your session permissions."
            : "Join failed",
          detail: insertError.message,
          code: errorCode,
          traceId,
        },
        403
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
    // Log the full error for debugging
    console.error("[join] Unhandled error:", {
      traceId,
      message: e?.message,
      stack: e?.stack,
      name: e?.name,
      cause: e?.cause,
      error: e,
    })
    
    log("error", "join_unhandled", { 
      traceId, 
      message: e?.message, 
      stack: e?.stack,
      name: e?.name,
      cause: e?.cause,
    })
    
    // Always return JSON, never HTML - use try-catch to ensure we never throw
    try {
      return jsonResponse(
        { 
          error: "Internal error", 
          detail: e?.message || "An unexpected error occurred",
          traceId 
        },
        500
      )
    } catch (responseError: any) {
      // If even jsonResponse fails, return a plain JSON response
      console.error("[join] Failed to create JSON response:", responseError)
      return new NextResponse(
        JSON.stringify({ 
          error: "Internal error", 
          detail: "Failed to process request",
          traceId 
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }
  }
}

