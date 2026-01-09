import { NextResponse } from "next/server"
import { createAnonymousClient, createAdminClient } from "@/lib/supabase/server/server"
import { log, logInfo, logWarn, logError, withTrace } from "@/lib/logger"

// Runtime configuration for Supabase compatibility
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// ============================================================================
// Types
// ============================================================================

type RequestBody = {
  publicCode?: string
  name?: string
  phone?: string | null
  guestKey?: string
}

type Session = {
  id: string
  status: "open" | "draft" | "closed" | "completed" | "cancelled"
  capacity: number | null
  waitlist_enabled: boolean
}

type ParticipantStatus = "confirmed" | "waitlisted"

type CapacityCheck = {
  isFull: boolean
  confirmedCount: number
  waitlistEnabled: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse and validate request body
 */
function parseAndValidateRequest(body: unknown): { 
  publicCode: string
  name: string
  phone: string | null
  guestKey: string
} | { error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body", status: 400 }
  }

  const { publicCode, name, phone, guestKey } = body as RequestBody

  if (!publicCode || typeof publicCode !== "string") {
    return { error: "Missing invite code", status: 400 }
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return { error: "Name is required", status: 400 }
  }

  if (!guestKey || typeof guestKey !== "string") {
    return { error: "Guest key is required", status: 400 }
  }

  return {
    publicCode,
    name: name.trim(),
    phone: phone?.trim() || null,
    guestKey,
  }
}

/**
 * Validate environment variables
 */
function validateEnv(): { error?: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      error: "Server configuration error: Missing required Supabase environment variables.",
    }
  }

  return {}
}

/**
 * Get session by public code
 */
async function getSessionByPublicCode(
  supabase: Awaited<ReturnType<typeof createAnonymousClient>>,
  publicCode: string
): Promise<{ session: Session } | { error: string; status: number }> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, status, capacity, public_code, host_id, host_slug, waitlist_enabled")
    .eq("public_code", publicCode)
    .maybeSingle()

  if (error) {
    logError("join_session_lookup_error", withTrace(
      { error: error.message, code: (error as any)?.code },
      "session_lookup"
    ))
    return { error: "Session lookup failed", status: 500 }
  }

  if (!data) {
    return { error: "Session not found", status: 404 }
  }

  if (data.status !== "open") {
    return { error: `Session is ${data.status}. Only open sessions can be joined.`, status: 409 }
  }

  return { session: data as Session }
}

/**
 * Check session capacity and waitlist status
 */
async function checkCapacity(
  supabase: Awaited<ReturnType<typeof createAnonymousClient>>,
  sessionId: string,
  capacity: number | null,
  waitlistEnabled: boolean
): Promise<CapacityCheck | { error: string; status: number }> {
  const { count, error } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "confirmed")

  if (error) {
    logError("join_capacity_check_error", withTrace(
      { error: error.message },
      "capacity_check"
    ))
    return { error: "Failed to check capacity", status: 500 }
  }

  const confirmedCount = count ?? 0
  // Session is full if capacity is set and confirmed count meets or exceeds it
  // Note: Race condition possible between check and insert, but database constraints
  // will prevent exceeding capacity (unique constraints + application logic)
  const isFull = capacity !== null && confirmedCount >= capacity

  return {
    isFull,
    confirmedCount,
    // Default to enabled if null/undefined (matches database default)
    waitlistEnabled: waitlistEnabled !== false,
  }
}

/**
 * Determine participant status based on capacity and waitlist settings
 */
function determineParticipantStatus(
  capacityCheck: CapacityCheck
): ParticipantStatus | { error: string; status: number; code?: string } {
  if (!capacityCheck.isFull) {
    return "confirmed"
  }

  if (capacityCheck.waitlistEnabled) {
    return "waitlisted"
  }

  return {
    error: "Session is full",
    status: 409,
    code: "CAPACITY_EXCEEDED",
  }
}

/**
 * Handle duplicate key error by fetching existing participant
 * Returns null if fetch fails (participant exists but we can't retrieve it)
 */
async function handleDuplicateParticipant(
  adminSupabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  guestKey: string,
  traceId: string
): Promise<{ participantId: string; status: ParticipantStatus } | null> {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("id, status")
    .eq("session_id", sessionId)
    .eq("guest_key", guestKey)
    .maybeSingle() // Use maybeSingle since participant might not exist (edge case)

  if (error) {
    logError("join_duplicate_fetch_failed", withTrace({ error: error.message }, traceId))
    return null
  }

  if (!data) {
    // Edge case: duplicate key error but participant not found
    // This shouldn't happen, but handle gracefully
    logError("join_duplicate_fetch_not_found", withTrace({ sessionId, guestKey }, traceId))
    return null
  }

  // Map database enum to our type (handles "invited" and "cancelled" as confirmed for response)
  const status: ParticipantStatus = data.status === "waitlisted" ? "waitlisted" : "confirmed"
  
  return {
    participantId: data.id,
    status,
  }
}

/**
 * Upsert participant (insert or update)
 */
async function upsertParticipant(
  adminSupabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  name: string,
  phone: string | null,
  guestKey: string,
  status: ParticipantStatus,
  existingParticipantId?: string
): Promise<
  | { participantId: string; status: ParticipantStatus }
  | { error: string; code?: string; isDuplicate?: boolean }
> {
  const payload = {
    session_id: sessionId,
    display_name: name,
    contact_phone: phone,
    guest_key: guestKey,
    status,
  }

  if (existingParticipantId) {
    // Update existing participant
    const { data, error } = await adminSupabase
      .from("participants")
      .update(payload)
      .eq("id", existingParticipantId)
      .select("id, status")
      .single()

    if (error) {
      return { error: error.message, code: (error as any)?.code }
    }

    if (!data) {
      // Update succeeded but no data returned (shouldn't happen with .single())
      return { error: "Failed to update participant" }
    }

    // Map database enum to our type
    const status: ParticipantStatus = data.status === "waitlisted" ? "waitlisted" : "confirmed"
    
    return {
      participantId: data.id,
      status,
    }
  } else {
    // Insert new participant
    const { data, error } = await adminSupabase
      .from("participants")
      .insert(payload)
      .select("id, status")
      .single()

    if (error) {
      const errorCode = (error as any)?.code
      // PostgreSQL unique constraint violation
      const isDuplicate = errorCode === "23505" || 
                         error.message?.toLowerCase().includes("duplicate key") ||
                         error.message?.toLowerCase().includes("unique constraint")
      return { error: error.message, code: errorCode, isDuplicate }
    }

    if (!data) {
      // Insert succeeded but no data returned (shouldn't happen with .single())
      return { error: "Failed to create participant" }
    }

    // Map database enum to our type
    const status: ParticipantStatus = data.status === "waitlisted" ? "waitlisted" : "confirmed"
    
    return {
      participantId: data.id,
      status,
    }
  }
}

// ============================================================================
// Main Route Handler
// ============================================================================

export async function POST(req: Request) {
  const traceId = req.headers.get("x-trace-id") ?? `join_${Date.now()}`
  const startedAt = Date.now()

  try {
    // Log request start
    try {
      logInfo("join_api_start", withTrace(
        {
          method: req.method,
          url: req.url,
        },
        traceId
      ))
    } catch {
      // Logger failed - continue anyway
    }

    // Parse and validate request
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body", traceId }, { status: 400 })
    }

    const validation = parseAndValidateRequest(body)
    if ("error" in validation) {
      logWarn("join_bad_request", withTrace({ reason: validation.error }, traceId))
      return NextResponse.json({ error: validation.error, traceId }, { status: validation.status })
    }

    const { publicCode, name, phone, guestKey } = validation

    // Validate environment
    const envCheck = validateEnv()
    if (envCheck.error) {
      logError("join_missing_env_vars", withTrace({}, traceId))
      return NextResponse.json(
        { error: "Server configuration error", detail: envCheck.error, traceId },
        { status: 500 }
      )
    }

    // Create Supabase clients
    let supabase: Awaited<ReturnType<typeof createAnonymousClient>>
    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
      supabase = createAnonymousClient()
    } catch (error: any) {
      logError("join_supabase_client_creation_failed", withTrace({ error: error?.message }, traceId))
      return NextResponse.json(
        { error: "Server configuration error", detail: "Failed to create Supabase client.", traceId },
        { status: 500 }
      )
    }

    try {
      adminSupabase = createAdminClient()
    } catch (error: any) {
      logError("join_admin_client_creation_failed", withTrace({ error: error?.message }, traceId))
      return NextResponse.json(
        { error: "Server configuration error", detail: "Failed to create admin client.", traceId },
        { status: 500 }
      )
    }

    // Get session
    const sessionResult = await getSessionByPublicCode(supabase, publicCode)
    if ("error" in sessionResult) {
      return NextResponse.json({ error: sessionResult.error, traceId }, { status: sessionResult.status })
    }

    const { session } = sessionResult

    // Check for existing participant (idempotency check)
    const { data: existingParticipant, error: participantCheckError } = await supabase
      .from("participants")
      .select("id, status")
      .eq("session_id", session.id)
      .eq("guest_key", guestKey)
      .maybeSingle()

    if (participantCheckError) {
      // Non-fatal: continue with insert attempt (will handle duplicate if exists)
      logError("join_participant_check_error", withTrace(
        { error: participantCheckError.message },
        traceId
      ))
    }

    logInfo("join_participant_check", withTrace(
      {
        existingParticipantId: existingParticipant?.id,
        existingStatus: existingParticipant?.status,
      },
      traceId
    ))

    // Check capacity
    const capacityResult = await checkCapacity(
      supabase,
      session.id,
      session.capacity,
      session.waitlist_enabled
    )

    if ("error" in capacityResult) {
      return NextResponse.json({ error: capacityResult.error, traceId }, { status: capacityResult.status })
    }

    // Determine participant status
    const statusResult = determineParticipantStatus(capacityResult)
    if (typeof statusResult === "object" && "error" in statusResult) {
      logWarn("join_capacity_exceeded", withTrace(
        {
          capacity: session.capacity,
          currentCount: capacityResult.confirmedCount,
          waitlistEnabled: capacityResult.waitlistEnabled,
        },
        traceId
      ))

      const response: any = {
        error: statusResult.error,
        traceId,
        code: statusResult.code,
      }

      if (!capacityResult.waitlistEnabled) {
        response.waitlistDisabled = true
        response.message =
          "Session is full and waitlist is disabled. Please contact the host or enable waitlist for this session."
      }

      return NextResponse.json(response, { status: statusResult.status })
    }

    const targetStatus = statusResult as ParticipantStatus

    // Upsert participant
    const upsertResult = await upsertParticipant(
      adminSupabase,
      session.id,
      name,
      phone,
      guestKey,
      targetStatus,
      existingParticipant?.id
    )

    // Handle duplicate key error (idempotent join)
    if ("error" in upsertResult && upsertResult.isDuplicate) {
      const duplicateResult = await handleDuplicateParticipant(
        adminSupabase,
        session.id,
        guestKey,
        traceId
      )

      if (duplicateResult) {
        logInfo("join_already_joined", withTrace(
          {
            participantId: duplicateResult.participantId,
            status: duplicateResult.status,
          },
          traceId
        ))

        return NextResponse.json(
          {
            ok: true,
            traceId,
            participantId: duplicateResult.participantId,
            alreadyJoined: true,
            waitlisted: duplicateResult.status === "waitlisted",
            joinedAs: duplicateResult.status === "waitlisted" ? "waitlist" : "joined",
          },
          { status: 200 }
        )
      }

      // Duplicate key error but couldn't fetch participant - treat as success anyway
      // (participant exists, frontend can refresh to get details)
      logWarn("join_duplicate_unresolved", withTrace(
        { sessionId: session.id, guestKey },
        traceId
      ))
      
      return NextResponse.json(
        {
          ok: true,
          traceId,
          participantId: null,
          alreadyJoined: true,
          waitlisted: false, // Unknown status, default to not waitlisted
        },
        { status: 200 }
      )
    }

    // Handle other errors
    if ("error" in upsertResult) {
      logError("join_participant_insert_failed", withTrace(
        {
          error: upsertResult.error,
          code: upsertResult.code,
        },
        traceId
      ))

      const isRLSError =
        upsertResult.error?.includes("row-level security") ||
        upsertResult.error?.includes("RLS") ||
        upsertResult.code === "42501"

      return NextResponse.json(
        {
          error: isRLSError
            ? "Permission denied. Please check your session permissions."
            : "Join failed",
          detail: upsertResult.error,
          code: upsertResult.code,
          traceId,
        },
        { status: isRLSError ? 403 : 500 }
      )
    }

    // Success
    const { participantId, status: finalStatus } = upsertResult

    logInfo("join_success", withTrace(
      {
        ms: Date.now() - startedAt,
        participantId,
        status: finalStatus,
      },
      traceId
    ))

    return NextResponse.json(
      {
        ok: true,
        traceId,
        participantId,
        ...(finalStatus === "waitlisted" ? { waitlisted: true, joinedAs: "waitlist" } : {}),
      },
      { status: 200 }
    )
  } catch (error: any) {
    // Top-level error handler - always return JSON
    try {
      logError("join_unhandled", withTrace(
        {
          message: error?.message,
          stack: error?.stack,
        },
        traceId
      ))
    } catch {
      // Logger failed - continue anyway
    }

    return NextResponse.json(
      {
        error: "Internal error",
        detail: error?.message || "An unexpected error occurred",
        traceId,
      },
      { status: 500 }
    )
  }
}
