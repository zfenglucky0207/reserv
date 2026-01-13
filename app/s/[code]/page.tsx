import { SharedSessionContent } from "./shared-session-content"
import { createAdminClient, createClient } from "@/lib/supabase/server/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"

// Force dynamic rendering to always fetch latest cover
export const dynamic = "force-dynamic"

export default async function SharedSessionPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: sessionId } = await params
  const supabase = await createClient()

  // Fetch session (public read) - explicit fields only
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, title, host_name, host_slug, host_id, host_avatar_url, cover_url, status, public_code, start_at, end_at, location, sport, capacity, waitlist_enabled, description, payment_account_name, payment_account_number, payment_bank_name, created_at, updated_at")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    console.error(`[SharedSessionPage] Error fetching session:`, sessionError)
    notFound()
  }

  // Only show open sessions to public
  if (session.status !== "open") {
    notFound()
  }

  // If host avatar URL isn't stored yet (older sessions), fetch it from Auth via service role and cache it.
  if (!(session as any).host_avatar_url) {
    try {
      const admin = createAdminClient()
      const { data } = await admin.auth.admin.getUserById(session.host_id)
      const avatarUrl =
        (data as any)?.user?.user_metadata?.avatar_url ||
        (data as any)?.user?.user_metadata?.picture ||
        null
      if (avatarUrl) {
        await admin
          .from("sessions")
          .update({ host_avatar_url: avatarUrl })
          .eq("id", session.id)
        ;(session as any).host_avatar_url = avatarUrl
      }
    } catch {}
  }

  console.log(`[SharedSessionPage] Session fetched:`, { 
    sessionId, 
    cover_url: session.cover_url,
    hasCoverUrl: !!session.cover_url 
  })

  return (
    <main className="min-h-screen sporty-bg">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <SharedSessionContent sessionId={sessionId} session={session} />
      </Suspense>
    </main>
  )
}
