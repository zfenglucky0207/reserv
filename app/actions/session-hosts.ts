"use server"

import { createAdminClient } from "@/lib/supabase/server/server"

/**
 * Link pending session invites to a user when they sign up/log in
 * This is called from the auth provider when a user signs in
 */
export async function linkPendingInvites(userEmail: string, userId: string): Promise<{
  ok: true
  linkedCount: number
} | {
  ok: false
  error: string
}> {
  try {
    const adminClient = createAdminClient()

    // Find pending invites for this email
    const { data: pendingInvites, error: fetchError } = await adminClient
      .from("session_hosts")
      .select("id, session_id, email")
      .eq("email", userEmail.toLowerCase())
      .is("user_id", null)

    if (fetchError) {
      console.error("[linkPendingInvites] Error fetching pending invites:", fetchError)
      return { ok: false, error: fetchError.message }
    }

    if (!pendingInvites || pendingInvites.length === 0) {
      return { ok: true, linkedCount: 0 } // No pending invites
    }

    // Link all pending invites to this user
    const { error: updateError } = await adminClient
      .from("session_hosts")
      .update({
        user_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .in(
        "id",
        pendingInvites.map((inv) => inv.id)
      )

    if (updateError) {
      console.error("[linkPendingInvites] Error linking pending invites:", updateError)
      return { ok: false, error: updateError.message }
    }

    return { ok: true, linkedCount: pendingInvites.length }
  } catch (error: any) {
    console.error("[linkPendingInvites] Unexpected error:", error)
    return { ok: false, error: error?.message || "Unknown error" }
  }
}
