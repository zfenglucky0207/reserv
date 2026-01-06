"use server"

import { createClient, createAdminClient, createAnonymousClient } from "@/lib/supabase/server/server"
import { revalidatePath } from "next/cache"
import { logInfo, logError, logWarn, withTrace, newTraceId } from "@/lib/logger"

/**
 * Get participant RSVP status for a session (server-driven, user-specific)
 * For authenticated users: checks by email
 * For guests: checks by profile_id (guestKey UUID) or guest_key as fallback
 * Returns the current status if participant exists, null otherwise
 * 
 * This ensures join state is always fetched per current user/guest, not cached client-side
 * Guest identity is tied to guestKey (UUID), ensuring each guest is unique even with same name
 */
export async function getParticipantRSVPStatus(
  publicCode: string,
  guestKey: string | null,
  userId: string | null = null,
  userEmail: string | null = null,
  guestName: string | null = null
): Promise<{ ok: true; status: "confirmed" | "cancelled" | "waitlisted" | null; displayName?: string; participantId?: string } | { ok: false; error: string }> {
  const supabase = await createClient()

  // Lookup session by public_code
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("public_code", publicCode)
    .eq("status", "open")
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  // For guests: use guestKey as profile_id (UUID-based, unique per guest)
  // This ensures each guest is unique even if they have the same name
  const profileId = !userEmail && guestKey ? guestKey : null

  // For authenticated users: try to find participant by email or guest_key
  // For guests: find by profile_id first (name-based), then guest_key as fallback
  // CRITICAL: If not authenticated and no guest_key/profile_id, return "none" (user signed out)
  let participant = null
  let error = null

  if (userId && userEmail) {
    // Authenticated user: check by email first (more reliable), then fallback to guest_key
    const { data: emailMatch, error: emailError } = await supabase
      .from("participants")
      .select("id, status, display_name, guest_key, contact_email")
      .eq("session_id", session.id)
      .eq("contact_email", userEmail)
      .maybeSingle()

    if (emailMatch) {
      participant = emailMatch
    } else if (guestKey) {
      // Fallback to guest_key if no email match
      const { data: guestMatch, error: guestError } = await supabase
        .from("participants")
        .select("id, status, display_name, guest_key")
        .eq("session_id", session.id)
        .eq("guest_key", guestKey)
        .maybeSingle()

      if (guestMatch) {
        participant = guestMatch
      } else {
        error = guestError
      }
    } else {
      error = emailError
    }
  } else if (profileId) {
    // Guest user: check by profile_id (guestKey UUID) first - primary lookup
    const { data: profileMatch, error: profileError } = await supabase
      .from("participants")
      .select("id, status, display_name, guest_key, contact_email, profile_id")
      .eq("session_id", session.id)
      .eq("profile_id", profileId)
      .maybeSingle()

    if (profileMatch) {
      // Only return participant if it was created as a guest (no contact_email)
      // This prevents showing "joined" for authenticated users who signed out
      if (!profileMatch.contact_email) {
        participant = profileMatch
      }
    } else if (guestKey) {
      // Fallback to guest_key (for backward compatibility with old participants)
      const { data: guestMatch, error: guestError } = await supabase
        .from("participants")
        .select("id, status, display_name, guest_key, contact_email")
        .eq("session_id", session.id)
        .eq("guest_key", guestKey)
        .maybeSingle()

      // Only return participant if it was created as a guest (no contact_email)
      if (guestMatch && !guestMatch.contact_email) {
        participant = guestMatch
      } else {
        error = guestError
      }
    } else {
      error = profileError
    }
  } else if (guestKey) {
    // Legacy: guest with guest_key but no profile_id/name (shouldn't happen with new code)
    const { data: guestMatch, error: guestError } = await supabase
      .from("participants")
      .select("id, status, display_name, guest_key, contact_email")
      .eq("session_id", session.id)
      .eq("guest_key", guestKey)
      .maybeSingle()

    // Only return participant if it was created as a guest (no contact_email)
    if (guestMatch && !guestMatch.contact_email) {
      participant = guestMatch
    } else {
      error = guestError
    }
  } else {
    // No identifier provided (not authenticated, no guest_key, no name) = signed out
    return { ok: true, status: null }
  }

  if (error) {
    // Not found is OK (means no RSVP yet)
    if (error.code === "PGRST116") {
      return { ok: true, status: null }
    }
    return { ok: false, error: error.message }
  }

  if (!participant) {
    return { ok: true, status: null }
  }

  // Map status to our return type
  if (participant.status === "confirmed") {
    return { ok: true, status: "confirmed", displayName: participant.display_name, participantId: participant.id }
  } else if (participant.status === "cancelled") {
    return { ok: true, status: "cancelled", displayName: participant.display_name, participantId: participant.id }
  } else if (participant.status === "waitlisted") {
    return { ok: true, status: "waitlisted", displayName: participant.display_name, participantId: participant.id }
  }

  return { ok: true, status: null }
}

// ============================================================================
// Types
// ============================================================================

type Session = {
  id: string
  status: "open" | "draft" | "closed" | "completed" | "cancelled"
  capacity: number | null
  waitlist_enabled: boolean
  host_slug: string | null
  public_code: string
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
 * Get session by public code
 */
async function getSessionByPublicCode(
  supabase: Awaited<ReturnType<typeof createAnonymousClient>>,
  publicCode: string
): Promise<{ session: Session } | { error: string }> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, status, capacity, public_code, host_id, host_slug, waitlist_enabled, start_at")
    .eq("public_code", publicCode)
    .maybeSingle()

  if (error) {
    logError("join_session_lookup_error", withTrace(
      { error: error.message, code: (error as any)?.code },
      "session_lookup"
    ))
    return { error: "Session lookup failed" }
  }

  if (!data) {
    return { error: "Session not found" }
  }

  if (data.status !== "open") {
    return { error: `Session is ${data.status}. Only open sessions can be joined.` }
  }

  // Check if session has started - prevent joining after session starts
  const now = new Date()
  const sessionStart = new Date(data.start_at)
  if (now >= sessionStart) {
    return { error: "Session has already started. Joining is no longer available." }
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
): Promise<CapacityCheck | { error: string }> {
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
    return { error: "Failed to check capacity" }
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
): ParticipantStatus | { error: string; code: string } {
  if (!capacityCheck.isFull) {
    return "confirmed"
  }

  if (capacityCheck.waitlistEnabled) {
    return "waitlisted"
  }

  return {
    error: "Session is full",
    code: "CAPACITY_EXCEEDED",
  }
}

/**
 * Handle duplicate key error by fetching existing participant
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
    .maybeSingle()

  if (error) {
    logError("join_duplicate_fetch_failed", withTrace({ error: error.message }, traceId))
    return null
  }

  if (!data) {
    logError("join_duplicate_fetch_not_found", withTrace({ sessionId, guestKey }, traceId))
    return null
  }

  // Map database enum to our type
  const status: ParticipantStatus = data.status === "waitlisted" ? "waitlisted" : "confirmed"
  
  return {
    participantId: data.id,
    status,
  }
}

/**
 * Upsert participant (insert or update)
 * For guests: uses guestKey (UUID) as profile_id to ensure unique identity per guest
 * This allows multiple guests with the same name to exist independently
 */
async function upsertParticipant(
  adminSupabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  name: string,
  phone: string | null,
  guestKey: string,
  status: ParticipantStatus,
  existingParticipantId?: string,
  userEmail?: string | null
): Promise<
  | { participantId: string; status: ParticipantStatus }
  | { error: string; code?: string; isDuplicate?: boolean }
> {
  // For guests: use guestKey (UUID) as profile_id - ensures each guest is unique
  // This allows multiple guests with the same name to exist independently
  const profileId = !userEmail ? guestKey : null

  const payload = {
    session_id: sessionId,
    display_name: name,
    contact_phone: phone,
    contact_email: userEmail || null, // Store email for authenticated users to enable user-specific lookups
    guest_key: guestKey,
    profile_id: profileId, // Unique guest identifier (guestKey UUID) - ensures each guest is unique
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

/**
 * Join a session by public_code (create or update participant)
 * Enforces capacity limit server-side with waitlist support
 * Uses admin client for writes to bypass RLS
 */
export async function joinSession(
  publicCode: string,
  name: string,
  guestKey: string,
  phone?: string | null,
  traceId?: string
): Promise<
  | { 
      ok: true
      participantId: string | null
      waitlisted?: boolean
      alreadyJoined?: boolean
      joinedAs?: "waitlist" | "joined"
      traceId: string
    }
  | { 
      ok: false
      error: string
      code?: string
      traceId: string
    }
> {
  const finalTraceId = traceId ?? newTraceId("join")
  const startedAt = Date.now()

  try {
    // Validate inputs
    if (!publicCode || typeof publicCode !== "string") {
      return { ok: false, error: "Missing invite code", traceId: finalTraceId }
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return { ok: false, error: "Name is required", traceId: finalTraceId }
    }

    if (!guestKey || typeof guestKey !== "string") {
      return { ok: false, error: "Guest key is required", traceId: finalTraceId }
  }

  const trimmedName = name.trim()
  const trimmedPhone = phone?.trim() || null

    // Create Supabase clients
    let supabase: Awaited<ReturnType<typeof createAnonymousClient>>
    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
      supabase = await createAnonymousClient()
    } catch (error: any) {
      logError("join_supabase_client_creation_failed", withTrace({ error: error?.message }, finalTraceId))
      return { ok: false, error: "Server configuration error", traceId: finalTraceId }
    }

    try {
      adminSupabase = createAdminClient()
    } catch (error: any) {
      logError("join_admin_client_creation_failed", withTrace({ error: error?.message }, finalTraceId))
      return { ok: false, error: "Server configuration error", traceId: finalTraceId }
    }

    // Get session
    const sessionResult = await getSessionByPublicCode(supabase, publicCode)
    if ("error" in sessionResult) {
      return { ok: false, error: sessionResult.error, traceId: finalTraceId }
    }

    const { session } = sessionResult

    // Get current user info (if authenticated) for user-specific participant lookup
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const userEmail = currentUser?.email || null

    // For guests: use guestKey (UUID) as profile_id - ensures each guest is unique
    // This allows multiple guests with the same name to exist independently
    // Note: profileId may be updated if guest name changes (see existing participant check below)
    let profileId = !userEmail ? guestKey : null

    // Check for existing participant (idempotency check)
    // For authenticated users: check by email first, then guest_key
    // For guests: check by profile_id (guestKey) first, then guest_key as fallback
    let existingParticipant = null
    let participantCheckError = null

    if (userEmail) {
      // Authenticated user: try email first
      const { data: emailMatch, error: emailError } = await supabase
        .from("participants")
        .select("id, status, contact_email")
        .eq("session_id", session.id)
        .eq("contact_email", userEmail)
        .maybeSingle()

      if (emailMatch) {
        existingParticipant = emailMatch
      } else if (guestKey) {
        // Fallback to guest_key - but only use it if it's an authenticated user's participant
        // If it's a guest participant (no contact_email), don't use it - create new participant instead
        const { data: guestMatch, error: guestError } = await supabase
          .from("participants")
          .select("id, status, contact_email")
          .eq("session_id", session.id)
          .eq("guest_key", guestKey)
          .maybeSingle()

        // Only use this participant if it belongs to an authenticated user (has contact_email)
        // If it's a guest participant (no contact_email), ignore it and create a new one
        if (guestMatch && guestMatch.contact_email) {
          existingParticipant = guestMatch
        }
        // If guestMatch exists but has no contact_email, it's a guest participant - don't use it
        participantCheckError = guestError
      } else {
        participantCheckError = emailError
      }
    } else if (profileId) {
      // Guest user: check by profile_id (guestKey UUID) first - primary lookup
      const { data: profileMatch, error: profileError } = await supabase
        .from("participants")
        .select("id, status, display_name")
        .eq("session_id", session.id)
        .eq("profile_id", profileId)
        .maybeSingle()

      if (profileMatch) {
        // Only use existing participant if the name matches (idempotent join)
        // If name is different, treat as new guest and create new participant with new profile_id
        if (profileMatch.display_name === trimmedName) {
          existingParticipant = profileMatch
        } else {
          // Name changed - this is a different guest, generate new profile_id
          // Generate a new UUID for this new guest identity
          const newProfileId = crypto.randomUUID()
          // Update profileId to the new UUID so a new participant will be created
          profileId = newProfileId
          logInfo("join_guest_name_changed", withTrace(
            {
              existingName: profileMatch.display_name,
              newName: trimmedName,
              oldProfileId: profileId,
              newProfileId,
            },
            finalTraceId
          ))
        }
      } else if (guestKey) {
        // Fallback to guest_key (for backward compatibility)
        const { data: guestMatch, error: guestError } = await supabase
          .from("participants")
          .select("id, status, display_name, contact_email")
          .eq("session_id", session.id)
          .eq("guest_key", guestKey)
          .maybeSingle()

        // Only use if it's a guest participant (no contact_email) and name matches
        if (guestMatch && !guestMatch.contact_email && guestMatch.display_name === trimmedName) {
          existingParticipant = guestMatch
        } else if (guestMatch && !guestMatch.contact_email && guestMatch.display_name !== trimmedName) {
          // Name changed - generate new profile_id for new guest
          profileId = crypto.randomUUID()
          logInfo("join_guest_name_changed_fallback", withTrace(
            {
              existingName: guestMatch.display_name,
              newName: trimmedName,
              newProfileId: profileId,
            },
            finalTraceId
          ))
        }
        participantCheckError = guestError
      } else {
        participantCheckError = profileError
      }
    } else if (guestKey) {
      // Legacy: guest with guest_key but no profile_id (for backward compatibility)
      const { data: guestMatch, error: guestError } = await supabase
    .from("participants")
    .select("id, status")
    .eq("session_id", session.id)
    .eq("guest_key", guestKey)
        .maybeSingle()

      existingParticipant = guestMatch
      participantCheckError = guestError
    }

    if (participantCheckError) {
      // Non-fatal: continue with insert attempt (will handle duplicate if exists)
      logError("join_participant_check_error", withTrace(
        { error: participantCheckError.message },
        finalTraceId
      ))
    }

    // Optional: Check for duplicate name by display_name (if you want to prevent same names)
    // Note: This is optional - remove if you want to allow multiple guests with same name
    // Only check if we don't already have an existing participant (idempotent join)
    if (!userEmail && !existingParticipant) {
      const { data: duplicateCheck, error: duplicateError } = await supabase
      .from("participants")
        .select("id, display_name")
        .eq("session_id", session.id)
        .eq("display_name", trimmedName)
        .is("contact_email", null) // Only check guest participants (not authenticated users)
        .maybeSingle()

      if (duplicateCheck) {
        // Duplicate name found (different guest with same display_name)
        logWarn("join_duplicate_guest_name", withTrace(
          {
            guestName: trimmedName,
            existingParticipantId: duplicateCheck.id,
          },
          finalTraceId
        ))
        return {
          ok: false,
          error: `A guest with the name "${trimmedName}" already exists in this session. Please use a different name.`,
          traceId: finalTraceId,
        }
      }
    }

    logInfo("join_participant_check", withTrace(
      {
        existingParticipantId: existingParticipant?.id,
        existingStatus: existingParticipant?.status,
        profileId: profileId || null,
      },
      finalTraceId
    ))

    // Check capacity
    const capacityResult = await checkCapacity(
      supabase,
      session.id,
      session.capacity,
      session.waitlist_enabled
    )

    if ("error" in capacityResult) {
      return { ok: false, error: capacityResult.error, traceId: finalTraceId }
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
        finalTraceId
      ))

      return {
        ok: false,
        error: statusResult.error,
        code: statusResult.code,
        traceId: finalTraceId,
      }
    }

    const targetStatus = statusResult as ParticipantStatus

    // Upsert participant (include user email for authenticated users to enable user-specific lookups)
    const upsertResult = await upsertParticipant(
      adminSupabase,
      session.id,
      trimmedName,
      trimmedPhone,
      guestKey,
      targetStatus,
      existingParticipant?.id,
      userEmail
    )

    // Handle duplicate key error (idempotent join)
    if ("error" in upsertResult && upsertResult.isDuplicate) {
      const duplicateResult = await handleDuplicateParticipant(
        adminSupabase,
        session.id,
        guestKey,
        finalTraceId
      )

      if (duplicateResult) {
        logInfo("join_already_joined", withTrace(
          {
            participantId: duplicateResult.participantId,
            status: duplicateResult.status,
          },
          finalTraceId
        ))

    // Revalidate the session page
    if (session.host_slug && publicCode) {
      revalidatePath(`/${session.host_slug}/${publicCode}`)
    }

        return {
          ok: true,
          participantId: duplicateResult.participantId,
          alreadyJoined: true,
          waitlisted: duplicateResult.status === "waitlisted",
          joinedAs: duplicateResult.status === "waitlisted" ? "waitlist" : "joined",
          traceId: finalTraceId,
        }
      }

      // Duplicate key error but couldn't fetch participant - treat as success anyway
      logWarn("join_duplicate_unresolved", withTrace(
        { sessionId: session.id, guestKey },
        finalTraceId
      ))

      if (session.host_slug && publicCode) {
        revalidatePath(`/${session.host_slug}/${publicCode}`)
      }

      return {
        ok: true,
        participantId: null,
        alreadyJoined: true,
        waitlisted: false,
        traceId: finalTraceId,
    }
  }

    // Handle other errors
    if ("error" in upsertResult) {
      logError("join_participant_insert_failed", withTrace(
        {
          error: upsertResult.error,
          code: upsertResult.code,
        },
        finalTraceId
      ))

      return {
        ok: false,
        error: upsertResult.error,
        code: upsertResult.code,
        traceId: finalTraceId,
      }
    }

    // Success
    const { participantId, status: finalStatus } = upsertResult

    logInfo("join_success", withTrace(
      {
        ms: Date.now() - startedAt,
        participantId,
        status: finalStatus,
      },
      finalTraceId
    ))

    // Revalidate the session page
  if (session.host_slug && publicCode) {
    revalidatePath(`/${session.host_slug}/${publicCode}`)
  }

    return {
      ok: true,
      participantId,
      ...(finalStatus === "waitlisted" ? { waitlisted: true, joinedAs: "waitlist" as const } : {}),
      traceId: finalTraceId,
    }
  } catch (error: any) {
    // Top-level error handler
    logError("join_unhandled", withTrace(
      {
        message: error?.message,
        stack: error?.stack,
      },
      finalTraceId
    ))

    return {
      ok: false,
      error: error?.message || "An unexpected error occurred",
      traceId: finalTraceId,
    }
  }
}

/**
 * Decline a session by public_code (create or update participant with status "cancelled")
 * Uses UPSERT by (session_id, guest_key): updates existing participant or creates new one
 */
export async function declineSession(
  publicCode: string,
  name: string,
  guestKey: string,
  phone?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()

  // Lookup session by public_code
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, host_slug")
    .eq("public_code", publicCode)
    .eq("status", "open")
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found or not available" }
  }

  const trimmedName = name.trim()
  const trimmedPhone = phone?.trim() || null

  // Check if participant already exists by guest_key
  const { data: existingParticipant } = await supabase
    .from("participants")
    .select("id")
    .eq("session_id", session.id)
    .eq("guest_key", guestKey)
    .single()

  // If participant already exists, update status
  if (existingParticipant) {
    const { error: updateError } = await supabase
      .from("participants")
      .update({ 
        status: "cancelled",
        display_name: trimmedName,
        contact_phone: trimmedPhone,
      })
      .eq("id", existingParticipant.id)

    if (updateError) {
      return { ok: false, error: updateError.message }
    }

    // Revalidate the session page
    if (session.host_slug && publicCode) {
      revalidatePath(`/${session.host_slug}/${publicCode}`)
    }

    return { ok: true }
  }

  // Insert new participant with cancelled status
  const { error: insertError } = await supabase.from("participants").insert({
    session_id: session.id,
    display_name: trimmedName,
    contact_phone: trimmedPhone,
    guest_key: guestKey,
    status: "cancelled",
  })

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  // Revalidate the session page using the hostSlug/code format
  if (session.host_slug && publicCode) {
    revalidatePath(`/${session.host_slug}/${publicCode}`)
  }

  return { ok: true }
}

/**
 * Get participants for a session by public_code (public view - only "confirmed" status)
 */
export async function getSessionParticipants(publicCode: string): Promise<
  | { 
      ok: true
      participants: Array<{ id: string; display_name: string }>
      waitlist: Array<{ id: string; display_name: string }>
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient()

  // First get session ID from public_code
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("public_code", publicCode)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  // Get confirmed participants (going)
  const { data: confirmedData, error: confirmedError } = await supabase
    .from("participants")
    .select("id, display_name")
    .eq("session_id", session.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })

  if (confirmedError) {
    return { ok: false, error: confirmedError.message }
  }

  // Get waitlisted participants
  const { data: waitlistData, error: waitlistError } = await supabase
    .from("participants")
    .select("id, display_name")
    .eq("session_id", session.id)
    .eq("status", "waitlisted")
    .order("created_at", { ascending: true })

  if (waitlistError) {
    return { ok: false, error: waitlistError.message }
  }

  return { 
    ok: true, 
    participants: confirmedData || [],
    waitlist: waitlistData || []
  }
}

/**
 * Get unpaid participants for a session (confirmed participants without approved payment)
 */
export async function getUnpaidParticipants(
  publicCode: string
): Promise<{ ok: true; participants: Array<{ id: string; display_name: string }> } | { ok: false; error: string }> {
  const supabase = await createClient()

  // First get session ID from public_code
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("public_code", publicCode)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  // Get all confirmed participants
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name")
    .eq("session_id", session.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })

  if (participantsError) {
    return { ok: false, error: participantsError.message }
  }

  if (!participants || participants.length === 0) {
    return { ok: true, participants: [] }
  }

  // Get all approved payment proofs for this session
  const { data: paymentProofs, error: paymentError } = await supabase
    .from("payment_proofs")
    .select("participant_id")
    .eq("session_id", session.id)
    .eq("payment_status", "approved")

  if (paymentError) {
    // If we can't check payment status, return all participants (safer default)
    return { ok: true, participants: participants }
  }

  // Filter out participants who have approved payment
  const paidParticipantIds = new Set(paymentProofs?.map(p => p.participant_id) || [])
  const unpaidParticipants = participants.filter(p => !paidParticipantIds.has(p.id))

  return { ok: true, participants: unpaidParticipants }
}

/**
 * Submit payment proof for a session participant
 * Uploads file to Supabase Storage and creates payment_proofs record
 */
export async function submitPaymentProof(
  sessionId: string,
  participantId: string, // Changed: now accepts participantId directly
  fileData: string, // Base64 encoded image data
  fileName: string
): Promise<{ ok: true; paymentProofId: string; storagePath?: string; publicUrl?: string } | { ok: false; error: string }> {
  const traceId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  
  logInfo("payment_api_start", withTrace({
    sessionId,
    participantId,
    fileName,
    fileSize: fileData.length,
  }, traceId))

  const supabase = await createClient()

  // Verify session exists and is open
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("status", "open")
    .single()

  if (sessionError || !session) {
    logError("payment_api_failed", withTrace({
      error: sessionError?.message || "Session not found",
      stage: "session_validation",
    }, traceId))
    return { ok: false, error: "Session not found or not available" }
  }

  // Verify participant exists and is confirmed
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, status")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .eq("status", "confirmed") // Only allow payment if they're confirmed/joined
    .single()

  if (participantError || !participant) {
    logError("payment_api_failed", withTrace({
      error: participantError?.message || "Participant not found",
      stage: "participant_validation",
      errorCode: participantError?.code,
    }, traceId))
    if (participantError?.code === "PGRST116") {
      return { ok: false, error: "Participant not found. Please join the session first." }
    }
    return { ok: false, error: "Participant not found or not confirmed. Please join the session first." }
  }

  try {
    // Convert base64 to buffer
    const base64Data = fileData.split(",")[1] || fileData // Remove data:image/... prefix if present
    const buffer = Buffer.from(base64Data, "base64")

    // Generate unique file path
    const fileExt = fileName.split(".").pop() || "jpg"
    // Normalize file extension for content type
    const normalizedExt = fileExt.toLowerCase() === "jpg" || fileExt.toLowerCase() === "jpeg" ? "jpeg" : fileExt.toLowerCase()
    const filePath = `payment-proofs/${sessionId}/${participantId}/${Date.now()}.${fileExt}`

    // Use admin client for storage upload (bypasses RLS, but we've already validated participant on server)
    const adminClient = createAdminClient()
    
    logInfo("storage_upload_start", withTrace({
      filePath,
      contentType: `image/${normalizedExt}`,
      bufferSize: buffer.length,
    }, traceId))
    
    // Upload to Supabase Storage (using payment-proofs bucket)
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("payment-proofs")
      .upload(filePath, buffer, {
        contentType: `image/${normalizedExt}`,
        upsert: false,
        cacheControl: "3600",
      })

    if (uploadError) {
      logError("storage_upload_result", withTrace({
        error: uploadError.message,
        errorName: uploadError.name,
        stage: "storage_upload",
      }, traceId))
      
      // Provide more helpful error messages
      const errorMessage = uploadError.message || ""
      if (errorMessage.includes("not found") || errorMessage.includes("Bucket")) {
        return { ok: false, error: "Storage bucket not configured. Please contact support." }
      }
      if (errorMessage.includes("permission") || errorMessage.includes("denied")) {
        return { ok: false, error: "Permission denied. Please try again." }
      }
      if (errorMessage.includes("size") || errorMessage.includes("too large")) {
        return { ok: false, error: "Image is too large. Please use a smaller file." }
      }
      
      return { ok: false, error: `Failed to upload image: ${errorMessage || "Please try again."}` }
    }

    logInfo("storage_upload_result", withTrace({
      storagePath: filePath,
      success: true,
    }, traceId))

    // Get public URL using admin client
    const { data: urlData } = adminClient.storage.from("payment-proofs").getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    logInfo("payment_validation_result", withTrace({
      participantId,
      sessionId,
      validated: true,
    }, traceId))

    // Insert payment_proofs record using admin client (bypasses RLS, but we've validated participant exists)
    const { data: proofData, error: insertError } = await adminClient
      .from("payment_proofs")
      .insert({
        session_id: sessionId,
        participant_id: participantId,
        proof_image_url: publicUrl,
        payment_status: "pending_review",
        ocr_status: "pending",
      })
      .select("id")
      .single()

    if (insertError) {
      logError("final_status_written", withTrace({
        error: insertError.message,
        errorCode: insertError.code,
        stage: "db_insert",
      }, traceId))
      // Try to clean up uploaded file using admin client
      await adminClient.storage.from("payment-proofs").remove([filePath])
      return { ok: false, error: "Failed to save payment proof. Please try again." }
    }

    logInfo("final_status_written", withTrace({
      paymentProofId: proofData.id,
      paymentStatus: "pending_review",
      success: true,
    }, traceId))

    // Revalidate session page
    revalidatePath(`/session/${sessionId}`)

    return { ok: true, paymentProofId: proofData.id, storagePath: filePath, publicUrl }
  } catch (error: any) {
    logError("payment_api_failed", withTrace({
      error: error?.message || "Unknown error",
      stack: error?.stack,
      stage: "exception",
    }, traceId))
    return { ok: false, error: error?.message || "Failed to submit payment proof. Please try again." }
  }
}

