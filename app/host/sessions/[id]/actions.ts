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
 * Unpublish a session (change status from 'open' to 'draft')
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
    console.error("[unpublishSession] Session is not published", { sessionId, status: session.status })
    return { ok: false, error: "Session is not published" }
  }

  // Update session status to 'draft' (unpublished)
  // This ensures it will no longer appear in getHostLiveSessions() queries
  // which filter by status = 'open'
  // Filter by both id and host_id for safety
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      status: "draft", // Change from 'open' to 'draft' to remove from live invites
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("host_id", userId) // Extra safety: ensure we only update own sessions

  if (updateError) {
    console.error("[unpublishSession] DB update error:", { sessionId, userId, error: updateError.message, code: updateError.code })
    return { ok: false, error: updateError.message || "Failed to unpublish session" }
  }

  // Verify the update actually persisted
  const { data: verify, error: verifyError } = await supabase
    .from("sessions")
    .select("id, status, host_id")
    .eq("id", sessionId)
    .single()

  console.log("[unpublishSession] Post-update verification:", {
    sessionId,
    status: verify?.status,
    verifyError: verifyError?.message,
  })

  if (verifyError || !verify) {
    console.error("[unpublishSession] Verification failed - status may not have changed", { sessionId, verifyError: verifyError?.message })
    return { ok: false, error: "Update verification failed" }
  }

  if (verify.status !== "draft") {
    console.error("[unpublishSession] Status mismatch after update", {
      sessionId,
      expected: "draft",
      actual: verify.status,
    })
    return { ok: false, error: "Status update did not persist" }
  }

  // Revalidate paths to ensure fresh data after unpublish
  revalidatePath("/host/sessions")
  revalidatePath(`/host/sessions/${sessionId}`)
  revalidatePath(`/host/sessions/${sessionId}/edit`)
  revalidatePath("/host/sessions/new/edit")
  revalidatePath(`/session/${sessionId}`)
  revalidatePath("/host")

  return { ok: true }
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
