"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SessionInvite } from "@/components/session-invite"
import { GuestRSVPDialog } from "./guest-rsvp-dialog"
import { joinSession, declineSession } from "@/app/session/[id]/actions"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Participant {
  id: string
  display_name: string
}

interface Session {
  id: string
  title: string
  description: string | null
  location: string | null
  cover_url: string | null
  sport: "badminton" | "pickleball" | "volleyball" | "other"
  host_name: string | null
  capacity: number | null
  start_at: string
  end_at: string | null
  // Add price if it exists in the schema
  // price?: number | null
}

interface PublicSessionViewProps {
  session: Session
  participants: Participant[]
}

// Format timestamp to display format
function formatSessionDate(startAt: string, endAt: string | null): string {
  try {
    const start = parseISO(startAt)
    const end = endAt ? parseISO(endAt) : null

    const dayName = format(start, "EEE")
    const monthName = format(start, "MMM")
    const day = format(start, "d")
    const startTime = format(start, "h:mm a")
    const endTime = end ? format(end, "h:mm a") : null

    if (endTime) {
      return `${dayName}, ${monthName} ${day} • ${startTime} - ${endTime}`
    }
    return `${dayName}, ${monthName} ${day} • ${startTime}`
  } catch {
    return "Date TBD"
  }
}

// Map sport enum to display name
function getSportDisplayName(sport: string): string {
  const map: Record<string, string> = {
    badminton: "Badminton",
    pickleball: "Pickleball",
    volleyball: "Volleyball",
    other: "Other",
  }
  return map[sport] || sport
}

function PublicSessionViewContent({ session, participants }: PublicSessionViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false)
  const [rsvpAction, setRsvpAction] = useState<"join" | "decline">("join")
  const [uiMode, setUiMode] = useState<"dark" | "light">("dark")
  
  // Check if user came from analytics page
  const fromAnalytics = searchParams.get("from") === "analytics"

  // Hydrate uiMode from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("reserv-ui-mode")
      if (saved === "light" || saved === "dark") {
        setUiMode(saved)
      }
    }
  }, [])

  // Persist uiMode
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("reserv-ui-mode", uiMode)
    }
  }, [uiMode])

  const formattedDate = formatSessionDate(session.start_at, session.end_at)
  const sportDisplayName = getSportDisplayName(session.sport)

  // Convert participants to demo format for SessionInvite
  const demoParticipants = participants.map((p) => ({
    name: p.display_name,
    avatar: null,
  }))

  // Sync UI mode from SessionInvite if needed (it manages its own state)
  // We'll keep this component's state for the dialog styling

  const handleRSVPClick = (action: "join" | "decline") => {
    setRsvpAction(action)
    setRsvpDialogOpen(true)
  }

  const handleRSVPContinue = async (name: string, phone: string | null) => {
    try {
      // Get public_code from session (it should exist if session is published)
      const publicCode = (session as any).public_code
      if (!publicCode) {
        toast({
          title: "Error",
          description: "Session is not published.",
          variant: "destructive",
        })
        return
      }

      let result
      if (rsvpAction === "join") {
        result = await joinSession(publicCode, name, phone)
        if (result.ok) {
          toast({
            title: "You're in!",
            description: "You've successfully joined this session.",
            variant: "success",
          })
          // Refresh the page to show updated participant list
          router.refresh()
        } else {
          if (result.code === "CAPACITY_EXCEEDED") {
            toast({
              title: "Session is full",
              description: result.error,
              variant: "destructive",
            })
          } else {
            toast({
              title: "Failed to join",
              description: result.error,
              variant: "destructive",
            })
          }
        }
      } else {
        result = await declineSession(publicCode, name, phone)
        if (result.ok) {
          toast({
            title: "Declined",
            description: "You've declined this session invitation.",
            variant: "success",
          })
        } else {
          toast({
            title: "Failed to decline",
            description: result.error,
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBackToAnalytics = () => {
    router.push(`/host/sessions/${session.id}/edit`)
  }

  return (
    <>
      {/* Back to Analytics Button - only show if from analytics */}
      {fromAnalytics && (
        <div className="fixed top-16 left-4 z-50">
          <Button
            onClick={handleBackToAnalytics}
            variant="outline"
            className={cn(
              "rounded-full h-10 px-4 gap-2 backdrop-blur-xl border shadow-lg",
              uiMode === "dark"
                ? "bg-black/40 border-white/20 text-white hover:bg-black/60"
                : "bg-white/80 border-black/20 text-black hover:bg-white"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to analytics</span>
          </Button>
        </div>
      )}

      <SessionInvite
        sessionId={session.id}
        initialCoverUrl={session.cover_url}
        initialSport={sportDisplayName}
        initialEditMode={false}
        initialPreviewMode={true}
        hidePreviewBanner={true} // Hide preview banner for public view
        initialTitle={session.title}
        initialDate={formattedDate}
        initialLocation={session.location || null}
        initialCapacity={session.capacity || null}
        initialHostName={session.host_name || null}
        initialDescription={session.description || null}
        demoMode={false}
        demoParticipants={demoParticipants}
        onJoinClick={() => handleRSVPClick("join")}
        onDeclineClick={() => handleRSVPClick("decline")}
      />

      {/* RSVP Dialog */}
      <GuestRSVPDialog
        open={rsvpDialogOpen}
        onOpenChange={setRsvpDialogOpen}
        onContinue={handleRSVPContinue}
        uiMode={uiMode}
        action={rsvpAction}
      />
    </>
  )
}

export function PublicSessionView({ session, participants }: PublicSessionViewProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PublicSessionViewContent session={session} participants={participants} />
    </Suspense>
  )
}

