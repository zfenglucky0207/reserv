"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server/server"
import { revalidatePath } from "next/cache"

/**
 * Get participant RSVP status for a session (by guest_key)
 * Returns the current status if participant exists, null otherwise
 */
export async function getParticipantRSVPStatus(
  publicCode: string,
  guestKey: string | null
): Promise<{ ok: true; status: "confirmed" | "cancelled" | "waitlisted" | null; displayName?: string } | { ok: false; error: string }> {
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

  // If no guest key provided, return null status
  if (!guestKey) {
    return { ok: true, status: null }
  }

  // Find existing participant by guest_key
  const { data: participant, error } = await supabase
    .from("participants")
    .select("status, display_name")
    .eq("session_id", session.id)
    .eq("guest_key", guestKey)
    .single()

  if (error) {
    // Not found is OK (means no RSVP yet)
    if (error.code === "PGRST116") {
      return { ok: true, status: null }
    }
    return { ok: false, error: error.message }
  }

  // Map status to our return type
  if (participant.status === "confirmed") {
    return { ok: true, status: "confirmed", displayName: participant.display_name }
  } else if (participant.status === "cancelled") {
    return { ok: true, status: "cancelled", displayName: participant.display_name }
  } else if (participant.status === "waitlisted") {
    return { ok: true, status: "waitlisted", displayName: participant.display_name }
  }

  return { ok: true, status: null }
}

/**
 * Join a session by public_code (create or update participant with status "confirmed")
 * Enforces capacity limit server-side
 * Uses UPSERT by (session_id, guest_key): updates existing participant or creates new one
 */
export async function joinSession(
  publicCode: string,
  name: string,
  guestKey: string,
  phone?: string | null
): Promise<{ ok: true } | { ok: false; error: string; code?: "CAPACITY_EXCEEDED" | "SESSION_NOT_FOUND" }> {
  const supabase = await createClient()

  // Lookup session by public_code
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, capacity, status, host_slug, waitlist_enabled")
    .eq("public_code", publicCode)
    .eq("status", "open")
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found or not available", code: "SESSION_NOT_FOUND" }
  }

  const trimmedName = name.trim()
  const trimmedPhone = phone?.trim() || null

  // Check if participant already exists by guest_key
  const { data: existingParticipant } = await supabase
    .from("participants")
    .select("id, status")
    .eq("session_id", session.id)
    .eq("guest_key", guestKey)
    .single()

  // If participant already exists, update status and name (in case they changed it)
  if (existingParticipant) {
    const { error: updateError } = await supabase
      .from("participants")
      .update({ 
        status: "confirmed",
        display_name: trimmedName,
        contact_phone: trimmedPhone,
      })
      .eq("session_id", session.id)
      .eq("guest_key", guestKey)

    if (updateError) {
      return { ok: false, error: updateError.message }
    }

    // Revalidate the session page
    if (session.host_slug && publicCode) {
      revalidatePath(`/${session.host_slug}/${publicCode}`)
    }

    return { ok: true }
  }

  // Participant doesn't exist - check capacity before inserting
  const { count, error: countError } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", session.id)
    .eq("status", "confirmed")

  if (countError) {
    return { ok: false, error: countError.message }
  }

  // Check capacity and waitlist logic
  const isFull = session.capacity && count !== null && count >= session.capacity
  const waitlistEnabled = (session as any).waitlist_enabled !== false // Default to true if null/undefined

  if (isFull) {
    // Session is full - check if waitlist is enabled
    if (waitlistEnabled) {
      // Join waitlist instead
      const { error: insertError } = await supabase.from("participants").insert({
        session_id: session.id,
        display_name: trimmedName,
        contact_phone: trimmedPhone,
        guest_key: guestKey,
        status: "waitlisted",
      })

      if (insertError) {
        // If unique constraint violation, try update instead
        if (insertError.code === "23505") {
          const { error: updateError } = await supabase
            .from("participants")
            .update({ status: "waitlisted", display_name: trimmedName, contact_phone: trimmedPhone })
            .eq("session_id", session.id)
            .eq("guest_key", guestKey)

          if (updateError) {
            return { ok: false, error: updateError.message }
          }
        } else {
          return { ok: false, error: insertError.message }
        }
      }

      // Revalidate the session page
      if (session.host_slug && publicCode) {
        revalidatePath(`/${session.host_slug}/${publicCode}`)
      }

      return { ok: true }
    } else {
      // Waitlist disabled - block joining
      return { ok: false, error: "Session is full", code: "CAPACITY_EXCEEDED" }
    }
  }

  // Session has capacity - join normally
  const { error: insertError } = await supabase.from("participants").insert({
    session_id: session.id,
    display_name: trimmedName,
    contact_phone: trimmedPhone,
    guest_key: guestKey,
    status: "confirmed",
  })

  if (insertError) {
    // If unique constraint violation (shouldn't happen due to check above, but handle gracefully)
    if (insertError.code === "23505") {
      // Try update instead
      const { error: updateError } = await supabase
        .from("participants")
        .update({ status: "confirmed", display_name: trimmedName, contact_phone: trimmedPhone })
        .eq("session_id", session.id)
        .eq("guest_key", guestKey)

      if (updateError) {
        return { ok: false, error: updateError.message }
      }
    } else {
      return { ok: false, error: insertError.message }
    }
  }

  // Revalidate the session page using the hostSlug/code format
  if (session.host_slug && publicCode) {
    revalidatePath(`/${session.host_slug}/${publicCode}`)
  }

  return { ok: true }
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
      .eq("session_id", session.id)
      .eq("guest_key", guestKey)

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
 * Submit payment proof for a session participant
 * Uploads file to Supabase Storage and creates payment_proofs record
 */
export async function submitPaymentProof(
  sessionId: string,
  guestKey: string,
  fileData: string, // Base64 encoded image data
  fileName: string
): Promise<{ ok: true; paymentProofId: string } | { ok: false; error: string }> {
  const supabase = await createClient()

  // Verify session exists and is open
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("status", "open")
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found or not available" }
  }

  // Find participant by session_id and guest_key
  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("guest_key", guestKey)
    .eq("status", "confirmed") // Only allow payment if they're confirmed/joined
    .single()

  if (participantError || !participant) {
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
    const filePath = `payment-proofs/${sessionId}/${participant.id}/${Date.now()}.${fileExt}`

    // Use admin client for storage upload (bypasses RLS, but we've already validated participant on server)
    const adminClient = createAdminClient()
    
    // Upload to Supabase Storage (using payment-proofs bucket)
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("payment-proofs")
      .upload(filePath, buffer, {
        contentType: `image/${normalizedExt}`,
        upsert: false,
        cacheControl: "3600",
      })

    if (uploadError) {
      console.error("[submitPaymentProof] Storage upload error:", {
        message: uploadError.message,
        name: uploadError.name,
      })
      
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

    // Get public URL using admin client
    const { data: urlData } = adminClient.storage.from("payment-proofs").getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    // Insert payment_proofs record using admin client (bypasses RLS, but we've validated participant exists)
    const { data: proofData, error: insertError } = await adminClient
      .from("payment_proofs")
      .insert({
        session_id: sessionId,
        participant_id: participant.id,
        proof_image_url: publicUrl,
        payment_status: "pending_review",
        ocr_status: "pending",
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("[submitPaymentProof] DB insert error:", insertError)
      // Try to clean up uploaded file using admin client
      const adminClient = createAdminClient()
      await adminClient.storage.from("payment-proofs").remove([filePath])
      return { ok: false, error: "Failed to save payment proof. Please try again." }
    }

    // Revalidate session page
    revalidatePath(`/session/${sessionId}`)

    return { ok: true, paymentProofId: proofData.id }
  } catch (error: any) {
    console.error("[submitPaymentProof] Error:", error)
    return { ok: false, error: error?.message || "Failed to submit payment proof. Please try again." }
  }
}

