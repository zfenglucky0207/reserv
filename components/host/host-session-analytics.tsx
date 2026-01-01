"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Ban, CheckCircle2, Clock, Calendar, DollarSign, Users, ChevronRight } from "lucide-react"
import { formatDistanceToNow, format, isPast, isFuture, parseISO } from "date-fns"
import { CopyInviteLinkButton } from "@/components/common/copy-invite-link-button"
import { SaveDraftGuardModal } from "@/components/host/save-draft-guard-modal"

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
  }
  acceptedList: Array<{ id: string; display_name: string; created_at: string }>
  declinedList: Array<{ id: string; display_name: string; created_at: string }>
  viewedCount: number
  pricePerPerson: number | null
  sessionStatus: string
  startAt: string | null
  hostSlug: string | null
  publicCode: string | null
}

export function HostSessionAnalytics({ sessionId, uiMode }: HostSessionAnalyticsProps) {
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [isUnpublishing, setIsUnpublishing] = useState(false)
  
  // Quick settings local state (TODO: persist to DB)
  const [quickSettings, setQuickSettings] = useState({
    acceptNewJoins: true,
    requirePaymentProof: false,
    autoCloseWhenFull: true,
    showGuestListPublicly: true,
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
            viewedCount: result.viewedCount,
            pricePerPerson: result.pricePerPerson,
            sessionStatus: result.sessionStatus,
            startAt: result.startAt,
            hostSlug: result.hostSlug,
            publicCode: result.publicCode,
          })
          
          // Initialize requirePaymentProof based on price
          if (result.pricePerPerson && result.pricePerPerson > 0) {
            setQuickSettings((prev) => ({ ...prev, requirePaymentProof: true }))
          }
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [sessionId])

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

  return (
    <div className={cn("min-h-screen", uiMode === "dark" ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-white")}>
      <div className="space-y-4 p-4 pb-24">
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
              <span className={cn("text-xs", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                {analytics.attendance.accepted} going · {spotsLeft} spots left
              </span>
            </div>
            
            {analytics.acceptedList.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {analytics.acceptedList.map((participant) => (
                  <div
                    key={participant.id}
                    className={cn(
                      "flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium",
                      uiMode === "dark"
                        ? "bg-white/10 text-white border border-white/20"
                        : "bg-black/10 text-black border border-black/20"
                    )}
                  >
                    {participant.display_name}
                  </div>
                ))}
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className={cn("text-sm font-semibold mb-1", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
                  Payments
                </h3>
                <p className={cn("text-xs", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                  {analytics.payments.total === 0 || !analytics.pricePerPerson
                    ? "No payments yet"
                    : `RM ${analytics.payments.collected.toFixed(0)} collected · ${analytics.payments.paidCount < analytics.attendance.accepted ? analytics.attendance.accepted - analytics.payments.paidCount : 0} pending`}
                </p>
              </div>
              {analytics.payments.total > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "rounded-full",
                    uiMode === "dark"
                      ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                      : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
                  )}
                >
                  Review
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
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

              {/* Close session button */}
              <Button
                onClick={() => setUnpublishDialogOpen(true)}
                variant="outline"
                className={cn(
                  "w-full mt-4 rounded-full h-11",
                  uiMode === "dark"
                    ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400"
                    : "border-red-300 bg-red-50 hover:bg-red-100 text-red-600"
                )}
              >
                <Ban className="w-4 h-4 mr-2" />
                Close session
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Unpublish Confirmation Dialog */}
      <Dialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <DialogContent
          className={cn(
            "max-w-md rounded-2xl",
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
    </div>
  )
}
