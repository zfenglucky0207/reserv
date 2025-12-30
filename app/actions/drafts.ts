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

export type DraftSummary = {
  id: string
  name: string
  updated_at: string
  created_at: string
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

  return { ok: true, drafts: data || [] }
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
  data: DraftData
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
  name?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    return { ok: false, error: "Unauthorized" }
  }

  const updateData: { data: DraftData; updated_at: string; name?: string } = {
    data,
    updated_at: new Date().toISOString(),
  }

  if (name && name.trim()) {
    updateData.name = name.trim()
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


