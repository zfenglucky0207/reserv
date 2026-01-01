import { createClient } from "@/lib/supabase/server/server"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { PublicSessionView } from "@/components/session/public-session-view"
import { toSlug } from "@/lib/utils/slug"
import { getUser } from "@/lib/supabase/server/server"

// Force dynamic rendering to always fetch latest data
export const dynamic = "force-dynamic"

async function PublicInviteContent({
  hostSlug,
  code,
}: {
  hostSlug: string
  code: string
}) {
  const supabase = await createClient()

  // Exclude known reserved paths that shouldn't be treated as session codes
  const reservedPaths = ["login", "auth", "signin", "signup", "register", "dashboard", "admin", "api"]
  if (reservedPaths.includes(code.toLowerCase()) || reservedPaths.includes(hostSlug.toLowerCase())) {
    notFound()
  }

  // Check if user is authenticated and if they are the host
  const user = await getUser(supabase)

  // Lookup session by public_code (code is the source of truth)
  // RLS will allow access if user is host OR if session is open
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("public_code", code)
    .single()

  if (sessionError || !session) {
    // Only log errors for codes that look like valid session codes (alphanumeric, reasonable length)
    // Avoid logging errors for obvious non-session routes like "login"
    const looksLikeSessionCode = /^[a-zA-Z0-9]{4,}$/.test(code)
    if (looksLikeSessionCode) {
      console.error(`[PublicInvitePage] Error fetching session by code (${code}):`, sessionError)
    }
    notFound()
  }

  // If user is authenticated and is the host, redirect to analytics page
  if (user && session.host_id === user.id) {
    redirect(`/host/sessions/${session.id}/edit`)
  }

  // Only show open sessions to public (non-host users)
  if (session.status !== "open") {
    notFound()
  }

  // Canonicalize hostSlug - redirect if it doesn't match current host_slug
  const currentHostSlug = session.host_slug ? toSlug(session.host_slug) : toSlug(session.host_name || "host")
  if (hostSlug !== currentHostSlug) {
    // Redirect to canonical URL (Next.js redirect does temporary redirect by default)
    redirect(`/${currentHostSlug}/${code}`)
  }

  // Fetch participants (only "confirmed" status for public view)
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name")
    .eq("session_id", session.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })

  if (participantsError) {
    console.error(`[PublicInvitePage] Error fetching participants:`, participantsError)
  }

  return (
    <PublicSessionView
      session={session}
      participants={participants || []}
    />
  )
}

export default async function PublicInvitePage({
  params,
}: {
  params: Promise<{ hostSlug: string; code: string }>
}) {
  const { hostSlug, code } = await params

  return (
    <main className="min-h-screen sporty-bg">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <PublicInviteContent hostSlug={hostSlug} code={code} />
      </Suspense>
    </main>
  )
}

