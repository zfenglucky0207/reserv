"use server"

import { createClient, getUserId } from "@/lib/supabase/server/server"

export type DraftData = {
  selectedSport: string
  theme: string
  effects: { grain: boolean; glow: boolean; vignette: boolean }
  optimisticCoverUrl: string | null
  eventTitle: string
  titleFont: string
  eventDate: string
  eventLocation: string
  eventMapUrl: string
  eventPrice: number | null
  eventCapacity: number
  hostName: string | null
  eventDescription: string
  bankName: string
  accountNumber: string
  accountName: string
  paymentNotes: string
  paymentQrImage: string | null
}

export type DraftSummary = {
  id: string
  name: string
  updated_at: string
  created_at: string
  is_live?: boolean // Optional: true if corresponding session is published/live
}

export type Draft = DraftSummary & {
  data: DraftData
}

const MAX_DRAFTS = 2

export async function listDrafts(): Promise<{ ok: true; drafts: DraftSummary[] } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("session_drafts")
    .select("id, name, updated_at, created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    return { ok: false, error: error.message }
  }

  // Check which drafts have corresponding live sessions
  // We'll check if there's a live session with the same title (hosted by this user)
  const draftsWithLiveStatus = await Promise.all(
    (data || []).map(async (draft) => {
      // Check if there's a live session with matching title
      // Note: This is a best-effort check. If drafts don't have a direct session_id link,
      // we match by title + host_id. This might have false positives/negatives.
      const { data: liveSession } = await supabase
        .from("sessions")
        .select("id, status")
        .eq("host_id", userId)
        .eq("status", "open")
        .eq("title", draft.name)
        .limit(1)
        .maybeSingle()

      return {
        ...draft,
        is_live: !!liveSession,
      }
    })
  )

  return { ok: true, drafts: draftsWithLiveStatus }
}

export async function getDraft(draftId: string): Promise<{ ok: true; draft: Draft } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("session_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("user_id", userId)
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  if (!data) {
    return { ok: false, error: "Draft not found" }
  }

  return { ok: true, draft: data as Draft }
}

export async function saveDraft(
  name: string,
  data: DraftData,
  sourceSessionId?: string | null
): Promise<
  | { ok: true }
  | { ok: false; error: string; code?: "LIMIT_REACHED" | "DUPLICATE_NAME" | "INVALID_NAME" }
> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  if (!name || !name.trim()) {
    return { ok: false, error: "Draft name is required", code: "INVALID_NAME" }
  }

  const trimmedName = name.trim()

  // Check current draft count
  const { count, error: countError } = await supabase
    .from("session_drafts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  if (countError) {
    return { ok: false, error: countError.message }
  }

  if (count && count >= MAX_DRAFTS) {
    return { ok: false, error: "Maximum 2 drafts allowed. Please delete or overwrite an existing draft.", code: "LIMIT_REACHED" }
  }

  // Insert new draft
  const { error } = await supabase.from("session_drafts").insert({
    user_id: userId,
    name: trimmedName,
    data,
    source_session_id: sourceSessionId || null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function overwriteDraft(
  draftId: string,
  data: DraftData,
  name?: string,
  sourceSessionId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  const updateData: { data: DraftData; updated_at: string; name?: string; source_session_id?: string | null } = {
    data,
    updated_at: new Date().toISOString(),
  }

  if (name && name.trim()) {
    updateData.name = name.trim()
  }

  if (sourceSessionId !== undefined) {
    updateData.source_session_id = sourceSessionId || null
  }

  const { error } = await supabase
    .from("session_drafts")
    .update(updateData)
    .eq("id", draftId)
    .eq("user_id", userId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function deleteDraft(draftId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("session_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", userId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

/**
 * Check if a session has been saved to drafts and get draft status
 * Returns whether the session is saved to drafts and the list of existing drafts
 */
export async function getDraftStatusForSession(
  sessionId: string
): Promise<
  | { ok: true; isSavedToDraft: boolean; drafts: DraftSummary[] }
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
    .select("host_id")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return { ok: false, error: "Session not found" }
  }

  if (session.host_id !== userId) {
    return { ok: false, error: "Unauthorized: You don't own this session" }
  }

  // Get all drafts for this user (limit 2)
  const { data: drafts, error: draftsError } = await supabase
    .from("session_drafts")
    .select("id, name, updated_at, created_at, source_session_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_DRAFTS)

  if (draftsError) {
    return { ok: false, error: draftsError.message }
  }

  // Check if any draft is linked to this session
  const isSavedToDraft = drafts?.some((draft) => draft.source_session_id === sessionId) || false

  // Return draft summaries (without source_session_id in the response)
  const draftSummaries: DraftSummary[] = (drafts || []).map((draft) => ({
    id: draft.id,
    name: draft.name,
    updated_at: draft.updated_at,
    created_at: draft.created_at,
  }))

  return {
    ok: true,
    isSavedToDraft,
    drafts: draftSummaries,
  }
}


