"use client"

import { useState, useEffect, useRef, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SessionInvite } from "@/components/session-invite"
import { GuestRSVPDialog } from "./guest-rsvp-dialog"
import { LoginDialog } from "@/components/login-dialog"
import { getCurrentReturnTo, setPostAuthRedirect } from "@/lib/post-auth-redirect"
import { joinSession, getParticipantRSVPStatus, getUnpaidParticipants } from "@/app/session/[id]/actions"
import { log, logInfo, logWarn, logError, logGrouped, newTraceId, debugEnabled, withTrace } from "@/lib/logger"
import { DebugPanel } from "@/components/debug-panel"
import { useAuth } from "@/lib/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Check, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOrCreateGuestKey, getGuestKey } from "@/lib/guest-key"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Participant {
  id: string
  display_name: string
  user_id?: string | null // Will be added via migration
}

interface Session {
  id: string
  title: string
  description: string | null
  location: string | null
  cover_url: string | null
  sport: "badminton" | "pickleball" | "volleyball" | "other"
  host_name: string | null
  host_slug: string | null
  capacity: number | null
  start_at: string
  end_at: string | null
  court_numbers?: string | null
  container_overlay_enabled?: boolean | null
  public_code: string // Required for joining
  status?: "draft" | "open" | "closed" | "completed" | "cancelled" // Session status
  // Add price if it exists in the schema
  // price?: number | null
}

interface PublicSessionViewProps {
  session: Session
  participants: Participant[]
  waitlist?: Participant[]
  hostSlug?: string // Host slug from URL params
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

function PublicSessionViewContent({ session, participants, waitlist = [], hostSlug: urlHostSlug }: PublicSessionViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { isAuthenticated, user, authUser } = useAuth()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false)
  const [uiMode, setUiMode] = useState<"dark" | "light">("dark")
  const [rsvpState, setRsvpState] = useState<"none" | "joined" | "waitlisted">("none")
  const [isLoadingRSVP, setIsLoadingRSVP] = useState(true)
  const [storedParticipantInfo, setStoredParticipantInfo] = useState<{ name: string; phone: string | null } | null>(null)
  const [guestKey, setGuestKey] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null)
  const [makePaymentDialogOpen, setMakePaymentDialogOpen] = useState(false)
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null)
  const [payingForParticipantId, setPayingForParticipantId] = useState<string | null>(null)
  const [payingForParticipantName, setPayingForParticipantName] = useState<string | null>(null)
  const [unpaidParticipants, setUnpaidParticipants] = useState<Array<{ id: string; display_name: string }>>([])
  const [isLoadingUnpaid, setIsLoadingUnpaid] = useState(false)
  
  // Check if user came from analytics page
  const fromAnalytics = searchParams.get("from") === "analytics"
  
  // Get public_code from session
  const publicCode = session.public_code

  // Track last traceId for debug panel
  const [lastTraceId, setLastTraceId] = useState<string | null>(null)
  const [lastJoinError, setLastJoinError] = useState<string | null>(null)

  // Initialize guest key on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const key = getOrCreateGuestKey()
      setGuestKey(key)
      
      // Log page load
      logInfo("join_page_load", {
        publicCode,
        hostSlug: urlHostSlug,
        sessionId: session.id,
        url: typeof window !== "undefined" ? window.location.href : null,
        isAuthenticated,
        userId: authUser?.id || null,
        guestKey: key,
        hasParticipants: participants.length > 0,
        waitlistCount: waitlist.length,
      })
    }
  }, [])

  // Load participant RSVP status on mount using guest_key
  // CRITICAL: Only show "joined" if status is explicitly "confirmed"
  useEffect(() => {
    if (!publicCode || !guestKey) {
      setIsLoadingRSVP(false)
      return
    }

    const loadRSVPStatus = async () => {
      setIsLoadingRSVP(true)
      try {
        const result = await getParticipantRSVPStatus(publicCode, guestKey)
        if (result.ok) {
          // Only set "joined" if status is explicitly "confirmed"
          if (result.status === "confirmed") {
            setRsvpState("joined")
            if (result.displayName) {
              setStoredParticipantInfo({ name: result.displayName, phone: null })
            }
          } else if (result.status === "waitlisted") {
            setRsvpState("waitlisted")
            if (result.displayName) {
              setStoredParticipantInfo({ name: result.displayName, phone: null })
            }
          } else {
            // status is null, "cancelled", or anything else -> treat as "none"
            setRsvpState("none")
          }
        } else {
          // Error or not found -> default to "none"
          setRsvpState("none")
        }
      } catch (error) {
        console.error("[PublicSessionView] Error loading RSVP status:", error)
        setRsvpState("none")
      } finally {
        setIsLoadingRSVP(false)
      }
    }

    loadRSVPStatus()
  }, [publicCode, guestKey])

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

  // Calculate if session has started
  const now = new Date()
  const sessionStart = parseISO(session.start_at)
  const hasStarted = now >= sessionStart

  // Find current user's participant (if logged in)
  // Note: This requires a migration to add user_id to participants table
  // For now, we'll use guest_key as fallback via getCurrentParticipantId()
  const myParticipant = useMemo(() => {
    if (!isAuthenticated || !authUser?.id) return null
    // Try to find by user_id first (after migration adds this field)
    const byUserId = participants.find((p: any) => p.user_id === authUser.id)
    if (byUserId) return byUserId
    // Fallback: will be set via getCurrentParticipantId() in handleMakePaymentClick
    return null
  }, [participants, isAuthenticated, authUser?.id])

  // Convert participants to demo format for SessionInvite
  const demoParticipants = participants.map((p) => ({
    name: p.display_name,
    avatar: null,
  }))

  // Sync UI mode from SessionInvite if needed (it manages its own state)
  // We'll keep this component's state for the dialog styling

  const handleRSVPContinue = async (name: string, phone: string | null) => {
    try {
      if (!publicCode) {
        toast({
          title: "Error",
          description: "Session is not published.",
          variant: "destructive",
        })
        return
      }

      // Store participant info in localStorage
      const storageKey = `reserv_rsvp_${publicCode}`
      localStorage.setItem(storageKey, JSON.stringify({ name, phone }))
      setStoredParticipantInfo({ name, phone })

      if (!guestKey) {
        toast({
          title: "Error",
          description: "Unable to identify device. Please refresh the page.",
          variant: "destructive",
        })
        return
      }

      // Log request details
      const requestPayload = {
        publicCode,
        name,
        phone: phone || null,
        guestKey,
      }
      
      logInfo("join_request", withTrace({
        publicCode,
        hostSlug: urlHostSlug,
        hasName: !!name,
        nameLength: name.length,
        hasPhone: !!phone,
        guestKey,
        isAuthenticated,
        userId: authUser?.id || null,
        payload: requestPayload,
      }, traceId))

      // Use API route for better logging and diagnostics
      const res = await fetch("/api/join", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-trace-id": traceId,
        },
        body: JSON.stringify(requestPayload),
      })

      // Parse response with better error handling
      let json: any = null
      let responseText: string = ""
      try {
        responseText = await res.text()
        // Check if response is HTML (error page)
        if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
          const error = "Server returned HTML instead of JSON"
          logError("join_response_is_html", withTrace({ 
            status: res.status,
            contentType: res.headers.get("content-type"),
            responsePreview: responseText.substring(0, 200),
            stage: "response_parse",
          }, traceId))
          setLastJoinError(error)
          // Try to extract error from HTML or show generic message
          toast({
            title: "Server error",
            description: "The server returned an error page. Please try again or contact support.",
            variant: "destructive",
          })
          return
        }
        json = responseText ? JSON.parse(responseText) : null
      } catch (e) {
        const error = `Failed to parse response: ${String(e)}`
        logError("join_response_parse_error", withTrace({ 
          status: res.status, 
          error: String(e),
          responsePreview: responseText.substring(0, 200),
          contentType: res.headers.get("content-type"),
          stage: "response_parse",
        }, traceId))
        setLastJoinError(error)
        json = null
        
        // If we can't parse JSON and it's not HTML, show error
        if (!responseText.trim().startsWith("<!DOCTYPE")) {
          toast({
            title: "Invalid response",
            description: "The server returned an unexpected response. Please try again.",
            variant: "destructive",
          })
          return
        }
      }
      
      logInfo("join_response", withTrace({ 
        status: res.status, 
        ok: res.ok, 
        hasJson: !!json,
        jsonKeys: json ? Object.keys(json) : [],
        bodySnippet: json ? JSON.stringify(json).substring(0, 200) : null,
        participantId: json?.participantId || null,
        rsvpStatus: json?.waitlisted ? "waitlisted" : json?.ok ? "joined" : null,
      }, traceId))

      if (!res.ok) {
        const errorMessage = json?.error || json?.detail || "Join failed"
        logError("join_failed_client", withTrace({ 
          status: res.status, 
          error: errorMessage,
          errorMessage,
          stack: new Error().stack,
          responseText: responseText.substring(0, 500),
          stage: "api_response",
        }, traceId))
        setLastJoinError(errorMessage)
        
        if (res.status === 404) {
            toast({
            title: "Session not found",
            description: "Please check the invite link and try again.",
              variant: "destructive",
            })
        } else if (res.status === 409 && json?.code === "CAPACITY_EXCEEDED") {
            toast({
            title: "Session is full",
            description: json?.waitlistDisabled 
              ? "This session is full and waitlist is disabled. Please contact the host."
              : "This session is full. Please contact the host or try again later.",
              variant: "destructive",
            })
        } else if (res.status === 403) {
          const detailMessage = json?.detail || errorMessage
          toast({
            title: "Access denied",
            description: detailMessage || "You don't have permission to join this session. Please contact the host.",
            variant: "destructive",
          })
          // Log the full error for debugging
          log("error", "join_403_details", {
            traceId,
            error: errorMessage,
            detail: json?.detail,
            code: json?.code,
          })
        } else {
          toast({
            title: "Failed to join",
            description: errorMessage,
            variant: "destructive",
          })
        }
        return
      }

      // Success - handle 200 status code (even if json parsing failed or json.ok is missing)
      if (res.ok && res.status === 200) {
        // Check if response indicates success
        const isSuccess = json?.ok === true || (json && !json.error && json.participantId)
        
        if (!isSuccess) {
          log("warn", "join_200_but_not_success", { traceId, json })
          toast({
            title: "Join incomplete",
            description: json?.error || "Please refresh the page to see your status.",
            variant: "default",
          })
          return
        }
        
        log("info", "join_success_client", { 
          traceId, 
          participantId: json?.participantId, 
          waitlisted: json?.waitlisted,
          hasParticipantId: !!json?.participantId,
          fullJson: json,
        })
        
        if (!json?.participantId) {
          log("error", "join_success_but_no_participant_id", { traceId, json })
          toast({
            title: "Join incomplete",
            description: "Please refresh the page to see your status.",
            variant: "default",
          })
          return
        }
        
        // Update state - waitlisted defaults to false if not present
        const isWaitlisted = json.waitlisted === true
        setRsvpState(isWaitlisted ? "waitlisted" : "joined")
        
        // Calculate spots left
        const currentCount = participants.length
        const capacity = session.capacity
        const remaining = capacity ? Math.max(0, capacity - currentCount - 1) : null
        setSpotsLeft(remaining)
        
        // Show success message
        setShowSuccessMessage(true)
        
        // Show success toast
        toast({
          title: isWaitlisted ? "You're on the waitlist! ✅" : "You're in! 🎉",
          description: isWaitlisted 
            ? "We'll notify you if a spot opens up."
            : "Your name is now visible to the group.",
          variant: "default",
        })
        
        // Refresh the page after a short delay to show updated participant list
        setTimeout(() => {
          window.location.reload()
        }, 1500)
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setShowSuccessMessage(false)
        }, 3000)
      } else if (res.ok && res.status !== 200) {
        // Unexpected: res.ok but not 200
        log("warn", "join_unexpected_status", { 
          traceId, 
          status: res.status, 
          ok: res.ok, 
          json 
        })
      }
    } catch (error: any) {
      const errorMsg = error?.message || "Something went wrong. Please try again."
      logError("join_failed_client", withTrace({
        error: errorMsg,
        errorMessage: errorMsg,
        stack: error?.stack || new Error().stack,
        stage: "exception",
      }, traceId))
      setLastJoinError(errorMsg)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    }
  }

  // Handle RSVP click - only join action now
  const handleRSVPClick = () => {
    // If user has already joined, do nothing
    if (rsvpState === "joined") return

    // If user is authenticated, proceed directly to join (we'll use their auth info)
    if (isAuthenticated && authUser) {
      // Use authenticated user's info
      const userName = authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User"
      handleRSVPContinue(userName, null)
      return
    }

    // If user already has stored info (from previous RSVP), use it directly
    if (storedParticipantInfo && rsvpState !== "none") {
      handleRSVPContinue(storedParticipantInfo.name, storedParticipantInfo.phone)
      return
    }

    // First time RSVP - show login/guest dialog first
    // Capture current URL for redirect after login
    const returnTo = getCurrentReturnTo()
    setPostAuthRedirect(returnTo)
    setLoginDialogOpen(true)
  }

  // Handle continue as guest from login dialog
  const handleContinueAsGuest = (name: string) => {
    // Close login dialog and open RSVP dialog with name pre-filled
    setLoginDialogOpen(false)
    // Store the name temporarily and open RSVP dialog
    setStoredParticipantInfo({ name, phone: null })
    // Small delay to ensure login dialog closes before RSVP dialog opens
    setTimeout(() => {
    setRsvpDialogOpen(true)
    }, 100)
  }

  // Handle successful login - proceed to join
  useEffect(() => {
    if (isAuthenticated && authUser && loginDialogOpen) {
      // User just logged in, proceed to join directly
      setLoginDialogOpen(false)
      const userName = authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User"
      // Small delay to ensure dialog closes before proceeding
      setTimeout(() => {
        handleRSVPContinue(userName, null)
      }, 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authUser, loginDialogOpen])

  // Get current participant ID for payment
  const getCurrentParticipantId = async (): Promise<string | null> => {
    if (!publicCode || !guestKey) return null
    
    try {
      const result = await getParticipantRSVPStatus(publicCode, guestKey)
      if (result.ok && result.participantId) {
        return result.participantId
      }
    } catch (error) {
      console.error("[PublicSessionView] Error getting participant ID:", error)
    }
    return null
  }

  // Handle Make Payment - logged-in users skip dialog, guests see dialog
  const handleMakePaymentClick = async () => {
    const traceId = newTraceId("pay")
    
    logInfo("make_payment_clicked", withTrace({
      isAuthenticated,
      userId: authUser?.id || null,
      isGuest: !isAuthenticated,
      guestKey,
      sessionStarted: hasStarted,
      publicCode,
      sessionId: session.id,
    }, traceId))
    
    if (!hasStarted) {
      logWarn("make_payment_blocked", withTrace({
        reason: "session_not_started",
        stage: "validation",
      }, traceId))
      toast({
        title: "Payment not available",
        description: "Payment can only be made once the session starts.",
        variant: "destructive",
      })
      return
    }

    if (!publicCode) {
      logError("make_payment_blocked", withTrace({
        reason: "missing_publicCode",
        stage: "validation",
      }, traceId))
      toast({
        title: "Error",
        description: "Session is not published.",
        variant: "destructive",
      })
      return
    }

    // Logged-in user: skip dialog, find their participant and scroll directly
    if (isAuthenticated && authUser?.id) {
      // First try to find by user_id (after migration)
      let participant = myParticipant

      // If not found by user_id, try to get via guest key (fallback for existing participants)
      if (!participant) {
        const currentParticipantId = await getCurrentParticipantId()
        if (currentParticipantId) {
          participant = participants.find(p => p.id === currentParticipantId) || null
        }
      }

      if (!participant) {
        toast({
          title: "Join first",
          description: "Please join the session before making payment.",
          variant: "destructive",
        })
        return
      }

      // Set paying participant and scroll
      setPayingForParticipantId(participant.id)
      setPayingForParticipantName(participant.display_name)
      
      logInfo("payment_user_selected", withTrace({
        participantId: participant.id,
        displayName: participant.display_name,
        action: "auto_selected_logged_in",
      }, traceId))
      
      // Scroll to upload section
      setTimeout(() => {
        const paymentSection = document.querySelector('[data-payment-section]')
        if (paymentSection) {
          paymentSection.scrollIntoView({ behavior: "smooth", block: "start" })
          logInfo("scroll_to_upload_section", withTrace({
            targetId: paymentSection.id || "payment-section",
            action: "scroll",
          }, traceId))
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
          logWarn("scroll_to_upload_section", withTrace({
            targetId: "not_found",
            action: "fallback_scroll",
          }, traceId))
        }
      }, 50)
      return
    }

    // Guest user: show dialog to choose participant
    setIsLoadingUnpaid(true)
    try {
      const result = await getUnpaidParticipants(publicCode)
      if (result.ok) {
        setUnpaidParticipants(result.participants)
        
        logInfo("payment_user_picker_open", withTrace({
          unpaidUsersCount: result.participants.length,
        }, traceId))
        
        // If no unpaid participants, show message
        if (result.participants.length === 0) {
          toast({
            title: "Everyone's paid ✅",
            description: "All participants have already paid.",
            variant: "default",
          })
          setIsLoadingUnpaid(false)
          return
        }

        // Get current participant ID to set as default
        const currentParticipantId = await getCurrentParticipantId()
        if (currentParticipantId && result.participants.some(p => p.id === currentParticipantId)) {
          setSelectedParticipantId(currentParticipantId)
        } else {
          // Default to first unpaid participant
          setSelectedParticipantId(result.participants[0]?.id || null)
        }

        setMakePaymentDialogOpen(true)
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load participants.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingUnpaid(false)
    }
  }

  // Handle payment dialog continue - set paying for participant and scroll
  const handlePaymentContinue = () => {
    const traceId = newTraceId("pay")
    
    if (!selectedParticipantId) {
      logError("payment_user_selection_missing", withTrace({
        stage: "validation",
      }, traceId))
      toast({
        title: "Error",
        description: "Please select a participant to pay for.",
        variant: "destructive",
      })
      return
    }

    // Find participant name
    const selectedParticipant = unpaidParticipants.find(p => p.id === selectedParticipantId)
    if (selectedParticipant) {
      setPayingForParticipantId(selectedParticipantId)
      setPayingForParticipantName(selectedParticipant.display_name)
      
      logInfo("payment_user_selected", withTrace({
        participantId: selectedParticipantId,
        displayName: selectedParticipant.display_name,
      }, traceId))
    }

    setMakePaymentDialogOpen(false)
    
    // Scroll to payment section after dialog closes
    setTimeout(() => {
      const paymentSection = document.querySelector('[data-payment-section]')
      if (paymentSection) {
        paymentSection.scrollIntoView({ behavior: "smooth", block: "start" })
        logInfo("scroll_to_upload_section", withTrace({
          targetId: paymentSection.id || "payment-section",
          action: "scroll",
        }, traceId))
      } else {
        // Fallback: scroll to bottom where payment section should be
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
        logWarn("scroll_to_upload_section", withTrace({
          targetId: "not_found",
          action: "fallback_scroll",
        }, traceId))
      }
    }, 150)
  }

  const handleBackToAnalytics = () => {
    router.push(`/host/sessions/${session.id}/edit`)
  }

  return (
    <>
      <DebugPanel
        publicCode={publicCode}
        hostSlug={urlHostSlug}
        sessionId={session.id}
        userId={authUser?.id || null}
        guestKey={guestKey}
        lastTraceId={lastTraceId}
        lastJoinError={lastJoinError}
      />
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
        initialPreviewMode={false} // Public view is NOT preview mode - users should be able to interact
        hidePreviewBanner={true} // Hide preview banner for public view
        initialTitle={session.title}
        initialDate={formattedDate}
        initialLocation={session.location || null}
        initialCapacity={session.capacity || null}
        initialCourt={session.court_numbers || null}
        initialContainerOverlayEnabled={session.container_overlay_enabled ?? true}
        initialHostName={session.host_name || null}
        initialDescription={session.description || null}
        demoMode={false}
        demoParticipants={demoParticipants}
        onJoinClick={handleRSVPClick}
        rsvpState={rsvpState}
        waitlist={waitlist}
        hasStarted={hasStarted}
        publicCode={publicCode}
        hostSlug={urlHostSlug || session.host_slug || null}
        onMakePaymentClick={handleMakePaymentClick}
        payingForParticipantId={payingForParticipantId}
        payingForParticipantName={payingForParticipantName}
      />

      {/* Login/Guest Dialog - shown first */}
      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onContinueAsGuest={handleContinueAsGuest}
      />

      {/* RSVP Dialog - shown after choosing guest */}
      <GuestRSVPDialog
        open={rsvpDialogOpen}
        onOpenChange={setRsvpDialogOpen}
        onContinue={handleRSVPContinue}
        uiMode={uiMode}
        action="join"
        initialName={storedParticipantInfo?.name || ""}
      />

      {/* Make Payment Dialog */}
      <Dialog open={makePaymentDialogOpen} onOpenChange={setMakePaymentDialogOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-[425px]",
            uiMode === "dark" ? "bg-slate-900 border-white/10 text-white" : "bg-white border-black/10 text-black"
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn("text-2xl font-bold", uiMode === "dark" ? "text-white" : "text-black")}>
              Make payment
            </DialogTitle>
            <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              {unpaidParticipants.length === 0
                ? "Everyone's paid ✅"
                : "Select which participant to pay for"}
            </DialogDescription>
          </DialogHeader>
          {unpaidParticipants.length === 0 ? (
            <div className="py-4">
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <p className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  Everyone's paid ✅
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setMakePaymentDialogOpen(false)}
                  className="bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                </div>
                <div className="grid gap-2">
                  <Select
                    value={selectedParticipantId || ""}
                    onValueChange={setSelectedParticipantId}
                    disabled={isLoadingUnpaid}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full",
                        uiMode === "dark"
                          ? "bg-white/5 border-white/10 text-white"
                          : "bg-black/5 border-black/10 text-black"
                      )}
                    >
                      <SelectValue placeholder={isLoadingUnpaid ? "Loading..." : "Select participant"} />
                    </SelectTrigger>
                    <SelectContent
                      className={cn(
                        uiMode === "dark" ? "bg-slate-900 border-white/10" : "bg-white border-black/10"
                      )}
                    >
                      {unpaidParticipants.map((participant) => (
                        <SelectItem
                          key={participant.id}
                          value={participant.id}
                          className={cn(
                            uiMode === "dark" ? "text-white focus:bg-white/10" : "text-black focus:bg-black/10"
                          )}
                        >
                          {participant.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMakePaymentDialogOpen(false)}
                  className={cn(
                    uiMode === "dark"
                      ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                      : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
                  )}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePaymentContinue}
                  disabled={!selectedParticipantId || isLoadingUnpaid}
                  className="bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full"
                >
                  Continue
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Premium Success Message */}
      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
          >
            <div className="mx-auto max-w-md px-4 pb-4">
              <div className={cn(
                "rounded-2xl p-6 shadow-2xl border backdrop-blur-xl",
                uiMode === "dark"
                  ? "bg-gradient-to-br from-emerald-500/20 to-lime-500/20 border-emerald-400/30 text-white"
                  : "bg-gradient-to-br from-emerald-50 to-lime-50 border-emerald-300/50 text-black"
              )}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      uiMode === "dark"
                        ? "bg-emerald-500/30"
                        : "bg-emerald-500"
                    )}>
                      <Check className={cn(
                        "w-6 h-6",
                        uiMode === "dark" ? "text-white" : "text-white"
                      )} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">You're in ✅</h3>
                      <p className={cn(
                        "text-sm mt-1",
                        uiMode === "dark" ? "text-white/80" : "text-black/70"
                      )}>
                        See you on court. Your name is now visible to the group.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSuccessMessage(false)}
                    className={cn(
                      "p-1 rounded-full hover:bg-black/10 transition-colors",
                      uiMode === "dark" ? "text-white/60 hover:text-white" : "text-black/60 hover:text-black"
                    )}
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {spotsLeft !== null && (
                  <div className={cn(
                    "text-sm font-medium",
                    uiMode === "dark" ? "text-white/70" : "text-black/70"
                  )}>
                    Spots left: {spotsLeft}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function PublicSessionView({ session, participants, hostSlug: urlHostSlug }: PublicSessionViewProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PublicSessionViewContent session={session} participants={participants} hostSlug={urlHostSlug} />
    </Suspense>
  )
}

