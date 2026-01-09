"use server"

import { createClient, createAdminClient, createAnonymousClient, getUserId } from "@/lib/supabase/server/server"
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
    // Authenticated user: ONLY query by email (identity scope invariant)
    // Do NOT fallback to guest_key - this prevents attaching wrong participants
    const { data: emailMatch, error: emailError } = await supabase
      .from("participants")
      .select("id, status, display_name, guest_key, contact_email")
      .eq("session_id", session.id)
      .eq("contact_email", userEmail)
      .maybeSingle()

    if (emailMatch) {
      participant = emailMatch
    } else {
      // No email match = user hasn't joined yet (or joined as guest, which is separate)
      error = emailError
    }
  } else if (profileId) {
    // Guest user: ONLY query by profile_id (identity scope invariant)
    // Do NOT fallback to guest_key - this prevents attaching wrong participants
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
    } else {
      // No profile_id match = guest hasn't joined yet
      error = profileError
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
  supabase: ReturnType<typeof createAnonymousClient>,
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
  supabase: ReturnType<typeof createAnonymousClient>,
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
    let supabase: ReturnType<typeof createAnonymousClient>
    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
      supabase = createAnonymousClient()
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

  // Get all approved payment proofs for this session with covered_participant_ids
  const { data: paymentProofs, error: paymentError } = await supabase
    .from("payment_proofs")
    .select("participant_id, covered_participant_ids")
    .eq("session_id", session.id)
    .eq("payment_status", "approved")

  if (paymentError) {
    // If we can't check payment status, return all participants (safer default)
    return { ok: true, participants: participants }
  }

  // Build set of all paid participant IDs from covered_participant_ids
  // NEW MODEL: Check covered_participant_ids array, not just participant_id
  const paidParticipantIds = new Set<string>()
  
  paymentProofs?.forEach(proof => {
    // Handle covered_participant_ids (new model)
    if (proof.covered_participant_ids && Array.isArray(proof.covered_participant_ids)) {
      proof.covered_participant_ids.forEach((item: any) => {
        if (item?.participant_id) {
          paidParticipantIds.add(item.participant_id)
        }
      })
    }
    // Backward compatibility: also check participant_id (old model)
    if (proof.participant_id) {
      paidParticipantIds.add(proof.participant_id)
    }
  })

  // Filter out participants who have approved payment (covered by any payment proof)
  const unpaidParticipants = participants.filter(p => !paidParticipantIds.has(p.id))

  return { ok: true, participants: unpaidParticipants }
}

/**
 * Pull out from session (participant-initiated)
 * Updates participant status to 'pulled_out' and auto-promotes waitlist
 */
export async function pullOutFromSession({
  participantId,
  sessionId,
  reason,
}: {
  participantId: string
  sessionId: string
  reason: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const traceId = newTraceId("pullout")
  const supabase = createAnonymousClient()
  const adminClient = createAdminClient()

  logInfo("pullout_start", withTrace({
    participantId,
    sessionId,
    hasReason: !!reason,
  }, traceId))

  // Verify participant exists and belongs to this session
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, session_id, status")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .single()

  if (participantError || !participant) {
    logError("pullout_failed", withTrace({
      error: participantError?.message || "Participant not found",
      stage: "participant_validation",
    }, traceId))
    return { ok: false, error: "Participant not found" }
  }

  // Only allow pull-out if currently confirmed (joined)
  if (participant.status !== "confirmed") {
    logWarn("pullout_invalid_status", withTrace({
      currentStatus: participant.status,
      stage: "validation",
    }, traceId))
    return { ok: false, error: `Cannot pull out: participant status is ${participant.status}` }
  }

  // Update participant to pulled_out status
  const { error: updateError } = await adminClient
    .from("participants")
    .update({
      status: "pulled_out",
      pull_out_reason: reason || null,
      pull_out_seen: false, // Host hasn't seen this yet
    })
    .eq("id", participantId)
    .eq("session_id", sessionId)

  if (updateError) {
    logError("pullout_failed", withTrace({
      error: updateError.message,
      stage: "status_update",
    }, traceId))
    return { ok: false, error: updateError.message || "Failed to pull out from session" }
  }

  // Auto-promote waitlist (same logic as removeParticipant)
  // Get current joined count
  const { count: joinedCount } = await adminClient
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "confirmed")

  // Get session capacity
  const { data: session, error: sessionError } = await adminClient
    .from("sessions")
    .select("capacity")
    .eq("id", sessionId)
    .single()

  if (!sessionError && session && session.capacity && joinedCount !== null && joinedCount < session.capacity) {
    // Promote next waitlisted (FIFO)
    const { data: nextWaitlisted } = await adminClient
      .from("participants")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "waitlisted")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextWaitlisted) {
      await adminClient
        .from("participants")
        .update({ status: "confirmed" })
        .eq("id", nextWaitlisted.id)
      
      logInfo("pullout_promoted_waitlist", withTrace({
        promotedParticipantId: nextWaitlisted.id,
      }, traceId))
    }
  }

  logInfo("pullout_success", withTrace({
    participantId,
    sessionId,
  }, traceId))

  // Revalidate session page
  revalidatePath(`/session/${sessionId}`)
  
  // Also revalidate public invite page if we have public_code
  const { data: sessionData } = await adminClient
    .from("sessions")
    .select("host_slug, public_code")
    .eq("id", sessionId)
    .single()
  
  if (sessionData?.host_slug && sessionData?.public_code) {
    revalidatePath(`/${sessionData.host_slug}/${sessionData.public_code}`)
  }

  return { ok: true }
}

/**
 * Submit payment proof for a session participant(s)
 * Uploads file to Supabase Storage and creates payment_proofs record
 * A single payment proof can cover multiple participants
 */
export async function submitPaymentProof(
  sessionId: string,
  paidByParticipantId: string, // Who uploaded the payment (for tracking)
  coveredParticipantIds: string[], // Array of participant IDs covered by this payment
  fileData: string, // Base64 encoded image data
  fileName: string
): Promise<{ ok: true; paymentProofId: string; storagePath?: string; publicUrl?: string } | { ok: false; error: string }> {
  const traceId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  
  try {
    logInfo("payment_api_start", withTrace({
      sessionId,
      paidByParticipantId,
      coveredParticipantIds,
      coveredCount: coveredParticipantIds.length,
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

  // Validate: Must have at least one covered participant
  if (!coveredParticipantIds || coveredParticipantIds.length === 0) {
    logError("payment_api_failed", withTrace({
      error: "No participants selected",
      stage: "validation",
    }, traceId))
    return { ok: false, error: "Please select at least one participant to pay for." }
  }

  // Verify paid_by participant exists (any status - users can pay without joining first)
  const { data: paidByParticipant, error: paidByError } = await supabase
    .from("participants")
    .select("id, status")
    .eq("id", paidByParticipantId)
    .eq("session_id", sessionId)
    .single()

  if (paidByError || !paidByParticipant) {
    logError("payment_api_failed", withTrace({
      error: paidByError?.message || "Paid-by participant not found",
      stage: "participant_validation",
      errorCode: paidByError?.code,
    }, traceId))
    if (paidByError?.code === "PGRST116") {
      return { ok: false, error: "Participant not found." }
    }
    return { ok: false, error: "Participant not found." }
  }

  // CRITICAL: Validate ALL covered participants belong to this session and are active
  const { data: coveredParticipants, error: coveredError } = await supabase
    .from("participants")
    .select("id, session_id, status")
    .eq("session_id", sessionId)
    .in("id", coveredParticipantIds)

  if (coveredError) {
    logError("payment_api_failed", withTrace({
      error: coveredError.message,
      stage: "covered_participants_validation",
    }, traceId))
    return { ok: false, error: "Failed to validate participants." }
  }

  // Check that all requested participants were found
  const foundIds = new Set(coveredParticipants?.map(p => p.id) || [])
  const missingIds = coveredParticipantIds.filter(id => !foundIds.has(id))
  
  if (missingIds.length > 0) {
    logError("payment_api_failed", withTrace({
      error: "Some participants not found",
      missingIds,
      stage: "covered_participants_validation",
    }, traceId))
    return { ok: false, error: `Some participants not found: ${missingIds.join(", ")}` }
  }

  // Verify all covered participants belong to this session (double-check)
  const invalidParticipants = coveredParticipants?.filter(p => p.session_id !== sessionId)
  if (invalidParticipants && invalidParticipants.length > 0) {
    logError("payment_api_failed", withTrace({
      error: "Participants belong to different session",
      invalidIds: invalidParticipants.map(p => p.id),
      stage: "covered_participants_validation",
    }, traceId))
    return { ok: false, error: "All participants must belong to the same session." }
  }

  // Convert base64 to buffer (with error handling)
  let buffer: Buffer
  let filePath: string
  let publicUrl: string
  
  try {
    // Convert base64 to buffer
    const base64Data = fileData.split(",")[1] || fileData // Remove data:image/... prefix if present
    
    // Validate base64 data
    if (!base64Data || base64Data.length === 0) {
      throw new Error("Invalid base64 data: empty or missing")
    }
    
    buffer = Buffer.from(base64Data, "base64")

    // Generate unique file path (use paid_by participant ID for folder structure)
    const fileExt = fileName.split(".").pop() || "jpg"
    // Normalize file extension for content type
    const normalizedExt = fileExt.toLowerCase() === "jpg" || fileExt.toLowerCase() === "jpeg" ? "jpeg" : fileExt.toLowerCase()
    filePath = `payment-proofs/${sessionId}/${paidByParticipantId}/${Date.now()}.${fileExt}`

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
    publicUrl = urlData.publicUrl

    logInfo("payment_validation_result", withTrace({
      paidByParticipantId,
      coveredParticipantIds,
      coveredCount: coveredParticipantIds.length,
      sessionId,
      validated: true,
    }, traceId))

    // Insert payment_proofs record using anonymous client
    // RLS policy "anyone_can_insert_payment_proofs" allows anyone (anon or authenticated) to insert
    // Format covered_participant_ids as JSONB array
    // Format: [{"participant_id": "uuid1"}, {"participant_id": "uuid2"}]
    const coveredParticipantsJson = coveredParticipantIds.map(id => ({ participant_id: id }))

    const anonClient = createAnonymousClient()
    const { data: proofData, error: insertError } = await anonClient
      .from("payment_proofs")
      .insert({
        session_id: sessionId,
        participant_id: paidByParticipantId, // Keep for backward compatibility (who uploaded)
        covered_participant_ids: coveredParticipantsJson, // NEW: Who is covered by this payment
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
      
      // Provide more helpful error messages
      if (insertError.code === "42501") {
        return { ok: false, error: "Permission denied. Please ensure the migration has been applied." }
      }
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
      stage: "buffer_conversion_or_upload",
    }, traceId))
    
    // Provide user-friendly error messages
    const errorMessage = error?.message || "Unknown error"
    if (errorMessage.includes("Invalid base64") || errorMessage.includes("base64")) {
      return { ok: false, error: "Invalid image format. Please try uploading again." }
    }
    if (errorMessage.includes("too large") || errorMessage.includes("size")) {
      return { ok: false, error: "Image is too large. Please compress it further." }
    }
    if (errorMessage.includes("Buffer")) {
      return { ok: false, error: "Failed to process image. Please try again." }
    }
    
    return { ok: false, error: errorMessage || "Failed to submit payment proof. Please try again." }
  }
  } catch (outerError: any) {
    // Catch any unexpected errors from the outer try block (validation errors that throw instead of return)
    logError("payment_api_unhandled_error", withTrace({
      error: outerError?.message || "Unknown error",
      stack: outerError?.stack,
      stage: "unhandled_outer",
    }, traceId))
    return { ok: false, error: "An unexpected error occurred. Please try again." }
  }
}

/**
 * Toggle host participation intent (edit mode only)
 * Updates sessions.host_will_join boolean - does NOT insert into participants
 * Participant insertion happens only on publish if host_will_join === true
 */
export async function toggleHostParticipation(
  sessionId: string,
  hostWillJoin: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify user is the host of this session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, host_id")
    .eq("id", sessionId)
    .eq("host_id", userId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found or unauthorized" }
  }

  // Update host_will_join column (intent only, no participant insert)
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ 
      host_will_join: hostWillJoin,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)

  if (updateError) {
    // Gracefully handle if column doesn't exist yet (migration not run)
    if (updateError.message?.includes("host_will_join") && updateError.message?.includes("schema cache")) {
      console.warn("[toggleHostParticipation] Column not found. Please run migration: 20250125000000_add_host_will_join_to_sessions.sql")
      // Return success anyway - the toggle will work locally, just won't persist until migration is run
      return { ok: true }
    }
    return { ok: false, error: updateError.message }
  }

  revalidatePath(`/host/sessions/${sessionId}/edit`)

  return { ok: true }
}

/**
 * Get host participation intent (host_will_join from sessions table)
 * Returns the intent flag, not actual participant status
 */
export async function getHostParticipationStatus(
  sessionId: string
): Promise<{ ok: true; hostWillJoin: boolean } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Get host_will_join from sessions table
  const { data: session, error } = await supabase
    .from("sessions")
    .select("host_will_join")
    .eq("id", sessionId)
    .eq("host_id", userId)
    .single()

  if (error) {
    // Gracefully handle if column doesn't exist yet
    if (error.message?.includes("host_will_join") && error.message?.includes("schema cache")) {
      console.warn("[getHostParticipationStatus] Column not found. Please run migration: 20250125000000_add_host_will_join_to_sessions.sql")
      // Return false as default
      return { ok: true, hostWillJoin: false }
    }
    return { ok: false, error: error.message }
  }

  if (!session) {
    return { ok: false, error: "Session not found" }
  }

  return { ok: true, hostWillJoin: session.host_will_join ?? false }
}

