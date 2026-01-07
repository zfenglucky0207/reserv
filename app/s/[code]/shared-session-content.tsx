"use client"

import { SessionInvite } from "@/components/session-invite"

interface SharedSessionContentProps {
  sessionId: string
  session: {
    cover_url: string | null
    sport: string | null
  }
}

export function SharedSessionContent({
  sessionId,
  session,
}: SharedSessionContentProps) {
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

