"use server"

import { revalidatePath } from "next/cache"
import { createClient, getUserId } from "@/lib/supabase/server/server"
import { redirect } from "next/navigation"
import { generateShortCode } from "@/lib/utils/short-code"
import { toSlug } from "@/lib/utils/slug"

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
  | { ok: true; publicCode: string; hostSlug: string; isPublished: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  // Get session with public_code and host_slug
  const { data: session, error: fetchError } = await supabase
    .from("sessions")
    .select("host_id, public_code, host_slug, status")
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
      }
      acceptedList: Array<{ id: string; display_name: string; created_at: string }>
      declinedList: Array<{ id: string; display_name: string; created_at: string }>
      viewedCount: number // Placeholder for now
      pricePerPerson: number | null
      sessionStatus: string
      startAt: string | null
      hostSlug: string | null
      publicCode: string | null
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
    .select("id, host_id, capacity, status, start_at, host_slug, public_code")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized" }
  }

  const capacity = session.capacity || 0

  // Get participants
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name, status, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  if (participantsError) {
    return { ok: false, error: participantsError.message }
  }

  const accepted = participants?.filter((p) => p.status === "confirmed").length || 0
  const declined = participants?.filter((p) => p.status === "cancelled").length || 0
  const unanswered = Math.max(0, capacity - accepted - declined)

  const acceptedList =
    participants
      ?.filter((p) => p.status === "confirmed")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        created_at: p.created_at,
      })) || []

  const declinedList =
    participants
      ?.filter((p) => p.status === "cancelled")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        created_at: p.created_at,
      })) || []

  // Get payment data (sum of approved payment proofs)
  // Note: We'll need to check if there's a price field in sessions or calculate from payment_proofs
  const { data: paymentProofs, error: paymentError } = await supabase
    .from("payment_proofs")
    .select("amount, payment_status")
    .eq("session_id", sessionId)
    .eq("payment_status", "approved")

  // For now, use amount from payment proofs. If sessions table has price field, use that instead
  const pricePerPerson = null // TODO: Get from sessions table if it has price field
  const paidCount = paymentProofs?.length || 0
  const collected = paymentProofs?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
  const total = pricePerPerson ? pricePerPerson * accepted : 0

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
    },
    acceptedList,
    declinedList,
    viewedCount: 0, // Placeholder - no backend tracking yet
    pricePerPerson,
    sessionStatus: session.status as string,
    startAt: session.start_at as string | null,
    hostSlug: session.host_slug as string | null,
    publicCode: session.public_code as string | null,
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
    hostName: string
    sport: "badminton" | "pickleball" | "volleyball" | "other"
    description?: string | null
    coverUrl?: string | null
  }
): Promise<{ ok: true; publicCode: string; hostSlug: string; sessionId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

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
        host_name: sessionData.hostName,
        sport: sessionData.sport,
        description: sessionData.description || null,
        cover_url: sessionData.coverUrl || null,
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
    // Update host_slug if it's missing or if hostName changed (optional optimization)
    if (!session.host_slug || session.host_slug !== toSlug(sessionData.hostName || "host")) {
      const newHostSlug = toSlug(sessionData.hostName || "host")
      await supabase
        .from("sessions")
        .update({ host_slug: newHostSlug })
        .eq("id", actualSessionId)
      return { ok: true, publicCode: session.public_code, hostSlug: newHostSlug, sessionId: actualSessionId }
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

  // Update session with public_code, host_slug, and status = 'open'
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      public_code: publicCode,
      host_slug: hostSlug,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", actualSessionId)

  if (updateError) {
    return { ok: false, error: updateError.message || "Failed to publish session" }
  }

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
    hostName: string
    sport: "badminton" | "pickleball" | "volleyball" | "other"
    description?: string | null
    coverUrl?: string | null
  }
): Promise<{ ok: true; publicCode: string; hostSlug: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

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
      host_name: sessionData.hostName,
      host_slug: hostSlug,
      sport: sessionData.sport,
      description: sessionData.description || null,
      cover_url: sessionData.coverUrl || null,
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
    eventMapUrl: "", // Not stored in sessions
    eventPrice: 0, // Not stored in sessions (would need to fetch from payment_proofs or add price column)
    eventCapacity: session.capacity || 0,
    hostName: session.host_name || null,
    eventDescription: session.description || "",
    bankName: "", // Not stored in sessions (would need separate table)
    accountNumber: "", // Not stored in sessions
    accountName: "", // Not stored in sessions
    paymentNotes: "", // Not stored in sessions
    paymentQrImage: null, // Not stored in sessions
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
 */
export async function getPaymentUploadsForSession(
  sessionId: string
): Promise<
  | {
      ok: true
      uploads: Array<{
        id: string
        participantId: string
        participantName: string
        proofImageUrl: string | null
        paymentStatus: "pending_review" | "approved" | "rejected"
        createdAt: string
        amount: number | null
        currency: string | null
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

  // Fetch payment proofs with participant info
  // Note: proof_image_url may not be in generated types, so we cast to any to access it
  const { data: paymentProofs, error: paymentError } = await supabase
    .from("payment_proofs")
    .select(
      `
      id,
      participant_id,
      payment_status,
      created_at,
      amount,
      currency,
      participants(display_name)
    `
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })

  if (paymentError) {
    console.error("[getPaymentUploadsForSession] Error:", paymentError)
    return { ok: false, error: paymentError.message }
  }

  // Fetch image URLs in a separate query since proof_image_url might not be in types
  const proofIds = paymentProofs?.map((p) => p.id) || []
  let imageUrls: Record<string, string | null> = {}
  
  if (proofIds.length > 0) {
    const { data: proofImages } = await supabase
      .from("payment_proofs")
      .select("id, proof_image_url")
      .in("id", proofIds)
    
    proofImages?.forEach((img: any) => {
      imageUrls[img.id] = img.proof_image_url || null
    })
  }

  const uploads =
    paymentProofs?.map((proof) => {
      const participant = proof.participants as { display_name: string } | null
      return {
        id: proof.id,
        participantId: proof.participant_id,
        participantName: participant?.display_name || "Unknown",
        proofImageUrl: imageUrls[proof.id] || null,
        paymentStatus: proof.payment_status as "pending_review" | "approved" | "rejected",
        createdAt: proof.created_at,
        amount: proof.amount,
        currency: proof.currency,
      }
    }) || []

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
