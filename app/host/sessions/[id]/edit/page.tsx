import { HostSessionEditClient } from "@/components/host/host-session-edit-client"
import { createClient, getUserId } from "@/lib/supabase/server/server"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

// Force dynamic rendering to always fetch latest data
export const dynamic = "force-dynamic"

async function HostSessionEditContent({
  sessionId,
  isPreviewMode,
  forceEditMode = false,
}: {
  sessionId: string
  isPreviewMode: boolean
  forceEditMode?: boolean
}) {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    // If the user signs out while on this page, default them back to home.
    redirect("/")
  }

  // Verify user has access to session via session_hosts
  const { getSessionAccess } = await import("@/app/host/sessions/[id]/actions")
  const access = await getSessionAccess(sessionId)
  
  if (!access.ok) {
    console.error(`[HostSessionEditContent] Access denied:`, access.error)
    notFound()
  }

  // Fetch session data
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single()

  if (error || !session) {
    console.error(`[HostSessionEditContent] Error fetching session:`, error)
    notFound()
  }


  // Determine if session is published
  const isPublished = session.status === "open" && !!session.public_code

  // If forceEditMode is true, always start in edit mode (even if published)
  // If isPreviewMode is true, always start in preview mode (even if published)
  const shouldStartInEditMode = forceEditMode || (!isPreviewMode && !isPublished)
  const shouldStartInPreviewMode = isPreviewMode
  

  return (
    <HostSessionEditClient
      sessionId={sessionId}
      initialCoverUrl={session.cover_url || null}
      initialSport={session.sport || null}
      initialEditMode={shouldStartInEditMode} // Force edit mode if requested, otherwise analytics for published
      initialPreviewMode={shouldStartInPreviewMode} // Allow preview mode even for published sessions
      initialTitle={session.title || null}
      initialDate={null} // TODO: Format from session.start_at if needed
      initialLocation={session.location || null}
      initialPrice={(session as any).price ?? null} // Preserve 0 (Free). null = TBD.
      initialCapacity={session.capacity || null}
      initialCourt={(session as any).court_numbers || null} // Type assertion until types are regenerated
      initialContainerOverlayEnabled={(session as any).container_overlay_enabled ?? true} // Type assertion until types are regenerated
      initialHostName={session.host_name || null}
      initialDescription={session.description || null}
      initialMapUrl={(session as any).map_url || null} // Load map URL from database
      initialPaymentQrImage={(session as any).payment_qr_image || null} // Load QR image from database
      initialIsPublished={isPublished} // Pass published status
      initialSessionStatus={session.status} // Pass session status for draft update logic
      publicCode={(session as any).public_code || null} // Pass publicCode for sharing
      hostSlug={(session as any).host_slug || null} // Pass hostSlug for sharing
    />
  )
}

export default async function HostSessionEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { id: sessionId } = await params
  const { mode } = await searchParams
  const isPreviewMode = mode === "preview"
  const forceEditMode = mode === "edit"
  

  return (
    <main className="min-h-screen sporty-bg">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <HostSessionEditContent sessionId={sessionId} isPreviewMode={isPreviewMode} forceEditMode={forceEditMode} />
      </Suspense>
    </main>
  )
}
