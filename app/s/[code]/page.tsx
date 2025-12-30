import { SessionInvite } from "@/components/session-invite"
import { createClient } from "@/lib/supabase/server/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"

// Force dynamic rendering to always fetch latest cover
export const dynamic = "force-dynamic"

async function SharedSessionContent({
  sessionId,
  session,
}: {
  sessionId: string
  session: any
}) {
  // For shared/public view, show in preview mode only (not edit mode)
  return (
    <SessionInvite
      sessionId={sessionId}
      initialCoverUrl={session.cover_url || null}
      initialSport={session.sport || null}
      initialEditMode={false}
      initialPreviewMode={true}
    />
  )
}

export default async function SharedSessionPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: sessionId } = await params
  const supabase = await createClient()

  // Fetch session (public read)
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
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
