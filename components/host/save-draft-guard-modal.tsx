"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { saveDraft, overwriteDraft, getDraftStatusForSession, type DraftSummary, type DraftData } from "@/app/actions/drafts"
import { getSessionDataForDraft } from "@/app/host/sessions/[id]/actions"
import { DraftNameDialog } from "@/components/drafts/draft-name-dialog"

interface SaveDraftGuardModalProps {
  sessionId: string
  uiMode: "dark" | "light"
  sessionStatus?: string // Session status - only show for "open" sessions
  onDraftSaved?: () => void // Callback when draft is saved
}

const DISMISSAL_CACHE_KEY_PREFIX = "sl:draftGuardDismissed:"
const DISMISSAL_CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

export function SaveDraftGuardModal({ sessionId, uiMode, sessionStatus, onDraftSaved }: SaveDraftGuardModalProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isSavedToDraft, setIsSavedToDraft] = useState(false)
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [showDraftNameDialog, setShowDraftNameDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draftData, setDraftData] = useState<DraftData | null>(null)

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  // Check dismissal cache
  const checkDismissalCache = (): boolean => {
    if (typeof window === "undefined") return false
    const key = `${DISMISSAL_CACHE_KEY_PREFIX}${sessionId}`
    const cached = localStorage.getItem(key)
    if (!cached) return false

    try {
      const timestamp = parseInt(cached, 10)
      const now = Date.now()
      if (now - timestamp < DISMISSAL_CACHE_DURATION_MS) {
        return true // Still within dismissal period
      } else {
        // Expired, remove it
        localStorage.removeItem(key)
        return false
      }
    } catch {
      return false
    }
  }

  // Set dismissal cache
  const setDismissalCache = () => {
    if (typeof window === "undefined") return
    const key = `${DISMISSAL_CACHE_KEY_PREFIX}${sessionId}`
    localStorage.setItem(key, Date.now().toString())
  }

  // Fetch draft status
  useEffect(() => {
    const fetchDraftStatus = async () => {
      // Only show modal for published (open) sessions, not drafts
      if (sessionStatus !== "open") {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await getDraftStatusForSession(sessionId)
        if (result.ok) {
          setIsSavedToDraft(result.isSavedToDraft)
          setDrafts(result.drafts)

          // Only open modal if:
          // 1. Not saved to draft
          // 2. Not dismissed recently
          if (!result.isSavedToDraft && !checkDismissalCache()) {
            setOpen(true)
          }
        }
      } catch (error) {
        console.error("[SaveDraftGuardModal] Error fetching draft status:", error)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchDraftStatus()
    }
  }, [sessionId, sessionStatus])

  // Handle "No thanks" - dismiss for 24 hours
  const handleNoThanks = () => {
    setDismissalCache()
    setOpen(false)
  }

  // Handle "Save draft" when drafts < 2
  const handleSaveDraft = async () => {
    // Fetch session data in draft format
    setIsSaving(true)
    try {
      const result = await getSessionDataForDraft(sessionId)
      if (result.ok) {
        setDraftData(result.data)
        setShowDraftNameDialog(true)
      } else {
        toast({
          title: "Error",
          description: result.error || "Unable to fetch session data.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle draft name confirmation
  const handleDraftNameConfirm = async (name: string) => {
    if (!draftData) {
      // If no draft data provided, we need to fetch session data
      // For now, create a minimal draft
      toast({
        title: "Error",
        description: "Unable to save draft. Please try again.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await saveDraft(name, draftData, sessionId)
      if (result.ok) {
        // Close dialogs immediately to prevent reopening
        setShowDraftNameDialog(false)
        setIsSavedToDraft(true)
        setOpen(false)
        
        toast({
          title: "Draft saved",
          description: "Your draft has been saved successfully.",
        })
        
        onDraftSaved?.()
      } else {
        toast({
          title: "Failed to save draft",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to save draft",
        description: error?.message || "An error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle draft selection for replace flow
  const handleDraftSelect = async (draftId: string) => {
    // Fetch session data before showing confirm
    setIsSaving(true)
    try {
      const result = await getSessionDataForDraft(sessionId)
      if (result.ok) {
        setDraftData(result.data)
        setSelectedDraftId(draftId)
        setShowReplaceConfirm(true)
      } else {
        toast({
          title: "Error",
          description: result.error || "Unable to fetch session data.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle replace confirmation
  const handleReplaceConfirm = async () => {
    if (!selectedDraftId || !draftData) {
      return
    }

    setIsSaving(true)
    try {
      const result = await overwriteDraft(selectedDraftId, draftData, undefined, sessionId)
      if (result.ok) {
        toast({
          title: "Draft replaced",
          description: "The selected draft has been replaced.",
        })
        setIsSavedToDraft(true)
        setOpen(false)
        setShowReplaceConfirm(false)
        setSelectedDraftId(null)
        onDraftSaved?.()
      } else {
        toast({
          title: "Failed to replace draft",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to replace draft",
        description: error?.message || "An error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Don't render if loading or already saved
  if (loading || isSavedToDraft) {
    return null
  }

  const selectedDraft = drafts.find((d) => d.id === selectedDraftId)

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "max-w-md rounded-2xl",
            uiMode === "dark"
              ? "bg-slate-900 text-white border border-white/10"
              : "bg-white text-black border border-black/10"
          )}
        >
          {!showReplaceConfirm ? (
            <>
              <DialogHeader>
                <DialogTitle className={cn("text-xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
                  {drafts.length >= 2 ? "Drafts are full (2/2)" : "Save this invite as a draft?"}
                </DialogTitle>
                <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                  {drafts.length >= 2
                    ? "Replace one to save this invite as a draft."
                    : "So you can duplicate or reuse it later without rebuilding everything."}
                </DialogDescription>
              </DialogHeader>

              {drafts.length >= 2 ? (
                <div className="mt-4 space-y-3">
                  {drafts.map((draft) => (
                    <button
                      key={draft.id}
                      onClick={() => handleDraftSelect(draft.id)}
                      disabled={isSaving}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-colors",
                        selectedDraftId === draft.id
                          ? uiMode === "dark"
                            ? "bg-white/10 border-white/30"
                            : "bg-black/10 border-black/30"
                          : uiMode === "dark"
                          ? "bg-white/5 border-white/10 hover:bg-white/10"
                          : "bg-black/5 border-black/10 hover:bg-black/10",
                        isSaving && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="font-medium">{draft.name}</div>
                      <div className={cn("text-xs mt-1", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                        Updated {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              <DialogFooter className="gap-3 mt-6">
                <ActionButton
                  onClick={handleNoThanks}
                  variant="outline"
                  disabled={isSaving}
                  className={cn(
                    "flex-1 rounded-full h-12",
                    uiMode === "dark"
                      ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                      : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
                  )}
                >
                  No thanks
                </ActionButton>
                {drafts.length < 2 ? (
                  <ActionButton
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full h-12 shadow-lg shadow-lime-500/20 disabled:opacity-50"
                  >
                    {isSaving ? "Loading..." : "Save draft"}
                  </ActionButton>
                ) : (
                  <ActionButton
                    onClick={() => selectedDraftId && handleReplaceConfirm()}
                    disabled={!selectedDraftId || isSaving}
                    className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full h-12 shadow-lg shadow-lime-500/20 disabled:opacity-50"
                  >
                    {isSaving ? "Loading..." : "Replace selected draft"}
                  </ActionButton>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className={cn("text-xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
                  Replace draft?
                </DialogTitle>
                <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                  Replace '{selectedDraft?.name}' with this invite?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-3 mt-6">
                <ActionButton
                  onClick={() => {
                    setShowReplaceConfirm(false)
                    setSelectedDraftId(null)
                  }}
                  variant="outline"
                  disabled={isSaving}
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
                  onClick={handleReplaceConfirm}
                  disabled={isSaving}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full h-12 shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {isSaving ? "Replacing..." : "Confirm replace"}
                </ActionButton>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DraftNameDialog
        open={showDraftNameDialog}
        onOpenChange={setShowDraftNameDialog}
        onSave={handleDraftNameConfirm}
        uiMode={uiMode}
      />
    </>
  )
}

