"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient, getUserId } from "@/lib/supabase/server/server"
import { redirect } from "next/navigation"
import { generateShortCode } from "@/lib/utils/short-code"
import { toSlug } from "@/lib/utils/slug"
import { logInfo, logWarn, logError, withTrace, newTraceId } from "@/lib/logger"

async function reconcileHostParticipantForSession({
  supabase,
  sessionId,
  hostId,
  hostNameFallback,
  traceId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  sessionId: string
  hostId: string
  hostNameFallback: string
  traceId: string
}) {
  // Read intent (host_joins_session is source of truth; host_will_join kept for compatibility)
  const { data: sessionRow, error: intentError } = await supabase
    .from("sessions")
    .select("host_joins_session, host_will_join, host_name")
    .eq("id", sessionId)
    .single()

  if (intentError || !sessionRow) {
    logWarn("host_participant_skipped", withTrace({ reason: "intent_read_failed", sessionId, error: intentError?.message }, traceId))
    return
  }

  const hostJoinsSession =
    (sessionRow as any).host_joins_session ??
    (sessionRow as any).host_will_join ??
    true

  // Host materialization requires an authenticated host (for email + ownership),
  // but uses service role for the actual write.
  const { data: { user } } = await supabase.auth.getUser()
  const userEmail = user?.email ?? null
  const hostName = (sessionRow as any).host_name || hostNameFallback
  const adminClient = createAdminClient()

  if (hostJoinsSession) {
    const payload = {
      session_id: sessionId,
      display_name: hostName,
      contact_email: userEmail, // nullable
      status: "confirmed",
      profile_id: hostId, // host_id as profile_id for idempotency
      is_host: true,
    }

    const { error: upsertError } = await adminClient
      .from("participants")
      .upsert(payload as any, { onConflict: "session_id,profile_id" })

    if (upsertError) {
      logError("host_participant_inserted_on_publish_failed", withTrace({ sessionId, error: upsertError.message, code: (upsertError as any)?.code }, traceId))
      return
    }

    logInfo("host_participant_inserted_on_publish", withTrace({ sessionId }, traceId))
    return
  }

  // host_joins_session === false → ensure host participant not present
  const { error: deleteError } = await adminClient
    .from("participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("profile_id", hostId)

  if (deleteError) {
    logWarn("host_participant_skipped", withTrace({ reason: "delete_failed", sessionId, error: deleteError.message }, traceId))
    return
  }

  logInfo("host_participant_skipped", withTrace({ reason: "host_joins_session_false", sessionId }, traceId))
}

/**
 * Get host's live (published) sessions
 */
export async function getHostLiveSessions(): Promise<
  | {
      ok: true
      sessions: Array<{
        id: string
        title: string
        start_at: string
        location: string | null
        capacity: number | null
        cover_url: string | null
        sport: "badminton" | "pickleball" | "volleyball" | "other"
        host_slug: string | null
        public_code: string | null
      }>
      count: number
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Get all live (published) sessions for this host
  // Only returns sessions with status = 'open' (published/live sessions)
  // Sessions with status = 'draft' are excluded (unpublished sessions)
  // Limit to 2 and ensure no duplicates
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, title, start_at, location, capacity, cover_url, sport, host_slug, public_code")
    .eq("host_id", userId)
    .eq("status", "open") // Only live/published sessions
    .order("created_at", { ascending: false })
    .limit(2)

  if (error) {
    return { ok: false, error: error.message }
  }

  // Deduplicate by id (in case of any edge cases)
  const uniqueSessions = Array.from(new Map((sessions || []).map(s => [s.id, s])).values())

  return {
    ok: true,
    sessions: uniqueSessions.slice(0, 2), // Hard cap at 2
    count: uniqueSessions.length,
  }
}

/**
 * Update session hostName
 */
export async function updateSessionHostName(sessionId: string, hostName: string | null) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    throw new Error("Unauthorized")
  }

  // Verify session belongs to user
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    throw new Error("Session not found")
  }

  if (session.host_id !== userId) {
    throw new Error("Unauthorized: You don't own this session")
  }

  // Update session hostName
  const { data, error } = await supabase
    .from("sessions")
    .update({
      host_name: hostName, // Store as host_name in DB (snake_case)
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`)
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)
  revalidatePath(`/s/${sessionId}`)

  return { data }
}

/**
 * Update session container overlay enabled preference
 */
export async function updateSessionContainerOverlay(sessionId: string, enabled: boolean) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    throw new Error("Unauthorized")
  }

  // Verify session belongs to user
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    throw new Error("Session not found")
  }

  if (session.host_id !== userId) {
    throw new Error("Unauthorized: You don't own this session")
  }

  // Update session container overlay preference
  const { data, error } = await supabase
    .from("sessions")
    .update({
      container_overlay_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single()

  if (error) {
    // If column doesn't exist yet (migration not run), log warning but don't crash
    if (error.message.includes("container_overlay_enabled") && error.message.includes("schema cache")) {
      console.warn("[updateSessionContainerOverlay] Column not found. Please run migration: 20250110000000_add_container_overlay_enabled_to_sessions.sql")
      // Return success anyway - the toggle will work locally, just won't persist until migration is run
      return { data: null }
    }
    throw new Error(`Failed to update container overlay preference: ${error.message}`)
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)
  revalidatePath(`/s/${sessionId}`)

  return { data }
}

/**
 * Update session waitlist enabled preference
 */
export async function updateSessionWaitlistEnabled(sessionId: string, enabled: boolean) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    throw new Error("Unauthorized")
  }

  // Verify session belongs to user
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    throw new Error("Session not found")
  }

  if (session.host_id !== userId) {
    throw new Error("Unauthorized: You don't own this session")
  }

  // Update session waitlist enabled preference
  const { data, error } = await supabase
    .from("sessions")
    .update({
      waitlist_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single()

  if (error) {
    // If column doesn't exist yet (migration not run), log warning but don't crash
    if (error.message.includes("waitlist_enabled") && error.message.includes("schema cache")) {
      console.warn("[updateSessionWaitlistEnabled] Column not found. Please run migration: 20250112000000_add_waitlist_enabled_to_sessions.sql")
      // Return success anyway - the toggle will work locally, just won't persist until migration is run
      return { data: null }
    }
    throw new Error(`Failed to update waitlist preference: ${error.message}`)
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)
  revalidatePath(`/s/${sessionId}`)

  return { data }
}

/**
 * Update session cover URL
 */
export async function updateSessionCoverUrl(sessionId: string, coverUrl: string | null) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    throw new Error("Unauthorized")
  }

  // Verify session belongs to user
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    throw new Error("Session not found")
  }

  if (session.host_id !== userId) {
    throw new Error("Unauthorized: You don't own this session")
  }

  // Update session cover_url
  console.log(`[updateSessionCoverUrl] Updating cover for sessionId=${sessionId}, coverUrl=${coverUrl}`)
  
  const { data, error } = await supabase
    .from("sessions")
    .update({
      cover_url: coverUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single()

  if (error) {
    console.error(`[updateSessionCoverUrl] Error:`, error)
    throw new Error(`Failed to update session cover: ${error.message}`)
  }

  console.log(`[updateSessionCoverUrl] Success:`, data)

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)
  revalidatePath(`/s/${sessionId}`)

  return { data }
}

/**
 * Get published session info (for already published sessions)
 */
export async function getPublishedSessionInfo(
  sessionId: string
): Promise<
  | { ok: true; publicCode: string; hostSlug: string; hostName: string | null; isPublished: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Get session with public_code, host_slug, and host_name for share text
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id, public_code, host_slug, host_name, status")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  const isPublished = session.status === "open" && !!session.public_code

  if (!isPublished) {
    return { ok: false, error: "Session is not published" }
  }

  // Generate host_slug if missing (shouldn't happen, but handle gracefully)
  const hostSlug = session.host_slug || "host"

  return {
    ok: true,
    publicCode: session.public_code!,
    hostSlug,
    hostName: session.host_name || null,
    isPublished: true,
  }
}

/**
 * Get session analytics data (host-only)
 */
export async function getSessionAnalytics(sessionId: string): Promise<
  | {
      ok: true
      attendance: {
        accepted: number
        capacity: number
        declined: number
        unanswered: number
      }
      payments: {
        collected: number
        total: number
        paidCount: number
        receivedCount: number // pending_review + approved
        pendingCount: number // pending_review only
        confirmedCount: number // approved only
      }
      acceptedList: Array<{ id: string; display_name: string; created_at: string }>
      declinedList: Array<{ id: string; display_name: string; created_at: string }>
      waitlistedList: Array<{ id: string; display_name: string; created_at: string }>
      viewedCount: number // Placeholder for now
      pricePerPerson: number | null
      sessionStatus: string
      startAt: string | null
      hostSlug: string | null
      publicCode: string | null
      waitlistEnabled: boolean
      allParticipants?: Array<{
        id: string
        display_name: string
        status: string
        pull_out_reason: string | null
        pull_out_seen: boolean
      }>
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Get session with capacity and verify ownership
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, host_id, capacity, status, start_at, host_slug, public_code, price")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized" }
  }

  const capacity = session.capacity || 0

  // Get participants (including pull-out info for host)
  // Try to get pull-out fields, but gracefully fallback if columns don't exist yet
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name, status, created_at, pull_out_reason, pull_out_seen")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  // If query failed due to missing columns, retry without pull-out fields
  let participantsWithPullOut = participants || []
  if (participantsError && participantsError.message?.includes("pull_out")) {
    // Columns don't exist yet - retry without them
    const { data: participantsBasic, error: basicError } = await supabase
      .from("participants")
      .select("id, display_name, status, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
    
    if (basicError) {
      return { ok: false, error: basicError.message }
    }
    
    // Add default pull-out fields
    participantsWithPullOut = (participantsBasic || []).map((p: any) => ({
      ...p,
      pull_out_reason: null,
      pull_out_seen: false,
    }))
  } else if (participantsError) {
    return { ok: false, error: participantsError.message }
  } else {
    // Query succeeded - ensure pull-out fields have defaults if null/undefined
    participantsWithPullOut = (participants || []).map((p: any) => ({
      ...p,
      pull_out_reason: p.pull_out_reason || null,
      pull_out_seen: p.pull_out_seen ?? false,
    }))
  }

  if (participantsError) {
    return { ok: false, error: participantsError.message }
  }

  const accepted = participantsWithPullOut?.filter((p) => p.status === "confirmed").length || 0
  const declined = participantsWithPullOut?.filter((p) => p.status === "cancelled").length || 0
  const unanswered = Math.max(0, capacity - accepted - declined)

  const acceptedList =
    participantsWithPullOut
      ?.filter((p) => p.status === "confirmed")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        created_at: p.created_at,
      })) || []

  const declinedList =
    participantsWithPullOut
      ?.filter((p) => p.status === "cancelled")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        created_at: p.created_at,
      })) || []

  const waitlistedList =
    participantsWithPullOut
      ?.filter((p) => p.status === "waitlisted")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        created_at: p.created_at,
      })) || []

  // Get payment data from payment_proofs table
  // Schema: payment_proofs table with payment_status enum: "pending_review" | "approved" | "rejected"
  // Cash payments are stored as payment_proofs with payment_status='approved' and proof_image_url=null
  // Count all payment proofs (pending_review + approved = received), which includes:
  // - Uploaded proofs with status pending_review or approved
  // - Cash payments with status approved (proof_image_url=null)
  const { data: allPaymentProofs, error: paymentError } = await supabase
    .from("payment_proofs")
    .select("amount, payment_status, proof_image_url")
    .eq("session_id", sessionId)
    .in("payment_status", ["pending_review", "approved"])

  // Get approved payment proofs for collected amount (includes cash payments)
  const { data: approvedPaymentProofs } = await supabase
    .from("payment_proofs")
    .select("amount, payment_status")
    .eq("session_id", sessionId)
    .eq("payment_status", "approved")

  // Calculate payment counts
  // receivedCount: all payment proofs (pending + approved), including cash payments
  const receivedCount = allPaymentProofs?.length || 0
  
  // pendingCount: only uploaded proofs that are pending (excludes cash, excludes approved uploads)
  const pendingCount = allPaymentProofs?.filter((p) => p.payment_status === "pending_review").length || 0
  
  // confirmedCount: all approved payments (includes approved uploads + cash payments)
  const confirmedCount = allPaymentProofs?.filter((p) => p.payment_status === "approved").length || 0
  
  // price (NULL = TBD, 0 = Free)
  const pricePerPerson = (session as any).price ?? null
  const paidCount = confirmedCount // approved = paid
  const collected = approvedPaymentProofs?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
  const total = typeof pricePerPerson === "number" ? pricePerPerson * accepted : 0

  return {
    ok: true,
    attendance: {
      accepted,
      capacity,
      declined,
      unanswered,
    },
    payments: {
      collected,
      total,
      paidCount,
      receivedCount,
      pendingCount,
      confirmedCount,
    },
    acceptedList,
    declinedList,
    waitlistedList,
    viewedCount: 0, // Placeholder - no backend tracking yet
    pricePerPerson,
    sessionStatus: session.status as string,
    startAt: session.start_at as string | null,
    hostSlug: session.host_slug as string | null,
    publicCode: session.public_code as string | null,
    waitlistEnabled: (session as any).waitlist_enabled !== false, // Default to true if null/undefined
    allParticipants: (participantsWithPullOut || []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      status: p.status,
      pull_out_reason: p.pull_out_reason || null,
      pull_out_seen: p.pull_out_seen || false,
    })),
  }
}

/**
 * Helper to check if a string is a valid UUID
 */
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Publish a session (generate public_code, set host_slug, set status to 'open')
 * Creates session if it doesn't exist, then publishes it.
 * Idempotent: if already published, returns existing public_code and host_slug
 */
export async function publishSession(
  sessionData: {
    sessionId?: string | null
    title: string
    startAt: string
    endAt: string | null
    location: string | null
    capacity: number | null
    price: number | null
    hostName: string
    sport: "badminton" | "pickleball" | "volleyball" | "other"
    hostJoinsSession: boolean
    description?: string | null
    coverUrl?: string | null
    courtNumbers?: string | null
    containerOverlayEnabled?: boolean | null
    mapUrl?: string | null
    paymentQrImage?: string | null
  }
): Promise<{ ok: true; publicCode: string; hostSlug: string; sessionId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  const traceId = newTraceId("publish")

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Host avatar URL from auth provider (e.g., Google). Used for public invite avatars.
  const { data: { user } } = await supabase.auth.getUser()
  const hostAvatarUrl =
    (user as any)?.user_metadata?.avatar_url ||
    (user as any)?.user_metadata?.picture ||
    null

  // Ensure user exists in public.users table (required for foreign key constraint)
  // Try to insert user, ignore if already exists (unique constraint violation)
  const { error: userInsertError } = await supabase
    .from("users")
    .insert({ id: userId })

  // 23505 is PostgreSQL unique_violation error code - user already exists, which is fine
  if (userInsertError && userInsertError.code !== "23505") {
    console.error("[publishSession] Error ensuring user exists:", userInsertError)
    // For other errors, continue anyway - might be a transient issue
  }

  let actualSessionId: string | null = null
  let session: { host_id: string; public_code: string | null; host_slug: string | null; status: string } | null = null

  // Check if sessionId is provided and valid UUID
  if (sessionData.sessionId && isValidUUID(sessionData.sessionId)) {
    // Try to fetch existing session
    const { data: fetchedSession, error: fetchError } = await supabase
      .from("sessions")
      .select("id, host_id, public_code, host_slug, status")
      .eq("id", sessionData.sessionId)
      .single()

    if (!fetchError && fetchedSession) {
      // Session exists, verify ownership
      if (fetchedSession.host_id !== userId) {
        return { ok: false, error: "Unauthorized: You don't own this session" }
      }
      session = fetchedSession
      actualSessionId = fetchedSession.id
    }
  }

  // If session doesn't exist, create it
  if (!session) {
    const { data: newSession, error: createError } = await supabase
      .from("sessions")
      .insert({
        host_id: userId,
        title: sessionData.title,
        start_at: sessionData.startAt,
        end_at: sessionData.endAt,
        location: sessionData.location,
        capacity: sessionData.capacity,
        price: sessionData.price ?? null,
        host_name: sessionData.hostName,
        host_avatar_url: hostAvatarUrl,
        sport: sessionData.sport,
        host_joins_session: sessionData.hostJoinsSession,
        host_will_join: sessionData.hostJoinsSession, // keep legacy column in sync (optional)
        description: sessionData.description || null,
        cover_url: sessionData.coverUrl || null,
        court_numbers: sessionData.courtNumbers || null,
        container_overlay_enabled: sessionData.containerOverlayEnabled ?? true,
        map_url: sessionData.mapUrl || null,
        payment_qr_image: sessionData.paymentQrImage || null,
        status: "draft", // Will be set to "open" after publishing
      })
      .select("id, host_id, public_code, host_slug, status")
      .single()

    if (createError || !newSession) {
      return { ok: false, error: createError?.message || "Failed to create session" }
    }

    session = newSession
    actualSessionId = newSession.id
  }

  if (!actualSessionId) {
    return { ok: false, error: "Failed to get session ID" }
  }

  // If already published (has public_code and status is 'open'), return existing code and slug
  // Also update host_slug if it changed (idempotent but can update slug)
  if (session.public_code && session.status === "open") {
    const hostSlug = session.host_slug || toSlug(sessionData.hostName || "host")
    // Reconcile host participant even on idempotent re-publish (sessions created before this logic
    // may be missing the host participant row).
    try {
      await reconcileHostParticipantForSession({
        supabase,
        sessionId: actualSessionId,
        hostId: userId,
        hostNameFallback: sessionData.hostName,
        traceId,
      })
    } catch {}
    // Update host_slug if it's missing or if hostName changed (optional optimization)
    if (!session.host_slug || session.host_slug !== toSlug(sessionData.hostName || "host")) {
      const newHostSlug = toSlug(sessionData.hostName || "host")
      await supabase
        .from("sessions")
        .update({ host_slug: newHostSlug, host_avatar_url: hostAvatarUrl })
        .eq("id", actualSessionId)
      return { ok: true, publicCode: session.public_code, hostSlug: newHostSlug, sessionId: actualSessionId }
    }
    // Keep avatar URL fresh even if slug doesn't change
    if (hostAvatarUrl) {
      await supabase
        .from("sessions")
        .update({ host_avatar_url: hostAvatarUrl })
        .eq("id", actualSessionId)
    }
    return { ok: true, publicCode: session.public_code, hostSlug, sessionId: actualSessionId }
  }

  // Check if host already has 2 live sessions (enforce max 2 concurrent live invites)
  // Only check if current session is not yet published (idempotent: allow re-publishing existing)
  if (!session.public_code || session.status !== "open") {
    const { data: liveSessions, error: liveCountError } = await supabase
      .from("sessions")
      .select("id")
      .eq("host_id", userId)
      .eq("status", "open")

    if (liveCountError) {
      return { ok: false, error: "Failed to check live session count" }
    }

    // Count live sessions excluding current session (if it exists in the list)
    const liveCount = liveSessions?.filter((s) => s.id !== actualSessionId).length || 0

    // If host already has 2 live sessions, block publishing this one
    if (liveCount >= 2) {
      return {
        ok: false,
        error: "Limit reached: You already have 2 live invites. Close one to publish another.",
      }
    }
  }

  // Generate public_code if it doesn't exist
  let publicCode = session.public_code
  if (!publicCode) {
    // Generate unique code (retry up to 10 times on collision)
    let attempts = 0
    let isUnique = false

    while (!isUnique && attempts < 10) {
      publicCode = generateShortCode()
      
      // Check if code already exists
      const { data: existing } = await supabase
        .from("sessions")
        .select("id")
        .eq("public_code", publicCode)
        .single()

      if (!existing) {
        isUnique = true
      } else {
        attempts++
      }
    }

    if (!isUnique) {
      return { ok: false, error: "Failed to generate unique code. Please try again." }
    }
  }

  // Generate host_slug from hostName (guaranteed to be a string)
  const hostSlug = toSlug(sessionData.hostName || "host")

  // At this point, publicCode and hostSlug are guaranteed to be strings
  // (publicCode is generated if missing, hostSlug is generated from hostName)
  if (!publicCode) {
    return { ok: false, error: "Failed to generate public code" }
  }

  // Read host_joins_session intent (source of truth is the session row, but we also
  // set it from the publish payload to support pre-publish toggling when no session existed).
  const { data: sessionBeforeUpdate } = await supabase
    .from("sessions")
    .select("host_joins_session, host_will_join, host_name")
    .eq("id", actualSessionId)
    .single()

  // Backward compatibility: some environments may still be looking at host_will_join.
  const hostJoinsSession =
    (sessionBeforeUpdate as any)?.host_joins_session ??
    (sessionBeforeUpdate as any)?.host_will_join ??
    sessionData.hostJoinsSession ??
    true

  // Update session with public_code, host_slug, and status = 'open'
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      public_code: publicCode,
      host_slug: hostSlug,
      status: "open",
      host_joins_session: sessionData.hostJoinsSession,
      host_will_join: sessionData.hostJoinsSession, // keep legacy column in sync (optional)
      price: sessionData.price ?? null,
      host_avatar_url: hostAvatarUrl,
      court_numbers: sessionData.courtNumbers || null,
      container_overlay_enabled: sessionData.containerOverlayEnabled ?? true,
      map_url: sessionData.mapUrl || null,
      payment_qr_image: sessionData.paymentQrImage || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", actualSessionId)

  if (updateError) {
    return { ok: false, error: updateError.message || "Failed to publish session" }
  }

  // Materialize host participant ONLY on publish/update, based on host_joins_session intent.
  // Guests should only ever see the host if there is a participants row.
  try {
    await reconcileHostParticipantForSession({
      supabase,
      sessionId: actualSessionId,
      hostId: userId,
      hostNameFallback: sessionData.hostName,
      traceId,
    })
  } catch {}

  // Revalidate paths
  revalidatePath(`/host/sessions/${actualSessionId}/edit`)
  revalidatePath(`/${hostSlug}/${publicCode}`)

  return { ok: true, publicCode, hostSlug, sessionId: actualSessionId }
}

/**
 * Update a live session (updates fields but keeps status as 'open')
 */
export async function updateLiveSession(
  sessionId: string,
  sessionData: {
    title: string
    startAt: string
    endAt: string | null
    location: string | null
    capacity: number | null
    price: number | null
    hostName: string
    sport: "badminton" | "pickleball" | "volleyball" | "other"
    description?: string | null
    coverUrl?: string | null
    courtNumbers?: string | null
    containerOverlayEnabled?: boolean | null
    mapUrl?: string | null
    paymentQrImage?: string | null
  }
): Promise<{ ok: true; publicCode: string; hostSlug: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)
  const traceId = newTraceId("update_live")

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Host avatar URL from auth provider (e.g., Google). Used for public invite avatars.
  const { data: { user } } = await supabase.auth.getUser()
  const hostAvatarUrl =
    (user as any)?.user_metadata?.avatar_url ||
    (user as any)?.user_metadata?.picture ||
    null

  // Verify session belongs to user and is live
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("id, host_id, public_code, host_slug, status")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  if (session.status !== "open") {
    return { ok: false, error: "Session is not live" }
  }

  // Generate host_slug from hostName
  const hostSlug = toSlug(sessionData.hostName || "host")

  // Update session fields (but keep status as 'open')
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      title: sessionData.title,
      start_at: sessionData.startAt,
      end_at: sessionData.endAt,
      location: sessionData.location,
      capacity: sessionData.capacity,
      price: sessionData.price ?? null,
      host_name: sessionData.hostName,
      host_slug: hostSlug,
      host_avatar_url: hostAvatarUrl,
      sport: sessionData.sport,
      description: sessionData.description || null,
      cover_url: sessionData.coverUrl || null,
      court_numbers: sessionData.courtNumbers || null,
      container_overlay_enabled: sessionData.containerOverlayEnabled ?? true,
      map_url: sessionData.mapUrl || null,
      payment_qr_image: sessionData.paymentQrImage || null,
      updated_at: new Date().toISOString(),
      // NOTE: status remains 'open' (not changed)
    })
    .eq("id", sessionId)
    .eq("host_id", userId)

  if (updateError) {
    return { ok: false, error: updateError.message || "Failed to update session" }
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)
  if (session.public_code && hostSlug) {
    revalidatePath(`/${hostSlug}/${session.public_code}`)
  }

  // Reconcile host participant on "Update" too (for sessions created before host_joins_session was enforced).
  try {
    await reconcileHostParticipantForSession({
      supabase,
      sessionId,
      hostId: userId,
      hostNameFallback: sessionData.hostName,
      traceId,
    })
  } catch {}

  return { ok: true, publicCode: session.public_code!, hostSlug }
}

/**
 * Unpublish a session (hard-delete session and all related participant data)
 * This permanently removes the session row, which cascades to delete:
 * - All participants (via FK CASCADE)
 * - All payment_proofs (via FK CASCADE)
 */
export async function unpublishSession(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    console.error("[unpublishSession] Unauthorized: No userId")
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to user and is currently published
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id, status")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    console.error("[unpublishSession] Session not found:", { sessionId, error: fetchError?.message })
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    console.error("[unpublishSession] Unauthorized: Session doesn't belong to user", { sessionId, sessionHostId: session.host_id, userId })
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  if (session.status !== "open") {
    // Idempotent: if already not published, return success
    console.log("[unpublishSession] Session is not published, treating as already removed", { sessionId, status: session.status })
    return { ok: true }
  }

  // Hard-delete the session row (CASCADE will automatically delete all related data)
  // Filter by both id and host_id for safety (RLS policy also enforces this)
  const { error: deleteError, count } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("host_id", userId) // Extra safety: ensure we only delete own sessions

  if (deleteError) {
    console.error("[unpublishSession] DB delete error:", { sessionId, userId, error: deleteError.message, code: deleteError.code })
    return { ok: false, error: deleteError.message || "Failed to delete session" }
  }

  // Verify the deletion succeeded (should return 0 rows)
  const { data: verify, error: verifyError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .single()

  if (!verifyError && verify) {
    // Session still exists (shouldn't happen)
    console.error("[unpublishSession] Verification failed - session still exists after delete", { sessionId })
    return { ok: false, error: "Deletion verification failed" }
  }

  console.log("[unpublishSession] Successfully deleted session and all related data", { sessionId })

  // Revalidate paths to ensure fresh data after deletion
  revalidatePath("/host/sessions")
  revalidatePath("/host/sessions/new/edit")
  revalidatePath("/host")

  return { ok: true }
}

/**
 * Get session data in draft format (for saving to drafts from analytics)
 */
export async function getSessionDataForDraft(
  sessionId: string
): Promise<
  | {
      ok: true
      data: {
        selectedSport: string
        theme: string
        effects: { grain: boolean; glow: boolean; vignette: boolean }
        optimisticCoverUrl: string | null
        eventTitle: string
        titleFont: string
        eventDate: string
        eventLocation: string
        eventMapUrl: string
        eventPrice: number
        eventCapacity: number
        hostName: string | null
        eventDescription: string
        bankName: string
        accountNumber: string
        accountName: string
        paymentNotes: string
        paymentQrImage: string | null
      }
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to user
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("host_id", userId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  // Convert session to draft format
  // Note: Some fields may not exist in sessions table, so we use defaults
  const draftData = {
    selectedSport: session.sport || "badminton",
    theme: "badminton", // Default theme (not stored in sessions)
    effects: { grain: false, glow: false, vignette: false }, // Default effects
    optimisticCoverUrl: session.cover_url || null,
    eventTitle: session.title || "",
    titleFont: "inter", // Default font (not stored in sessions)
    eventDate: session.start_at || "",
    eventLocation: session.location || "",
    eventMapUrl: (session as any).map_url || "", // Load from database
    eventPrice: (session as any).price ?? null, // NULL = TBD, 0 = Free
    eventCapacity: session.capacity || 0,
    hostName: session.host_name || null,
    eventDescription: session.description || "",
    bankName: session.payment_bank_name || "", // Load from database
    accountNumber: session.payment_account_number || "", // Load from database
    accountName: session.payment_account_name || "", // Load from database
    paymentNotes: "", // Not stored in sessions
    paymentQrImage: (session as any).payment_qr_image || null, // Load from database
  }

  return { ok: true, data: draftData }
}

/**
 * Update an existing draft session (status = 'draft')
 * Updates the sessions row with the provided patch data
 */
export async function updateDraftSession(
  sessionId: string,
  patch: {
    title?: string
    description?: string | null
    cover_url?: string | null
    sport?: "badminton" | "pickleball" | "volleyball" | "other"
    location?: string | null
    start_at?: string
    end_at?: string | null
    capacity?: number | null
    price?: number | null
    host_name?: string | null
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to user and is a draft
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id, status")
    .eq("id", sessionId)
    .single()

  if (fetchError || !session) {
    console.error("[updateDraftSession] Session not found:", { sessionId, error: fetchError?.message })
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    console.error("[updateDraftSession] Unauthorized: Session doesn't belong to user", { sessionId, sessionHostId: session.host_id, userId })
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  if (session.status !== "draft") {
    console.error("[updateDraftSession] Session is not a draft", { sessionId, status: session.status })
    return { ok: false, error: "Session is not a draft" }
  }

  // Update session fields
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("host_id", userId) // Extra safety: ensure we only update own sessions

  if (updateError) {
    console.error("[updateDraftSession] DB update error:", { sessionId, userId, error: updateError.message, code: updateError.code })
    return { ok: false, error: updateError.message || "Failed to update draft session" }
  }

  // Verify the update actually persisted (confirm it's not inserting)
  const { data: verify, error: verifyError } = await supabase
    .from("sessions")
    .select("id, status, updated_at")
    .eq("id", sessionId)
    .single()

  console.log("[updateDraftSession] verify update:", {
    sessionId,
    status: verify?.status,
    updated_at: verify?.updated_at,
    verifyError: verifyError?.message,
  })

  if (verifyError || !verify) {
    console.error("[updateDraftSession] Verification failed - update may not have persisted", { sessionId, verifyError: verifyError?.message })
    return { ok: false, error: "Update verification failed" }
  }

  if (verify.status !== "draft") {
    console.error("[updateDraftSession] Status mismatch after update", {
      sessionId,
      expected: "draft",
      actual: verify.status,
    })
    return { ok: false, error: "Status update did not persist correctly" }
  }

  // Revalidate paths to ensure fresh data after update
  revalidatePath("/host/sessions")
  revalidatePath(`/host/sessions/${sessionId}`)
  revalidatePath(`/host/sessions/${sessionId}/edit`)

  return { ok: true }
}

/**
 * Get payment uploads for a session (host-only)
 * Returns ALL confirmed participants with their latest payment proof (if any)
 */
export async function getPaymentUploadsForSession(
  sessionId: string
): Promise<
  | {
      ok: true
      uploads: Array<{
        id: string | null // null if no payment proof exists
        participantId: string
        participantName: string
        proofImageUrl: string | null
        paymentStatus: "pending_review" | "approved" | "rejected" | null // null if no payment proof
        createdAt: string | null // null if no payment proof
        amount: number | null
        currency: string | null
        hasProof: boolean // true if participant uploaded a proof, false if cash-only or unpaid
      }>
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to host
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, host_id")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  // Fetch all confirmed participants for this session
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name, created_at")
    .eq("session_id", sessionId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })

  if (participantsError) {
    console.error("[getPaymentUploadsForSession] Error fetching participants:", participantsError)
    return { ok: false, error: participantsError.message }
  }

  if (!participants || participants.length === 0) {
    return { ok: true, uploads: [] }
  }

  const participantIds = participants.map((p) => p.id)

  // Fetch all payment proofs for this session with covered_participant_ids
  // NEW MODEL: Check covered_participant_ids to see which participants are covered
  const { data: paymentProofs, error: paymentError } = await supabase
    .from("payment_proofs")
    .select(
      `
      id,
      participant_id,
      covered_participant_ids,
      payment_status,
      created_at,
      amount,
      currency,
      proof_image_url
    `
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })

  if (paymentError) {
    console.error("[getPaymentUploadsForSession] Error fetching payment proofs:", paymentError)
    return { ok: false, error: paymentError.message }
  }

  // Build map of participant_id -> latest payment proof
  // NEW MODEL: Check covered_participant_ids array, not just participant_id
  const latestProofByParticipant: Record<string, typeof paymentProofs[0]> = {}
  
  paymentProofs?.forEach((proof: any) => {
    // Check covered_participant_ids (new model)
    if (proof.covered_participant_ids && Array.isArray(proof.covered_participant_ids)) {
      proof.covered_participant_ids.forEach((item: any) => {
        const coveredPid = item?.participant_id
        if (coveredPid && participantIds.includes(coveredPid)) {
          // Only update if we don't have a proof for this participant yet, or this one is newer
          if (!latestProofByParticipant[coveredPid] || 
              new Date(proof.created_at) > new Date(latestProofByParticipant[coveredPid].created_at)) {
            latestProofByParticipant[coveredPid] = proof
          }
        }
      })
    }
    // Backward compatibility: also check participant_id (old model)
    const pid = proof.participant_id
    if (pid && participantIds.includes(pid)) {
      if (!latestProofByParticipant[pid] || 
          new Date(proof.created_at) > new Date(latestProofByParticipant[pid].created_at)) {
        latestProofByParticipant[pid] = proof
      }
    }
  })

  // Build merged list: one entry per participant with their latest proof (if any)
  const uploads = participants.map((participant) => {
    const proof = latestProofByParticipant[participant.id]
    
    if (proof) {
      // Participant has a payment proof
      return {
        id: proof.id,
        participantId: participant.id,
        participantName: participant.display_name,
        proofImageUrl: proof.proof_image_url || null,
        paymentStatus: proof.payment_status as "pending_review" | "approved" | "rejected",
        createdAt: proof.created_at,
        amount: proof.amount,
        currency: proof.currency,
        hasProof: !!proof.proof_image_url, // true if they uploaded an image
      }
    } else {
      // Participant has no payment proof yet
      return {
        id: null,
        participantId: participant.id,
        participantName: participant.display_name,
        proofImageUrl: null,
        paymentStatus: null,
        createdAt: null,
        amount: null,
        currency: null,
        hasProof: false,
      }
    }
  })

  return { ok: true, uploads }
}

/**
 * Confirm participant payment (update payment status to approved)
 */
export async function confirmParticipantPaid(
  sessionId: string,
  paymentProofId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to host
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, host_id")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  // Verify payment proof belongs to this session
  const { data: proof, error: proofError } = await supabase
    .from("payment_proofs")
    .select("id, session_id, payment_status")
    .eq("id", paymentProofId)
    .single()

  if (proofError || !proof) {
    return { ok: false, error: "Payment proof not found" }
  }

  if (proof.session_id !== sessionId) {
    return { ok: false, error: "Payment proof does not belong to this session" }
  }

  // Update payment status to approved (idempotent - safe if already approved)
  const { error: updateError } = await supabase
    .from("payment_proofs")
    .update({ payment_status: "approved", processed_at: new Date().toISOString() })
    .eq("id", paymentProofId)

  if (updateError) {
    console.error("[confirmParticipantPaid] Error:", updateError)
    return { ok: false, error: updateError.message }
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)

  return { ok: true }
}

/**
 * Mark participant as paid by cash (host-only)
 * Creates a payment_proof record with payment_status='approved' and no proof_image_url
 */
export async function markParticipantPaidByCash(
  sessionId: string,
  participantId: string
): Promise<{ ok: true; paymentProofId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to host
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, host_id")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  // Verify participant belongs to this session and is confirmed
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, session_id, status")
    .eq("id", participantId)
    .single()

  if (participantError || !participant) {
    return { ok: false, error: "Participant not found" }
  }

  if (participant.session_id !== sessionId) {
    return { ok: false, error: "Participant does not belong to this session" }
  }

  if (participant.status !== "confirmed") {
    return { ok: false, error: "Participant is not confirmed" }
  }

  // Check if participant already has an approved payment proof
  // NEW MODEL: Check covered_participant_ids, not just participant_id
  const { data: allProofs } = await supabase
    .from("payment_proofs")
    .select("id, payment_status, covered_participant_ids, participant_id")
    .eq("session_id", sessionId)
    .eq("payment_status", "approved")

  // Check if participant is already covered by any approved payment
  const isAlreadyPaid = allProofs?.some((proof: any) => {
    // Check covered_participant_ids (new model)
    if (proof.covered_participant_ids && Array.isArray(proof.covered_participant_ids)) {
      return proof.covered_participant_ids.some((item: any) => item?.participant_id === participantId)
    }
    // Backward compatibility: check participant_id (old model)
    return proof.participant_id === participantId
  })

  if (isAlreadyPaid) {
    return { ok: false, error: "Participant is already marked as paid" }
  }

  // Use admin client to insert payment proof (bypasses RLS)
  const adminClient = createAdminClient()
  
  // Format covered_participant_ids as JSONB array
  const coveredParticipantsJson = [{ participant_id: participantId }]
  
  // Create a payment_proof record with payment_status='approved' and no proof_image_url (cash payment)
  const { data: newProof, error: insertError } = await adminClient
    .from("payment_proofs")
    .insert({
      session_id: sessionId,
      participant_id: participantId, // Keep for backward compatibility (who marked as paid)
      covered_participant_ids: coveredParticipantsJson, // NEW: Who is covered by this payment
      payment_status: "approved",
      proof_image_url: null, // No image for cash payments
      ocr_status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError) {
    console.error("[markParticipantPaidByCash] Error:", insertError)
    return { ok: false, error: insertError.message }
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)

  return { ok: true, paymentProofId: newProof.id }
}

/**
 * Add a participant manually (host-only)
 * Creates a participant with the specified status for the session
 */
export async function addParticipant(
  sessionId: string,
  name: string,
  phone: string | null,
  status: "confirmed" | "waitlisted" = "confirmed"
): Promise<{ ok: true; participantId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to host
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, host_id")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  // Validate name
  const trimmedName = name.trim()
  if (!trimmedName || trimmedName.length === 0) {
    return { ok: false, error: "Name is required" }
  }

  // Use admin client to bypass RLS (host action)
  const adminClient = createAdminClient()

  // Insert participant with specified status
  const { data: newParticipant, error: insertError } = await adminClient
    .from("participants")
    .insert({
      session_id: sessionId,
      display_name: trimmedName,
      contact_phone: phone?.trim() || null,
      status: status,
      // guest_key is null for manually added participants
    })
    .select("id")
    .single()

  if (insertError) {
    console.error("[addParticipant] Error:", insertError)
    return { ok: false, error: insertError.message || "Failed to add participant" }
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)

  return { ok: true, participantId: newParticipant.id }
}

/**
 * Remove a participant (host-only)
 * Hard-deletes the participant row
 */
/**
 * Update participant status (move between confirmed and waitlisted)
 */
export async function updateParticipantStatus(
  sessionId: string,
  participantId: string,
  newStatus: "confirmed" | "waitlisted"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to user
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("host_id")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  // Verify participant exists and belongs to this session
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, session_id, status")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .single()

  if (participantError || !participant) {
    return { ok: false, error: "Participant not found" }
  }

  // Update participant status
  const { error: updateError } = await supabase
    .from("participants")
    .update({ status: newStatus })
    .eq("id", participantId)

  if (updateError) {
    return { ok: false, error: updateError.message || "Failed to update participant status" }
  }

  revalidatePath(`/host/sessions/${sessionId}/edit`)

  return { ok: true }
}

/**
 * Auto-promote waitlist when a joined participant is removed
 * Server-side only to avoid race conditions
 */
async function removeParticipantAndPromoteWaitlist({
  sessionId,
  participantId,
}: {
  sessionId: string
  participantId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminClient = createAdminClient()

  // 1. Get participant status before removal
  const { data: participant, error: participantError } = await adminClient
    .from("participants")
    .select("id, session_id, status")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .single()

  if (participantError || !participant) {
    return { ok: false, error: "Participant not found" }
  }

  // 2. Hard-delete the participant (or update to pulled_out if it's a participant-initiated pull-out)
  // For host removal, we hard-delete. For participant pull-out, we update status.
  // This function is called for host removals, so we hard-delete.
  const { error: deleteError } = await adminClient
    .from("participants")
    .delete()
    .eq("id", participantId)
    .eq("session_id", sessionId)

  if (deleteError) {
    console.error("[removeParticipantAndPromoteWaitlist] Error deleting participant:", deleteError)
    return { ok: false, error: deleteError.message || "Failed to remove participant" }
  }

  // 3. Only promote if the removed participant was "confirmed" (joined)
  if (participant.status !== "confirmed") {
    // No promotion needed if they weren't confirmed
    return { ok: true }
  }

  // 4. Get current joined count
  const { count: joinedCount } = await adminClient
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "confirmed")

  // 5. Get session capacity
  const { data: session, error: sessionError } = await adminClient
    .from("sessions")
    .select("capacity")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    console.error("[removeParticipantAndPromoteWaitlist] Error fetching session:", sessionError)
    // Still return success - participant was removed, just couldn't promote
    return { ok: true }
  }

  // 6. Promote next waitlisted if capacity allows (FIFO order)
  if (session.capacity && joinedCount !== null && joinedCount < session.capacity) {
    const { data: nextWaitlisted, error: waitlistError } = await adminClient
      .from("participants")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "waitlisted")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (waitlistError) {
      console.error("[removeParticipantAndPromoteWaitlist] Error fetching waitlist:", waitlistError)
      // Still return success - participant was removed
      return { ok: true }
    }

    if (nextWaitlisted) {
      const { error: promoteError } = await adminClient
        .from("participants")
        .update({ status: "confirmed" })
        .eq("id", nextWaitlisted.id)

      if (promoteError) {
        console.error("[removeParticipantAndPromoteWaitlist] Error promoting waitlist:", promoteError)
        // Still return success - participant was removed
        return { ok: true }
      }
    }
  }

  return { ok: true }
}

export async function removeParticipant(
  sessionId: string,
  participantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Verify session belongs to host
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, host_id")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  // Use the auto-promote logic
  const result = await removeParticipantAndPromoteWaitlist({ sessionId, participantId })

  if (!result.ok) {
    return result
  }

  // Revalidate paths
  revalidatePath(`/host/sessions/${sessionId}/edit`)

  return { ok: true }
}
