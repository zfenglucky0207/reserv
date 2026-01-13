import { createAdminClient, createClient } from "@/lib/supabase/server/server"
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
  // Select only fields needed for public invite page (explicit fields, not *)
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, title, host_name, host_slug, host_id, host_avatar_url, cover_url, status, public_code, start_at, end_at, location, sport, capacity, waitlist_enabled, description, payment_account_name, payment_account_number, payment_bank_name, map_url, payment_qr_image, created_at, updated_at")
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

  // Canonicalize hostSlug - redirect if it doesn't match current host_slug
  const currentHostSlug = session.host_slug ? toSlug(session.host_slug) : toSlug(session.host_name || "host")
  if (hostSlug !== currentHostSlug) {
    // Redirect to canonical URL (Next.js redirect does temporary redirect by default)
    redirect(`/${currentHostSlug}/${code}`)
  }

  // Fetch participants - EXACT same logic as session control (getSessionAnalytics)
  // Get ALL participants first (no status filter), then filter client-side
  const { data: allParticipants, error: participantsError } = await supabase
    .from("participants")
    .select("id, display_name, status, created_at, is_host")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })

  if (participantsError) {
    console.error(`[PublicInvitePage] Error fetching participants:`, participantsError)
  }

  // Separate confirmed and waitlisted participants - EXACT same logic as getSessionAnalytics
  const confirmedParticipants =
    (allParticipants || [])
      .filter((p) => p.status === "confirmed")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        is_host: (p as any).is_host === true,
        status: p.status as "confirmed",
      })) || []

  const waitlistParticipants =
    (allParticipants || [])
      .filter((p) => p.status === "waitlisted")
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        is_host: (p as any).is_host === true,
        status: p.status as "waitlisted",
      })) || []

  // Debug: Log participant separation - same format as session control
  console.log("[PublicInvitePage] Participants fetched", {
    total: allParticipants?.length || 0,
    confirmed: confirmedParticipants.length,
    waitlisted: waitlistParticipants.length,
    allParticipants: allParticipants?.map(p => ({ id: p.id, name: p.display_name, status: p.status })),
    waitlistParticipants: waitlistParticipants.map(p => ({ id: p.id, name: p.display_name, status: p.status }))
  })

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

