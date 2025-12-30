"use client"

import { SessionInvite } from "@/components/session-invite"

interface HostSessionEditClientProps {
  sessionId: string
  initialCoverUrl: string | null
  initialSport: "badminton" | "pickleball" | "volleyball" | "other" | null
  initialEditMode: boolean
  initialPreviewMode: boolean
  initialTitle: string | null
  initialDate: string | null
  initialLocation: string | null
  initialPrice: number | null
  initialCapacity: number | null
  initialHostName: string | null
  initialDescription: string | null
  initialIsPublished: boolean
  initialSessionStatus?: "draft" | "open" | "closed" | "completed" | "cancelled" // Session status for draft update logic
}

export function HostSessionEditClient({
  sessionId,
  initialCoverUrl,
  initialSport,
  initialEditMode,
  initialPreviewMode,
  initialTitle,
  initialDate,
  initialLocation,
  initialPrice,
  initialCapacity,
  initialHostName,
  initialDescription,
  initialIsPublished,
  initialSessionStatus,
}: HostSessionEditClientProps) {
  return (
    <SessionInvite
      sessionId={sessionId}
      initialCoverUrl={initialCoverUrl}
      initialSport={initialSport}
      initialEditMode={initialEditMode}
      initialPreviewMode={initialPreviewMode}
      initialTitle={initialTitle}
      initialDate={initialDate}
      initialLocation={initialLocation}
      initialPrice={initialPrice}
      initialCapacity={initialCapacity}
      initialHostName={initialHostName}
      initialDescription={initialDescription}
      initialIsPublished={initialIsPublished}
      initialSessionStatus={initialSessionStatus}
    />
  )
}

