"use client"

import { useState, useEffect, useRef, useMemo, Suspense, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
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
import { ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOrCreateGuestKey, getGuestKey } from "@/lib/guest-key"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Participant {
  id: string
  display_name: string
  user_id?: string | null // Will be added via migration
  status?: "invited" | "confirmed" | "cancelled" | "waitlisted" // Participant status
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

// Compute session capacity state
function computeSessionCapacityState(
  session: Session,
  participants: Participant[]
): { capacity: number | null; joinedCount: number; isFull: boolean } {
  const capacity = session.capacity
  // Count only confirmed participants (exclude waitlisted, cancelled, etc.)
  const joinedCount = participants.filter(
    (p: any) => p.status === "confirmed"
  ).length
  
  // Treat capacity null/0 as not full (unlimited or not set)
  const isFull = capacity !== null && capacity > 0 && joinedCount >= capacity
  
  return { capacity, joinedCount, isFull }
}

function PublicSessionViewContent({ session, participants: initialParticipants, waitlist: initialWaitlist = [], hostSlug: urlHostSlug }: PublicSessionViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { toast } = useToast()
  
  // Debug instrumentation: Log route changes and beforeunload events
  useEffect(() => {
    const onBeforeUnload = () => {
      if (debugEnabled()) {
        console.log("[debug] beforeunload fired")
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])
  
  useEffect(() => {
    if (debugEnabled()) {
      console.log("[debug] route changed", { pathname, search: searchParams?.toString() })
    }
  }, [pathname, searchParams])
  const { isAuthenticated, user, authUser } = useAuth()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false)
  const [uiMode, setUiMode] = useState<"dark" | "light">("dark")
  const [rsvpState, setRsvpState] = useState<"none" | "joined" | "waitlisted">("none")
  const [isLoadingRSVP, setIsLoadingRSVP] = useState(true)
  const [storedParticipantInfo, setStoredParticipantInfo] = useState<{ name: string; phone: string | null } | null>(null)
  const [guestKey, setGuestKey] = useState<string | null>(null)
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null)
  
  // Local state for participants (can be updated optimistically)
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [waitlist, setWaitlist] = useState<Participant[]>(initialWaitlist)

  // Debug: Log waitlist data
  useEffect(() => {
    console.log("[waitlist] state updated", {
      initialWaitlistCount: initialWaitlist.length,
      waitlistCount: waitlist.length,
      waitlistItems: waitlist.map(p => ({ id: p.id, name: p.display_name, status: p.status }))
    })
  }, [waitlist, initialWaitlist])
  
  // Use refs to track previous values and only update when content actually changes
  // This prevents infinite loops when props are recreated with same content
  const prevParticipantsKeyRef = useRef<string>("")
  const prevWaitlistKeyRef = useRef<string>("")
  
  // Sync with props when they change (e.g., from server revalidation)
  // Only update if the actual content changed (compare by JSON stringified IDs)
  useEffect(() => {
    const participantsKey = JSON.stringify(initialParticipants.map(p => p.id).sort())
    const waitlistKey = JSON.stringify(initialWaitlist.map(p => p.id).sort())
    
    if (participantsKey !== prevParticipantsKeyRef.current) {
      setParticipants(initialParticipants)
      prevParticipantsKeyRef.current = participantsKey
    }
    
    if (waitlistKey !== prevWaitlistKeyRef.current) {
      setWaitlist(initialWaitlist)
      prevWaitlistKeyRef.current = waitlistKey
    }
  }, [initialParticipants, initialWaitlist])
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

  // Compute capacity state
  const capacityState = useMemo(() => {
    const state = computeSessionCapacityState(session, participants)
    console.log("[capacity] computed state", {
      capacity: state.capacity,
      joinedCount: state.joinedCount,
      isFull: state.isFull,
      participantsCount: participants.length,
      participantsWithStatus: participants.map(p => ({ id: p.id, status: (p as any).status }))
    })
    return state
  }, [session, participants])

  // Convert participants to demo format for SessionInvite
  const demoParticipants = participants.map((p) => ({
    name: p.display_name,
    avatar: null,
  }))

  // Sync UI mode from SessionInvite if needed (it manages its own state)
  // We'll keep this component's state for the dialog styling

  const handleRSVPContinue = async (name: string, phone: string | null) => {
    const traceId = newTraceId("join")
    setLastTraceId(traceId)
    setLastJoinError(null)
    
    try {
      if (!publicCode) {
        const error = "Session is not published."
        logError("join_failed_client", withTrace({ 
          error,
          stage: "validation",
          reason: "missing_publicCode",
        }, traceId))
        setLastJoinError(error)
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        })
        return
      }

      // Store participant info in localStorage
      const storageKey = `reserv_rsvp_${publicCode}`
      localStorage.setItem(storageKey, JSON.stringify({ name, phone }))
      setStoredParticipantInfo({ name, phone })

      if (!guestKey) {
        const error = "Unable to identify device. Please refresh the page."
        logError("join_failed_client", withTrace({ 
          error,
          stage: "validation",
          reason: "missing_guestKey",
        }, traceId))
        setLastJoinError(error)
        toast({
          title: "Error",
          description: error,
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

      // Use server action for type-safe join
      const result = await joinSession(publicCode, name, guestKey, phone || null, traceId)
      
      logInfo("join_response", withTrace({ 
        ok: result.ok,
        participantId: result.ok ? result.participantId : null,
        waitlisted: result.ok ? result.waitlisted : null,
        alreadyJoined: result.ok ? result.alreadyJoined : null,
        joinedAs: result.ok ? result.joinedAs : null,
        error: result.ok ? null : result.error,
        code: result.ok ? null : result.code,
      }, traceId))

      if (!result.ok) {
        const errorMessage = result.error || "Join failed"
        logError("join_failed_client", withTrace({ 
          error: errorMessage,
          code: result.code,
          stack: new Error().stack,
          stage: "server_action_response",
        }, traceId))
        setLastJoinError(errorMessage)
        
        if (result.code === "CAPACITY_EXCEEDED") {
          toast({
            title: "Session is full",
            description: "This session is full. Please contact the host or try again later.",
            variant: "destructive",
          })
        } else if (errorMessage.includes("not found") || errorMessage.includes("Session not found")) {
          toast({
            title: "Session not found",
            description: "Please check the invite link and try again.",
            variant: "destructive",
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

      // Success
      logInfo("join_success_client", { 
        traceId, 
        participantId: result.participantId, 
        waitlisted: result.waitlisted,
        alreadyJoined: result.alreadyJoined,
        hasParticipantId: !!result.participantId,
      })
      
      if (!result.participantId) {
        logWarn("join_success_but_no_participant_id", withTrace({ traceId }, traceId))
        toast({
          title: "Join incomplete",
          description: "Please refresh the page to see your status.",
          variant: "default",
        })
        return
      }
      
      // Update state - waitlisted defaults to false if not present
      const isWaitlisted = result.waitlisted === true
      const isAlreadyJoined = result.alreadyJoined === true
      const joinedAs = result.joinedAs || (isWaitlisted ? "waitlist" : "joined")
      
      console.log("[waitlist] Server action response parsed", {
        result,
        isWaitlisted,
        isAlreadyJoined,
        joinedAs,
        resultWaitlisted: result.waitlisted,
        resultJoinedAs: result.joinedAs
      })
      
      setRsvpState(isWaitlisted ? "waitlisted" : "joined")
      
      // Optimistically update participants list (NO PAGE REFRESH)
      if (result.participantId && !isAlreadyJoined) {
        // Add new participant to the appropriate list
        const newParticipant: Participant = {
          id: result.participantId,
          display_name: name, // Use the name from the join request
          status: joinedAs === "waitlist" ? "waitlisted" : "confirmed",
        }
        
        if (joinedAs === "waitlist") {
          console.log("[waitlist] optimistically adding to waitlist", { participant: newParticipant, joinedAs })
          setWaitlist((prev) => {
            const updated = [...prev, newParticipant]
            console.log("[waitlist] waitlist state updated", { prevCount: prev.length, newCount: updated.length, items: updated })
            return updated
          })
        } else {
          setParticipants((prev) => [...prev, newParticipant])
        }
      }
      
      // Calculate spots left (use updated participants count)
      const updatedParticipants = joinedAs === "waitlist" ? participants : (result.participantId && !isAlreadyJoined ? [...participants, { id: result.participantId, display_name: name, status: "confirmed" as const }] : participants)
      const currentCount = updatedParticipants.filter((p: any) => p.status === "confirmed").length
      const capacity = session.capacity
      const remaining = capacity ? Math.max(0, capacity - currentCount) : null
      setSpotsLeft(remaining)
      
      // Refetch participants from client (without router.refresh or page reload)
      // This ensures we have the latest data without a full page refresh
      const refetchParticipants = async () => {
        try {
          console.log("[waitlist] refetching participants", { sessionId: session.id, traceId })
          const supabase = createClient()
          const { data: allParticipants, error } = await supabase
            .from("participants")
            .select("id, display_name, status")
            .eq("session_id", session.id)
            .in("status", ["confirmed", "waitlisted"])
            .order("created_at", { ascending: true })
          
          console.log("[waitlist] refetch result", {
            error: error?.message,
            allParticipantsCount: allParticipants?.length || 0,
            allParticipants: allParticipants?.map(p => ({ id: p.id, name: p.display_name, status: p.status }))
          })
          
          if (!error && allParticipants) {
            const confirmed = allParticipants.filter((p: any) => p.status === "confirmed")
            const waitlisted = allParticipants.filter((p: any) => p.status === "waitlisted")
            
            console.log("[waitlist] after filtering", {
              confirmedCount: confirmed.length,
              waitlistedCount: waitlisted.length,
              confirmed: confirmed.map(p => ({ id: p.id, name: p.display_name, status: p.status })),
              waitlisted: waitlisted.map(p => ({ id: p.id, name: p.display_name, status: p.status }))
            })
            
            setParticipants(confirmed)
            setWaitlist(waitlisted)
            
            // Recalculate spots left with fresh data
            const freshCount = confirmed.length
            const freshRemaining = capacity ? Math.max(0, capacity - freshCount) : null
            setSpotsLeft(freshRemaining)
            logInfo("join_refetch_success", withTrace({ confirmedCount: confirmed.length, waitlistCount: waitlisted.length }, traceId))
          } else {
            console.error("[waitlist] refetch error", { error: error?.message, errorCode: (error as any)?.code })
            logError("join_refetch_failed", withTrace({ error: error?.message }, traceId))
          }
        } catch (error: any) {
          console.error("[waitlist] refetch exception", { error: error.message, stack: error.stack })
          logError("join_refetch_exception", withTrace({ error: error.message }, traceId))
        }
      }
      
      // Refetch after a short delay to get server truth (NO PAGE RELOAD)
      setTimeout(() => {
        refetchParticipants()
      }, 500)
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
    // Close login dialog and open GuestRSVPDialog directly
    // GuestRSVPDialog will handle name + phone collection and localStorage
    setLoginDialogOpen(false)
    
    // If name was provided (shouldn't happen now, but keep for compatibility),
    // pre-fill it. Otherwise GuestRSVPDialog will read from localStorage
    if (name) {
      setStoredParticipantInfo({ name, phone: null })
    }
    
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
      logError("make_payment_failed", withTrace({
        error: error?.message || "Failed to load participants",
        stack: error?.stack,
        stage: "get_unpaid_participants",
      }, traceId))
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
        isFull={capacityState.isFull}
        joinedCount={capacityState.joinedCount}
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

