"use server"

import { revalidatePath } from "next/cache"
import { createClient, getUserId } from "@/lib/supabase/server/server"
import { redirect } from "next/navigation"

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

