"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ActionButton } from "@/components/ui/action-button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { logInfo, logError, logWarn, newTraceId, withTrace } from "@/lib/logger"
import { Ban, CheckCircle2, Clock, Calendar, DollarSign, Users, ChevronRight, Plus, X } from "lucide-react"
import { formatDistanceToNow, format, isPast, isFuture, parseISO } from "date-fns"
import { CopyInviteLinkButton } from "@/components/common/copy-invite-link-button"
import { SaveDraftGuardModal } from "@/components/host/save-draft-guard-modal"
import { PaymentsReviewView } from "@/components/host/payments-review-view"

interface HostSessionAnalyticsProps {
  sessionId: string
  uiMode: "dark" | "light"
}

interface AnalyticsData {
  attendance: {
    accepted: number
    capacity: number
    declined: number
    unanswered: number
  }
  payments: {
    collected: number
    total: number
    paidCount: number
    receivedCount: number // pending_review + approved
    pendingCount: number // pending_review only
    confirmedCount: number // approved only
  }
  acceptedList: Array<{ id: string; display_name: string; created_at: string }>
  declinedList: Array<{ id: string; display_name: string; created_at: string }>
  waitlistedList: Array<{ id: string; display_name: string; created_at: string }>
  viewedCount: number
  pricePerPerson: number | null
  sessionStatus: string
  startAt: string | null
  hostSlug: string | null
  publicCode: string | null
  waitlistEnabled: boolean
  allParticipants?: Array<{
    id: string
    display_name: string
    status: string
    pull_out_reason: string | null
    pull_out_seen: boolean
  }>
}

export function HostSessionAnalytics({ sessionId, uiMode }: HostSessionAnalyticsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [isUnpublishing, setIsUnpublishing] = useState(false)
  
  // Add/Remove participant state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [participantToRemove, setParticipantToRemove] = useState<{ id: string; name: string } | null>(null)
  const [newParticipantName, setNewParticipantName] = useState("")
  const [newParticipantPhone, setNewParticipantPhone] = useState("")
  const [newParticipantStatus, setNewParticipantStatus] = useState<"confirmed" | "waitlisted">("confirmed")
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  // Pull-out notification dialog state
  const [pullOutDialogOpen, setPullOutDialogOpen] = useState(false)
  const [pullOutParticipant, setPullOutParticipant] = useState<{
    id: string
    display_name: string
    pull_out_reason: string | null
  } | null>(null)

  // Check if we should show payments view
  const mode = searchParams.get("mode")
  const showPaymentsView = mode === "payments"

  const handleBackFromPayments = () => {
    router.push(`/host/sessions/${sessionId}/edit`)
  }
  
  // Quick settings local state (TODO: persist to DB)
  const [quickSettings, setQuickSettings] = useState({
    acceptNewJoins: true,
    requirePaymentProof: false,
    autoCloseWhenFull: true,
    showGuestListPublicly: true,
    waitlistEnabled: true, // Default to true
  })

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { getSessionAnalytics } = await import("@/app/host/sessions/[id]/actions")
        const result = await getSessionAnalytics(sessionId)
        if (result.ok) {
          setAnalytics({
            attendance: result.attendance,
            payments: result.payments,
            acceptedList: result.acceptedList,
            declinedList: result.declinedList,
            waitlistedList: result.waitlistedList,
            viewedCount: result.viewedCount,
            pricePerPerson: result.pricePerPerson,
            sessionStatus: result.sessionStatus,
            startAt: result.startAt,
            hostSlug: result.hostSlug,
            publicCode: result.publicCode,
            waitlistEnabled: result.waitlistEnabled,
            allParticipants: result.allParticipants || [],
          })
          
          // Initialize requirePaymentProof based on price
          if (result.pricePerPerson && result.pricePerPerson > 0) {
            setQuickSettings((prev) => ({ ...prev, requirePaymentProof: true }))
          }
          
          // Initialize waitlistEnabled from DB
          setQuickSettings((prev) => ({ ...prev, waitlistEnabled: result.waitlistEnabled }))
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [sessionId])

  // Refetch analytics after add/remove
  const refetchAnalytics = async () => {
    try {
      const { getSessionAnalytics } = await import("@/app/host/sessions/[id]/actions")
      const result = await getSessionAnalytics(sessionId)
      if (result.ok) {
        setAnalytics({
          attendance: result.attendance,
          payments: result.payments,
          acceptedList: result.acceptedList,
          declinedList: result.declinedList,
          waitlistedList: result.waitlistedList,
          viewedCount: result.viewedCount,
          pricePerPerson: result.pricePerPerson,
          sessionStatus: result.sessionStatus,
          startAt: result.startAt,
          hostSlug: result.hostSlug,
          publicCode: result.publicCode,
          waitlistEnabled: result.waitlistEnabled,
        })
      }
    } catch (error) {
      console.error("Failed to refetch analytics:", error)
    }
  }

  // Handle add participant
  const handleAddParticipant = async () => {
    const traceId = newTraceId("attendee_add")
    const trimmedName = newParticipantName.trim()
    
    if (!trimmedName || trimmedName.length === 0) {
      toast({
        title: "Name required",
        description: "Please enter a name for the attendee.",
        variant: "destructive",
      })
      return
    }

    setIsAdding(true)
    logInfo("attendee_add_submit", withTrace({
      sessionId,
      hasName: !!trimmedName,
      hasPhone: !!newParticipantPhone.trim(),
    }, traceId))

    try {
      const { addParticipant } = await import("@/app/host/sessions/[id]/actions")
      const result = await addParticipant(sessionId, trimmedName, newParticipantPhone.trim() || null, newParticipantStatus)
      
      if (!result.ok) {
        logError("attendee_add_failed", withTrace({
          error: result.error,
          sessionId,
        }, traceId))
        toast({
          title: "Failed to add attendee",
          description: result.error || "Please try again.",
          variant: "destructive",
        })
        return
      }

      logInfo("attendee_add_success", withTrace({
        participantId: result.participantId,
        sessionId,
      }, traceId))

      // Optimistic update
      if (analytics) {
        if (newParticipantStatus === "confirmed") {
          setAnalytics({
            ...analytics,
            attendance: {
              ...analytics.attendance,
              accepted: analytics.attendance.accepted + 1,
            },
            acceptedList: [
              ...analytics.acceptedList,
              {
                id: result.participantId,
                display_name: trimmedName,
                created_at: new Date().toISOString(),
              },
            ],
          })
        } else {
          // Waitlisted
          setAnalytics({
            ...analytics,
            waitlistedList: [
              ...analytics.waitlistedList,
              {
                id: result.participantId,
                display_name: trimmedName,
                created_at: new Date().toISOString(),
              },
            ],
          })
        }
      }

      toast({
        title: "Attendee added",
        description: `${trimmedName} has been added to the session.`,
      })

      // Reset form and close dialog
      setNewParticipantName("")
      setNewParticipantPhone("")
      setNewParticipantStatus("confirmed")
      setAddDialogOpen(false)

      // Refetch to ensure consistency
      await refetchAnalytics()
    } catch (error: any) {
      logError("attendee_add_failed", withTrace({
        error: error?.message || "Unknown error",
        sessionId,
      }, traceId))
      toast({
        title: "Error",
        description: error?.message || "Failed to add attendee. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  // Handle remove participant
  const handleRemoveParticipant = async () => {
    if (!participantToRemove) return

    const traceId = newTraceId("attendee_remove")
    setIsRemoving(true)
    logInfo("attendee_remove_confirm", withTrace({
      participantId: participantToRemove.id,
      sessionId,
    }, traceId))

    try {
      const { removeParticipant } = await import("@/app/host/sessions/[id]/actions")
      const result = await removeParticipant(sessionId, participantToRemove.id)
      
      if (!result.ok) {
        logError("attendee_remove_failed", withTrace({
          error: result.error,
          participantId: participantToRemove.id,
          sessionId,
        }, traceId))
        toast({
          title: "Failed to remove attendee",
          description: result.error || "Please try again.",
          variant: "destructive",
        })
        return
      }

      logInfo("attendee_remove_success", withTrace({
        participantId: participantToRemove.id,
        sessionId,
      }, traceId))

      // Optimistic update - check if participant was confirmed or waitlisted
      if (analytics) {
        const wasConfirmed = analytics.acceptedList.some(p => p.id === participantToRemove.id)
        setAnalytics({
          ...analytics,
          attendance: {
            ...analytics.attendance,
            accepted: wasConfirmed ? Math.max(0, analytics.attendance.accepted - 1) : analytics.attendance.accepted,
          },
          acceptedList: analytics.acceptedList.filter(
            (p) => p.id !== participantToRemove.id
          ),
          waitlistedList: analytics.waitlistedList.filter(
            (p) => p.id !== participantToRemove.id
          ),
        })
      }

      toast({
        title: "Attendee removed",
        description: `${participantToRemove.name} has been removed from the session.`,
      })

      setRemoveDialogOpen(false)
      setParticipantToRemove(null)

      // Refetch to ensure consistency
      await refetchAnalytics()
    } catch (error: any) {
      logError("attendee_remove_failed", withTrace({
        error: error?.message || "Unknown error",
        participantId: participantToRemove.id,
        sessionId,
      }, traceId))
      toast({
        title: "Error",
        description: error?.message || "Failed to remove attendee. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRemoving(false)
    }
  }

  // Open add dialog
  const handleOpenAddDialog = () => {
    const traceId = newTraceId("attendee_add")
    logInfo("attendee_add_open", withTrace({ sessionId }, traceId))
    setAddDialogOpen(true)
  }

  // Open remove dialog
  const handleOpenRemoveDialog = (participant: { id: string; display_name: string }) => {
    const traceId = newTraceId("attendee_remove")
    logInfo("attendee_remove_click", withTrace({
      participantId: participant.id,
      sessionId,
    }, traceId))
    setParticipantToRemove({ id: participant.id, name: participant.display_name })
    setRemoveDialogOpen(true)
  }

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  // Format time urgency
  const getTimeUrgency = (startAt: string | null): string => {
    if (!startAt) return "Date TBD"
    try {
      const startDate = parseISO(startAt)
      if (isPast(startDate)) {
        return "Ended"
      }
      if (isFuture(startDate)) {
        const distance = formatDistanceToNow(startDate, { addSuffix: true })
        if (distance.includes("hour") || distance.includes("minute")) {
          return `Starts ${distance}`
        }
        if (distance.includes("day")) {
          const days = Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (days === 1) return "Tomorrow"
          if (days <= 7) return `In ${days} days`
        }
        return format(startDate, "MMM d, h:mm a")
      }
      return "Now"
    } catch {
      return "Date TBD"
    }
  }

  // Get status badge label and color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return { label: "Live", color: "bg-red-500/20 text-red-400 border-red-500/30" }
      case "draft":
        return { label: "Draft", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" }
      case "closed":
        return { label: "Closed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" }
      default:
        return { label: status, color: "bg-gray-500/20 text-gray-400 border-gray-500/30" }
    }
  }

  // Handle unpublish
  const handleUnpublish = async () => {
    setIsUnpublishing(true)
    try {
      const { unpublishSession } = await import("@/app/host/sessions/[id]/actions")
      const result = await unpublishSession(sessionId)
      
      if (!result.ok) {
        toast({
          title: "Removal failed",
          description: result.error || "Failed to remove session.",
          variant: "destructive",
        })
        return
      }
      
      toast({
        title: "Invite removed",
        description: "Invite and all participant data have been permanently deleted.",
      })
      
      setUnpublishDialogOpen(false)
      window.location.reload()
    } catch (error: any) {
      toast({
        title: "Unpublish failed",
        description: error?.message || "Failed to unpublish session.",
        variant: "destructive",
      })
    } finally {
      setIsUnpublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-lime-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={cn("text-sm", uiMode === "dark" ? "text-white/60" : "text-black/60")}>Loading session control...</p>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className={cn("text-sm", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
          Failed to load session
        </p>
      </div>
    )
  }

  const statusBadge = getStatusBadge(analytics.sessionStatus)
  const spotsLeft = Math.max(0, analytics.attendance.capacity - analytics.attendance.accepted)

  // Show payments view if mode=payments
  if (showPaymentsView) {
    return <PaymentsReviewView sessionId={sessionId} uiMode={uiMode} onBack={handleBackFromPayments} />
  }

  return (
    <div className={cn("min-h-screen", uiMode === "dark" ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-white")}>
      <div className="space-y-4 p-4 pb-[200px]">
        {/* Page Title */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <h1 className={cn("text-2xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
            Session control
          </h1>
          <CopyInviteLinkButton
            sessionId={sessionId}
            variant="outline"
            size="sm"
            className={cn(
              "shrink-0",
              uiMode === "dark"
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-black/20 bg-black/5 text-black hover:bg-black/10"
            )}
          />
        </div>

        {/* SECTION 1: Session Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className={cn("p-4", glassCard)}>
            <div className="space-y-3">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge className={cn("px-3 py-1 text-xs font-medium border", statusBadge.color)}>
                  {statusBadge.label}
                </Badge>
              </div>

              {/* Spots Filled */}
              <div className="flex items-center justify-between">
                <span className={cn("text-sm", uiMode === "dark" ? "text-white/70" : "text-black/70")}>
                  Spots filled
                </span>
                <span className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  {analytics.attendance.accepted} / {analytics.attendance.capacity || 0} filled
                </span>
              </div>

              {/* Payment State */}
              <div className="flex items-center justify-between">
                <span className={cn("text-sm", uiMode === "dark" ? "text-white/70" : "text-black/70")}>
                  Payment state
                </span>
                <span className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  {analytics.payments.total === 0 || !analytics.pricePerPerson
                    ? "No payments required"
                    : analytics.payments.paidCount === 0
                    ? "No payments yet"
                    : analytics.payments.paidCount < analytics.attendance.accepted
                    ? `${analytics.attendance.accepted - analytics.payments.paidCount} pending verification`
                    : "All payments confirmed"}
                </span>
              </div>

              {/* Time Urgency */}
              <div className="flex items-center justify-between">
                <span className={cn("text-sm", uiMode === "dark" ? "text-white/70" : "text-black/70")}>
                  Time
                </span>
                <span className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  {getTimeUrgency(analytics.startAt)}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* SECTION 2: Attendees */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className={cn("p-4", glassCard)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn("text-sm font-semibold", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                Attendees
              </h3>
              <div className="flex items-center gap-2">
              <span className={cn("text-xs", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                {analytics.attendance.accepted} going · {spotsLeft} spots left
              </span>
                <ActionButton
                  onClick={handleOpenAddDialog}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-full",
                    uiMode === "dark"
                      ? "text-white/70 hover:text-white hover:bg-white/10"
                      : "text-black/70 hover:text-black hover:bg-black/10"
                  )}
                >
                  <Plus className="h-4 w-4" />
                </ActionButton>
              </div>
            </div>
            
            {(analytics.acceptedList.length > 0 || analytics.waitlistedList.length > 0) ? (
              <div className="space-y-3">
                {/* Confirmed participants */}
                {analytics.acceptedList.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn("text-xs font-medium", uiMode === "dark" ? "text-white/70" : "text-black/70")}>
                      Confirmed ({analytics.acceptedList.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                      {analytics.acceptedList.map((participant) => (
                        <div
                          key={participant.id}
                          className={cn(
                            "relative flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium pr-8",
                            uiMode === "dark"
                              ? "bg-white/10 text-white border border-white/20"
                              : "bg-black/10 text-black border border-black/20"
                          )}
                        >
                          {participant.display_name}
                          <div className="absolute -top-1 -right-1 flex gap-1">
                            <button
                              onClick={() => handleOpenRemoveDialog(participant)}
                              className={cn(
                                "h-5 w-5 rounded-full flex items-center justify-center transition-colors",
                                "bg-red-500 hover:bg-red-600 text-white",
                                "mt-2"
                              )}
                              aria-label={`Remove ${participant.display_name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Waitlisted participants */}
                {analytics.waitlistedList.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn("text-xs font-medium", uiMode === "dark" ? "text-white/70" : "text-black/70")}>
                      Waitlist ({analytics.waitlistedList.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                      {analytics.waitlistedList.map((participant) => (
                        <div
                          key={participant.id}
                          className={cn(
                            "relative flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium pr-8",
                            uiMode === "dark"
                              ? "bg-amber-500/10 text-amber-200 border border-amber-500/30"
                              : "bg-amber-500/10 text-amber-700 border border-amber-500/30"
                          )}
                        >
                          {participant.display_name}
                          <div className="absolute -top-1 -right-1 flex gap-1">
                            <button
                              onClick={() => handleOpenRemoveDialog(participant)}
                              className={cn(
                                "h-5 w-5 rounded-full flex items-center justify-center transition-colors",
                                "bg-red-500 hover:bg-red-600 text-white",
                                "mt-2"
                              )}
                              aria-label={`Remove ${participant.display_name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className={cn("text-sm text-center py-4", uiMode === "dark" ? "text-white/40" : "text-black/40")}>
                No one has joined yet.
              </p>
            )}
          </Card>
        </motion.div>

        {/* SECTION 3: Payments (Condensed) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className={cn("p-4", glassCard)}>
            <div className="space-y-3">
              <div>
                <h3 className={cn("text-sm font-medium mb-2", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                  Payments
                </h3>
                {/* Dynamic payment status display */}
                {analytics.attendance.accepted === 0 ? (
                  <div className="space-y-1">
                    <p className={cn("text-xs", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                      No attendees yet
                    </p>
                    <p className={cn("text-xs", uiMode === "dark" ? "text-white/40" : "text-black/40")}>
                      Payments will appear when someone joins.
                    </p>
                  </div>
                ) : analytics.payments.receivedCount === 0 ? (
                  <p className={cn("text-base font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
                    <span className={cn(uiMode === "dark" ? "text-white" : "text-black")}>0 / {analytics.attendance.accepted}</span>
                    <span className={cn("ml-1", uiMode === "dark" ? "text-white/80" : "text-black/80")}>payments received</span>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Primary status line - emphasized */}
                    <p className={cn("text-base font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
                      <span className={cn(uiMode === "dark" ? "text-white" : "text-black")}>
                        {analytics.payments.receivedCount} / {analytics.attendance.accepted}
                      </span>
                      <span className={cn("ml-1", uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                        payment{analytics.payments.receivedCount === 1 ? "" : "s"} received
                      </span>
                    </p>
                    {/* Breakdown section */}
                    <div className={cn("pt-2 border-t", uiMode === "dark" ? "border-white/10" : "border-black/10")}>
                      <p className={cn("text-xs uppercase tracking-wide mb-2", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                        Payments status
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={cn("w-3.5 h-3.5 flex-shrink-0", uiMode === "dark" ? "text-emerald-400/80" : "text-emerald-600")} />
                          <p className={cn("text-sm", uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                            <span className={cn(uiMode === "dark" ? "text-white" : "text-black")}>{analytics.payments.confirmedCount}</span>
                            <span className="ml-1">confirmed</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className={cn("w-3.5 h-3.5 flex-shrink-0", uiMode === "dark" ? "text-amber-400/80" : "text-amber-600")} />
                          <p className={cn("text-sm", uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                            <span className={cn(uiMode === "dark" ? "text-white" : "text-black")}>{analytics.payments.pendingCount}</span>
                            <span className="ml-1">pending review</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={() => router.push(`/host/sessions/${sessionId}/edit?mode=payments`)}
                variant="outline"
                className={cn(
                  "w-full rounded-full h-11 mt-1",
                  uiMode === "dark"
                    ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                    : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
                )}
              >
                View payment uploads
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* SECTION 4: Quick Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className={cn("p-4", glassCard)}>
            <h3 className={cn("text-sm font-semibold mb-4", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
              Quick settings
            </h3>
            <div className="space-y-4">
              {/* Accept new joins */}
              <div className="flex items-center justify-between">
                <Label htmlFor="accept-new" className={cn("text-sm", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                  Accept new joins
                </Label>
                <Switch
                  id="accept-new"
                  checked={quickSettings.acceptNewJoins}
                  onCheckedChange={(checked) =>
                    setQuickSettings((prev) => ({ ...prev, acceptNewJoins: checked }))
                  }
                />
              </div>

              {/* Require payment proof */}
              <div className="flex items-center justify-between">
                <Label htmlFor="require-payment" className={cn("text-sm", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                  Require payment proof
                </Label>
                <Switch
                  id="require-payment"
                  checked={quickSettings.requirePaymentProof}
                  onCheckedChange={(checked) =>
                    setQuickSettings((prev) => ({ ...prev, requirePaymentProof: checked }))
                  }
                />
              </div>

              {/* Auto-close when full */}
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-close" className={cn("text-sm", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                  Auto-close when full
                </Label>
                <Switch
                  id="auto-close"
                  checked={quickSettings.autoCloseWhenFull}
                  onCheckedChange={(checked) =>
                    setQuickSettings((prev) => ({ ...prev, autoCloseWhenFull: checked }))
                  }
                />
              </div>

              {/* Show guest list publicly */}
              <div className="flex items-center justify-between">
                <Label htmlFor="show-guests" className={cn("text-sm", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                  Show guest list publicly
                </Label>
                <Switch
                  id="show-guests"
                  checked={quickSettings.showGuestListPublicly}
                  onCheckedChange={(checked) =>
                    setQuickSettings((prev) => ({ ...prev, showGuestListPublicly: checked }))
                  }
                />
              </div>

              {/* Enable waiting list */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Label htmlFor="waitlist" className={cn("text-sm", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                    Enable waiting list
                  </Label>
                  <p className={cn("text-xs mt-0.5", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                    Allow users to join waitlist when session is full
                  </p>
                </div>
                <Switch
                  id="waitlist"
                  checked={quickSettings.waitlistEnabled}
                  onCheckedChange={async (checked) => {
                    setQuickSettings((prev) => ({ ...prev, waitlistEnabled: checked }))
                    try {
                      const { updateSessionWaitlistEnabled } = await import("@/app/host/sessions/[id]/actions")
                      await updateSessionWaitlistEnabled(sessionId, checked)
                      router.refresh()
                    } catch (error) {
                      console.error("[HostSessionAnalytics] Error updating waitlist:", error)
                      // Revert on error
                      setQuickSettings((prev) => ({ ...prev, waitlistEnabled: !checked }))
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Unpublish Confirmation Dialog */}
      <Dialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <DialogContent
          className={cn(
            "w-[calc(100vw-24px)] max-w-[520px] max-h-[calc(100vh-24px)] rounded-2xl",
            uiMode === "dark"
              ? "bg-slate-900 text-white border border-white/10"
              : "bg-white text-black border border-black/10"
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn("text-xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
              Remove this invite?
            </DialogTitle>
            <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              This will permanently delete the invite and all participant data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-4">
            <Button
              onClick={() => setUnpublishDialogOpen(false)}
              variant="outline"
              disabled={isUnpublishing}
              className={cn(
                "flex-1 rounded-full h-12",
                uiMode === "dark"
                  ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                  : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnpublish}
              disabled={isUnpublishing}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full h-12 shadow-lg shadow-red-500/20"
            >
              {isUnpublishing ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Draft Guard Modal */}
      <SaveDraftGuardModal sessionId={sessionId} uiMode={uiMode} sessionStatus={analytics?.sessionStatus} />

      {/* Add Attendee Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent
          className={cn(
            "w-[calc(100vw-24px)] max-w-[520px] max-h-[calc(100vh-24px)] rounded-2xl",
            uiMode === "dark"
              ? "bg-slate-900 text-white border border-white/10"
              : "bg-white text-black border border-black/10"
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn("text-xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
              Add attendee
            </DialogTitle>
            <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              Manually add an attendee to this session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="attendee-name" className={cn(uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="attendee-name"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Enter attendee name"
                className={cn(
                  uiMode === "dark"
                    ? "bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    : "bg-black/5 border-black/20 text-black placeholder:text-black/40"
                )}
                disabled={isAdding}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendee-phone" className={cn(uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                Phone (optional)
              </Label>
              <Input
                id="attendee-phone"
                value={newParticipantPhone}
                onChange={(e) => setNewParticipantPhone(e.target.value)}
                placeholder="Enter phone number"
                type="tel"
                className={cn(
                  uiMode === "dark"
                    ? "bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    : "bg-black/5 border-black/20 text-black placeholder:text-black/40"
                )}
                disabled={isAdding}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                Status
              </Label>
              <Select
                value={newParticipantStatus}
                onValueChange={(value: "confirmed" | "waitlisted") => setNewParticipantStatus(value)}
                disabled={isAdding}
              >
                <SelectTrigger
                  className={cn(
                    "w-full",
                    uiMode === "dark"
                      ? "bg-white/5 border-white/20 text-white"
                      : "bg-black/5 border-black/20 text-black"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className={cn(
                    uiMode === "dark"
                      ? "bg-slate-900 border-white/20 text-white"
                      : "bg-white border-black/20 text-black"
                  )}
                >
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="waitlisted">Waitlist</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-3 mt-6">
            <ActionButton
              onClick={() => {
                setAddDialogOpen(false)
                setNewParticipantName("")
                setNewParticipantPhone("")
                setNewParticipantStatus("confirmed")
              }}
              variant="outline"
              disabled={isAdding}
              className={cn(
                "flex-1 rounded-full h-12",
                uiMode === "dark"
                  ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                  : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
              )}
            >
              Cancel
            </ActionButton>
            <ActionButton
              onClick={handleAddParticipant}
              disabled={isAdding || !newParticipantName.trim()}
              showSpinner={!isAdding}
              className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full h-12 shadow-lg"
            >
              {isAdding ? "Adding..." : "Add attendee"}
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Attendee Alert Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent
          className={cn(
            "w-[calc(100vw-24px)] max-w-[520px] rounded-2xl",
            uiMode === "dark"
              ? "bg-slate-900 text-white border border-white/10"
              : "bg-white text-black border border-black/10"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className={cn("text-xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
              Remove attendee?
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              This will remove {participantToRemove?.name} from the attendee list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel
              onClick={() => {
                setRemoveDialogOpen(false)
                setParticipantToRemove(null)
              }}
              disabled={isRemoving}
              className={cn(
                "flex-1 rounded-full h-12",
                uiMode === "dark"
                  ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                  : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveParticipant}
              disabled={isRemoving}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full h-12 shadow-lg shadow-red-500/20"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
