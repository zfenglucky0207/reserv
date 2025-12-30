"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { MapPin, Users, Calendar, Check, Ban, Radio, Sparkles, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import { useToast } from "@/hooks/use-toast"

interface LiveSession {
  id: string
  title: string
  start_at: string
  location: string | null
  capacity: number | null
  cover_url: string | null
  sport: "badminton" | "pickleball" | "volleyball" | "other"
  host_slug: string | null
  public_code: string | null
}

interface LiveInviteGuardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  liveSessions: LiveSession[]
  uiMode: "dark" | "light"
  onContinueCreating: () => void
  userId: string | null
  onSessionsUpdate?: (updatedSessions: LiveSession[]) => void // Callback to update parent state
  onUnpublishSuccess?: () => void // Callback to trigger parent refetch after unpublish
  count?: number // Server count (optional, for empty state detection)
  isLoading?: boolean // Loading state (optional)
  error?: string | null // Error state (optional)
  onRetry?: () => void // Retry handler for error state (optional)
}

const SPORT_LABELS: Record<string, string> = {
  badminton: "Badminton",
  pickleball: "Pickleball",
  volleyball: "Volleyball",
  other: "Futsal",
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const dayName = dayNames[date.getDay()]
    const monthName = monthNames[date.getMonth()]
    const day = date.getDate()
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? "PM" : "AM"
    const hour12 = hours % 12 || 12
    const minutesStr = String(minutes).padStart(2, "0")

    return `${dayName}, ${monthName} ${day} • ${hour12}:${minutesStr} ${ampm}`
  } catch {
    return dateString
  }
}

// Empty state component
function NoLiveInvitesEmptyState({
  onCreate,
  onClose,
  uiMode,
}: {
  onCreate: () => void
  onClose: () => void
  uiMode: "dark" | "light"
}) {
  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  return (
    <div className="px-4 pb-4">
      <div className={cn(
        "mt-2 rounded-2xl border p-4",
        glassCard
      )}>
        <div className={cn(
          "mx-auto flex h-11 w-11 items-center justify-center rounded-full mb-3",
          uiMode === "dark"
            ? "bg-white/10 border-white/20"
            : "bg-black/10 border-black/20"
        )}>
          <Sparkles className={cn(
            "h-5 w-5",
            uiMode === "dark" ? "text-white/80" : "text-black/80"
          )} />
        </div>
        <div className="text-center">
          <p className={cn(
            "font-medium",
            uiMode === "dark" ? "text-white" : "text-black"
          )}>
            Create your next session
          </p>
          <p className={cn(
            "mt-1 text-sm",
            uiMode === "dark" ? "text-white/70" : "text-black/70"
          )}>
            Once published, it'll appear here for quick access.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Button
          onClick={onCreate}
          className="h-12 rounded-full bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium shadow-lg shadow-lime-500/20"
        >
          Create invite
        </Button>

        <Button
          onClick={onClose}
          variant="ghost"
          className={cn(
            "h-11 rounded-full",
            uiMode === "dark"
              ? "text-white/80 hover:bg-white/10"
              : "text-black/80 hover:bg-black/10"
          )}
        >
          Close
        </Button>
      </div>
    </div>
  )
}

export function LiveInviteGuardModal({
  open,
  onOpenChange,
  liveSessions,
  uiMode,
  onContinueCreating,
  userId,
  onSessionsUpdate,
  onUnpublishSuccess,
  count,
  isLoading = false,
  error = null,
  onRetry,
}: LiveInviteGuardModalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [localSessions, setLocalSessions] = useState(liveSessions)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [sessionToUnpublish, setSessionToUnpublish] = useState<LiveSession | null>(null)
  const [isUnpublishing, setIsUnpublishing] = useState(false)

  // Sync localSessions when liveSessions prop changes
  useEffect(() => {
    setLocalSessions(liveSessions)
  }, [liveSessions])

  const liveCount = localSessions.length
  // Use server count if available, otherwise fall back to localSessions length
  const isEmpty = count !== undefined ? count === 0 : (!isLoading && !error && liveCount === 0)

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  const handleGoToLiveInvite = (session: LiveSession) => {
    if (session.id) {
      onOpenChange(false)
      router.push(`/host/sessions/${session.id}/edit`)
    }
  }

  const handleContinue = () => {
    // Save "don't show again" preference if checked
    if (dontShowAgain && userId) {
      const hideKey = `reserv_hide_live_invite_guard_${userId}`
      localStorage.setItem(hideKey, "true")
    }
    onOpenChange(false)
    router.push("/host/sessions/new/edit")
    onContinueCreating()
  }

  const handleCreateInvite = () => {
    onOpenChange(false)
    router.push("/host/sessions/new/edit")
  }

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      router.refresh()
    }
  }

  const handleUnpublishClick = (e: React.MouseEvent, session: LiveSession) => {
    e.stopPropagation() // Prevent card click
    setSessionToUnpublish(session)
    setUnpublishDialogOpen(true)
  }

  const handleUnpublishConfirm = async () => {
    if (!sessionToUnpublish) return

    setIsUnpublishing(true)
    try {
      const { unpublishSession } = await import("@/app/host/sessions/[id]/actions")
      const result = await unpublishSession(sessionToUnpublish.id)

      if (!result.ok) {
        toast({
          title: "Unpublish failed",
          description: result.error || "Failed to unpublish invite. Try again.",
          variant: "destructive",
        })
        setIsUnpublishing(false)
        return
      }

      // Optimistic UI update (remove session from local list)
      const updatedSessions = localSessions.filter((s) => s.id !== sessionToUnpublish.id)
      setLocalSessions(updatedSessions)
      
      // Notify parent to update its state
      if (onSessionsUpdate) {
        onSessionsUpdate(updatedSessions)
      }

      // Close dialog
      setUnpublishDialogOpen(false)
      setSessionToUnpublish(null)

      toast({
        title: "Invite unpublished",
        description: "The invite has been taken offline.",
        variant: "default",
      })

      // Trigger parent to refetch from server
      if (onUnpublishSuccess) {
        onUnpublishSuccess()
      }

      // Authoritative refresh: refetch server data
      router.refresh()

      // Don't close modal when empty - show empty state instead
      // The empty state will be shown automatically since localSessions is now empty
    } catch (error: any) {
      console.error("[handleUnpublishConfirm] Error:", { sessionId: sessionToUnpublish?.id, error })
      toast({
        title: "Unpublish failed",
        description: error.message || "Failed to unpublish invite. Try again.",
        variant: "destructive",
      })
    } finally {
      setIsUnpublishing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md max-h-[85vh] rounded-2xl flex flex-col",
          uiMode === "dark"
            ? "bg-slate-900 text-white border border-white/10"
            : "bg-white text-black border border-black/10"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn("text-xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
            {isEmpty
              ? "No live invites are currently public"
              : "You've got a live invite going 🔥"}
          </DialogTitle>
          <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
            {isEmpty
              ? "Create one now, publish it, then share your link."
              : "Want to jump back in, or spin up another one?"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-3 min-h-0">
          {isLoading ? (
            // Loading state - show 2 skeleton cards
            <>
              {[1, 2].map((i) => (
                <Card key={i} className={cn("p-4 border", glassCard)}>
                  <Skeleton className={cn(
                    "w-full h-32 rounded-xl mb-3",
                    uiMode === "dark" ? "bg-white/10" : "bg-black/10"
                  )} />
                  <Skeleton className={cn(
                    "h-5 w-3/4 mb-2 rounded",
                    uiMode === "dark" ? "bg-white/10" : "bg-black/10"
                  )} />
                  <Skeleton className={cn(
                    "h-4 w-1/2 rounded",
                    uiMode === "dark" ? "bg-white/10" : "bg-black/10"
                  )} />
                </Card>
              ))}
            </>
          ) : error ? (
            // Error state
            <div className={cn(
              "rounded-2xl border p-6 text-center",
              glassCard
            )}>
              <div className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4",
                uiMode === "dark"
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-red-100 border-red-200"
              )}>
                <AlertCircle className={cn(
                  "h-6 w-6",
                  uiMode === "dark" ? "text-red-400" : "text-red-600"
                )} />
              </div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                uiMode === "dark" ? "text-white" : "text-black"
              )}>
                Couldn't load live invites
              </h3>
              <p className={cn(
                "text-sm mb-4",
                uiMode === "dark" ? "text-white/70" : "text-black/70"
              )}>
                Please try again.
              </p>
              <Button
                onClick={handleRetry}
                className={cn(
                  "rounded-full h-11",
                  uiMode === "dark"
                    ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                    : "bg-black/10 hover:bg-black/20 text-black border border-black/20"
                )}
              >
                Try again
              </Button>
            </div>
          ) : isEmpty ? (
            // Empty state
            <NoLiveInvitesEmptyState
              onCreate={handleCreateInvite}
              onClose={() => onOpenChange(false)}
              uiMode={uiMode}
            />
          ) : (
            localSessions.map((session) => {
              const sportLabel = SPORT_LABELS[session.sport] || session.sport

              return (
              <div key={session.id} className="relative">
                <Card className={cn("p-4 border transition-all hover:shadow-lg relative", glassCard)}>
                  {/* Unpublish button - positioned absolutely */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnpublishClick(e, session)
                    }}
                    size="sm"
                    variant="outline"
                    className={cn(
                      "absolute top-4 right-4 z-10 rounded-full h-8 px-3 text-xs",
                      uiMode === "dark"
                        ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                        : "border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400"
                    )}
                  >
                    <Ban className="w-3 h-3 mr-1.5" />
                    Unpublish
                  </Button>

                  <motion.button
                    onClick={() => handleGoToLiveInvite(session)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left"
                  >
                    {/* Cover Image / Sport Background */}
                    <div
                      className={cn(
                        "relative w-full h-32 rounded-xl mb-3 overflow-hidden",
                        !session.cover_url && "bg-gradient-to-br from-lime-500/20 to-emerald-500/20"
                      )}
                    >
                      {session.cover_url ? (
                        <img
                          src={session.cover_url}
                          alt={session.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={cn("text-lg font-semibold", uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                            {sportLabel}
                          </span>
                        </div>
                      )}
                      {/* Sport Pill */}
                      <div
                        className={cn(
                          "absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium",
                          uiMode === "dark" ? "bg-black/60 text-white" : "bg-white/90 text-black"
                        )}
                      >
                        {sportLabel}
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="space-y-2">
                      <h3 className={cn("font-semibold text-base truncate", uiMode === "dark" ? "text-white" : "text-black")}>
                        {session.title}
                      </h3>

                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className={cn("w-4 h-4 flex-shrink-0", uiMode === "dark" ? "text-white/60" : "text-black/60")} />
                        <span className={cn("truncate", uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                          {formatDate(session.start_at)}
                        </span>
                      </div>

                      {session.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className={cn("w-4 h-4 flex-shrink-0", uiMode === "dark" ? "text-white/60" : "text-black/60")} />
                          <span className={cn("truncate", uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                            {session.location}
                          </span>
                        </div>
                      )}

                      {session.capacity && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className={cn("w-4 h-4 flex-shrink-0", uiMode === "dark" ? "text-white/60" : "text-black/60")} />
                          <span className={cn(uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                            {session.capacity} spots
                          </span>
                        </div>
                      )}

                      {/* Go to live invite indicator */}
                      <div className="mt-3 text-center">
                        <span className={cn("text-xs font-medium", uiMode === "dark" ? "text-lime-400" : "text-lime-600")}>
                          Tap to view →
                        </span>
                      </div>
                    </div>
                  </motion.button>
                </Card>
              </div>
              )
            })
          )}
        </div>

        {/* Bottom Actions - only show when there are sessions (not empty, loading, or error) */}
        {!isLoading && !error && !isEmpty && (
          <div className={cn("mt-4 pt-4 space-y-3", uiMode === "dark" ? "border-t border-white/10" : "border-t border-black/10")}>
            {/* Don't show again checkbox */}
            {userId && (
              <button
                onClick={() => setDontShowAgain(!dontShowAgain)}
                className={cn(
                  "flex items-center gap-2 w-full text-left py-2 rounded-lg transition-colors",
                  uiMode === "dark"
                    ? "hover:bg-white/5 text-white/70 hover:text-white"
                    : "hover:bg-black/5 text-black/70 hover:text-black"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    dontShowAgain
                      ? "bg-lime-500 border-lime-500"
                      : uiMode === "dark"
                      ? "border-white/30"
                      : "border-black/30"
                  )}
                >
                  {dontShowAgain && <Check className="w-3 h-3 text-black" />}
                </div>
                <span className={cn("text-sm", uiMode === "dark" ? "text-white/70" : "text-black/70")}>
                  Don't show this again
                </span>
              </button>
            )}

            {/* Create Another button - Primary CTA (green) */}
            {liveCount >= 2 ? (
              <div className="text-center">
                <Button
                  disabled
                  className="w-full rounded-full h-12 opacity-50 cursor-not-allowed bg-gradient-to-r from-lime-500 to-emerald-500 text-black"
                >
                  Create Another
                </Button>
                <p className={cn("text-xs mt-2", uiMode === "dark" ? "text-white/50" : "text-black/50")}>
                  You can only have 2 live invites at a time. Close one to publish another.
                </p>
              </div>
            ) : (
              <Button
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full h-12 shadow-lg shadow-lime-500/20"
              >
                Create Another
              </Button>
            )}
          </div>
        )}
      </DialogContent>

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
              Unpublish this invite?
            </DialogTitle>
            <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              This will take the invite offline. You can publish again anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-4">
            <Button
              onClick={() => {
                setUnpublishDialogOpen(false)
                setSessionToUnpublish(null)
              }}
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
              onClick={handleUnpublishConfirm}
              disabled={isUnpublishing}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full h-12 shadow-lg shadow-red-500/20"
            >
              {isUnpublishing ? "Unpublishing..." : "Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

