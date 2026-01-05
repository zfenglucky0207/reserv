import { createClient } from "@/lib/supabase/server/server"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { PublicSessionView } from "@/components/session/public-session-view"
import { toSlug } from "@/lib/utils/slug"
import { getUser } from "@/lib/supabase/server/server"
import type { Metadata } from "next"

// Force dynamic rendering to always fetch latest data
export const dynamic = "force-dynamic"

/**
 * Generate absolute URL for cover image
 */
function makeAbsoluteCoverUrl(siteUrl: string, coverUrl: string | null): string {
  if (!coverUrl) {
    return `${siteUrl}/og-default.png`
  }
  
  // If already absolute, return as-is
  if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
    return coverUrl
  }
  
  // If starts with /, it's a relative path on same domain
  if (coverUrl.startsWith("/")) {
    return `${siteUrl}${coverUrl}`
  }
  
  // Otherwise, assume it's a Supabase storage URL (should already be absolute)
  return coverUrl
}

/**
 * Generate metadata for Open Graph / Twitter / WhatsApp previews
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostSlug: string; code: string }>
}): Promise<Metadata> {
  const { hostSlug, code } = await params
  const supabase = await createClient()

  // Fetch session for metadata
  const { data: session } = await supabase
    .from("sessions")
    .select("title, host_name, cover_url, status")
    .eq("public_code", code)
    .single()

  // Get site URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : "https://reserv.app") // Fallback domain

  // If session not found or not open, use defaults
  if (!session || session.status !== "open") {
    return {
      title: "Session invite",
      description: "Join this session on RESERV",
      openGraph: {
        title: "Session invite",
        description: "Join this session on RESERV",
        url: `${siteUrl}/${hostSlug}/${code}`,
        type: "website",
        images: [{ url: `${siteUrl}/og-default.png`, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Session invite",
        description: "Join this session on RESERV",
        images: [`${siteUrl}/og-default.png`],
      },
    }
  }

  const title = session.title || "Session invite"
  const hostName = session.host_name || "Someone"
  const description = `${hostName} is inviting you to a session!`
  const canonicalUrl = `${siteUrl}/${hostSlug}/${code}`
  const imageUrl = makeAbsoluteCoverUrl(siteUrl, session.cover_url)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

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

  // Fetch participants (both "confirmed" and "waitlisted" status for public view)
  const { data: allParticipants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name, status")
    .eq("session_id", session.id)
    .in("status", ["confirmed", "waitlisted"])
    .order("created_at", { ascending: true })

  if (participantsError) {
    console.error(`[PublicInvitePage] Error fetching participants:`, participantsError)
  }

  // Separate confirmed and waitlisted participants
  const confirmedParticipants = (allParticipants || []).filter(p => p.status === "confirmed")
  const waitlistParticipants = (allParticipants || []).filter(p => p.status === "waitlisted")

  return (
    <PublicSessionView
      session={session}
      participants={confirmedParticipants}
      waitlist={waitlistParticipants}
      hostSlug={currentHostSlug}
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

