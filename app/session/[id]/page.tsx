import { createClient } from "@/lib/supabase/server/server"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { PublicSessionView } from "@/components/session/public-session-view"
import { getUser } from "@/lib/supabase/server/server"
import type { Metadata } from "next"
import { format, parseISO } from "date-fns"

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
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id: sessionId } = await params
  const supabase = await createClient()

  // Fetch session for metadata
  const { data: session } = await supabase
    .from("sessions")
    .select("title, host_name, cover_url, status, start_at, location, sport, host_slug, public_code")
    .eq("id", sessionId)
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
        url: `${siteUrl}/session/${sessionId}`,
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
  
  // Generate description with session details
  let description = `${hostName} is inviting you to a session!`
  if (session.start_at || session.location || session.sport) {
    const parts: string[] = []
    if (session.start_at) {
      try {
        const startDate = parseISO(session.start_at)
        const dayName = format(startDate, "EEE")
        parts.push(`this ${dayName}`)
      } catch (e) {
        // Ignore date parsing errors
      }
    }
    const sportLabel = session.sport ? (session.sport === "badminton" ? "badminton" : session.sport === "pickleball" ? "pickleball" : session.sport === "volleyball" ? "volleyball" : "sports") : null
    const location = session.location || null
    
    if (sportLabel) {
      description = `Join ${hostName} for a ${sportLabel} session`
      if (parts.length > 0) {
        description += ` ${parts[0]}`
      }
      if (location) {
        description += ` at ${location}`
      }
      description += "!"
    } else if (location) {
      description = `Join ${hostName} ${parts.length > 0 ? `${parts[0]} ` : ""}at ${location}!`
    }
  }
  
  // Prefer canonical URL if available, otherwise fallback to session ID route
  const canonicalUrl = session.host_slug && session.public_code 
    ? `${siteUrl}/${session.host_slug}/${session.public_code}`
    : `${siteUrl}/session/${sessionId}`
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

async function PublicSessionContent({ sessionId }: { sessionId: string }) {
  const supabase = await createClient()

  // Check if user is authenticated and if they are the host
  const user = await getUser(supabase)
  
  // Fetch session data (RLS will allow access if user is host OR if session is open)
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    // Log error details for debugging
    const errorInfo = sessionError ? {
      message: sessionError.message,
      details: sessionError.details,
      hint: sessionError.hint,
      code: sessionError.code,
    } : null
    console.error(`[PublicSessionPage] Error fetching session (${sessionId}):`, errorInfo)
    notFound()
  }

  // If user is authenticated and is the host, redirect to analytics page
  if (user && session.host_id === user.id) {
    redirect(`/host/sessions/${sessionId}/edit`)
  }

  // Only show open sessions to public (non-host users)
  if (session.status !== "open") {
    notFound()
  }

  // Fetch participants (confirmed for going list, waitlisted for waitlist)
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name, status")
    .eq("session_id", sessionId)
    .in("status", ["confirmed", "waitlisted"])
    .order("created_at", { ascending: true })

  if (participantsError) {
    console.error(`[PublicSessionPage] Error fetching participants:`, {
      error: participantsError,
      code: participantsError.code,
      message: participantsError.message,
      details: participantsError.details,
      hint: participantsError.hint,
      sessionId,
      sessionStatus: session.status,
    })
  } else {
    console.log(`[PublicSessionPage] Fetched ${participants?.length || 0} participants for session ${sessionId}`)
  }

  // Separate confirmed and waitlisted
  const confirmedParticipants = (participants || []).filter(p => p.status === "confirmed")
  const waitlistParticipants = (participants || []).filter(p => p.status === "waitlisted")

  // Fetch host profile for avatar
  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", session.host_id)
    .single()

  return (
    <PublicSessionView
      session={session}
      participants={confirmedParticipants}
      waitlist={waitlistParticipants}
      hostAvatarUrl={hostProfile?.avatar_url || null}
    />
  )
}

export default async function PublicSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: sessionId } = await params

  return (
    <main className="min-h-screen sporty-bg">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <PublicSessionContent sessionId={sessionId} />
      </Suspense>
    </main>
  )
}

