"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DraftSummary } from "@/app/actions/drafts"
import { Trash2, Loader2, AlertTriangle } from "lucide-react"

interface DraftsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drafts: DraftSummary[]
  isOverwriteMode?: boolean
  onLoad: (draftId: string) => void
  onDelete: (draftId: string) => void
  onOverwrite: (draftId: string) => void
  uiMode: "dark" | "light"
  isLoading?: boolean
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`

  // For older dates, show actual date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
}

export function DraftsDialog({
  open,
  onOpenChange,
  drafts,
  isOverwriteMode = false,
  onLoad,
  onDelete,
  onOverwrite,
  uiMode,
  isLoading = false,
}: DraftsDialogProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (draftId: string) => {
    setDeletingId(draftId)
    await onDelete(draftId)
    setDeletingId(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md max-h-[80vh] rounded-2xl flex flex-col",
          uiMode === "dark"
            ? "bg-slate-900 text-white border border-white/10"
            : "bg-white text-black border border-black/10"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn(
            "text-xl font-semibold",
            uiMode === "dark" ? "text-white" : "text-black"
          )}>
            {isOverwriteMode ? "Draft limit reached" : "My drafts"}
          </DialogTitle>
          <DialogDescription className={cn(
            uiMode === "dark" ? "text-white/60" : "text-black/60"
          )}>
            {isOverwriteMode
              ? "You have reached the maximum of 2 drafts. Remove one to proceed."
              : "Load or manage your saved drafts"}
          </DialogDescription>
        </DialogHeader>

        {/* Warning banner when limit is reached */}
        {isOverwriteMode && (
          <div className={cn(
            "mt-4 p-4 rounded-xl border flex items-start gap-3",
            uiMode === "dark"
              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
              : "bg-yellow-50 border-yellow-300 text-yellow-800"
          )}>
            <AlertTriangle className={cn(
              "w-5 h-5 flex-shrink-0 mt-0.5",
              uiMode === "dark" ? "text-yellow-400" : "text-yellow-600"
            )} />
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium mb-1",
                uiMode === "dark" ? "text-yellow-300" : "text-yellow-900"
              )}>
                Draft limit reached
              </p>
              <p className={cn(
                "text-xs",
                uiMode === "dark" ? "text-yellow-400/80" : "text-yellow-700"
              )}>
                You have reached the maximum of 2 drafts. Please remove one draft below to save a new one.
              </p>
            </div>
          </div>
        )}

        <div className={cn(
          "flex-1 overflow-y-auto space-y-3 min-h-0",
          isOverwriteMode ? "mt-4" : "mt-4"
        )}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={cn(
                "w-6 h-6 animate-spin",
                uiMode === "dark" ? "text-white/40" : "text-black/40"
              )} />
            </div>
          ) : drafts.length === 0 ? (
            <div className={cn(
              "text-center py-8",
              uiMode === "dark" ? "text-white/60" : "text-black/60"
            )}>
              No drafts yet. Save your first draft to get started.
            </div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className={cn(
                  "rounded-xl p-4 border",
                  uiMode === "dark"
                    ? "bg-white/5 border-white/10"
                    : "bg-black/5 border-black/10"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => {
                      if (!isOverwriteMode) {
                        onLoad(draft.id)
                        onOpenChange(false)
                      }
                    }}
                    className={cn(
                      "flex-1 min-w-0 text-left",
                      !isOverwriteMode 
                        ? "cursor-pointer hover:opacity-80 transition-opacity"
                        : "cursor-default"
                    )}
                    disabled={isOverwriteMode}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn(
                        "font-medium text-base truncate flex-1",
                        uiMode === "dark" ? "text-white" : "text-black"
                      )}>
                        {draft.name}
                      </h3>
                      {/* LIVE badge */}
                      {draft.is_live && (
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                          "bg-red-500/80 backdrop-blur-sm border border-red-400/30 text-white shadow-lg shadow-red-500/20"
                        )}>
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                          </span>
                          LIVE
                        </div>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs",
                      uiMode === "dark" ? "text-white/50" : "text-black/50"
                    )}>
                      {formatRelativeTime(draft.updated_at)}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOverwriteMode ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(draft.id)
                        }}
                        size="sm"
                        variant="outline"
                        disabled={deletingId === draft.id}
                        className={cn(
                          "rounded-full px-3 h-10 w-10 flex items-center justify-center",
                          uiMode === "dark"
                            ? "bg-red-500/10 text-red-400 border-red-400/30 hover:bg-red-500/20 hover:border-red-400/50"
                            : "bg-red-50 text-red-600 border-red-300 hover:bg-red-100 hover:border-red-400"
                        )}
                      >
                        {deletingId === draft.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(draft.id)
                        }}
                        size="sm"
                        variant="outline"
                        disabled={deletingId === draft.id}
                        className={cn(
                          "rounded-full px-3 h-10 w-10 flex items-center justify-center",
                          uiMode === "dark"
                            ? "bg-red-500/10 text-red-400 border-red-400/30 hover:bg-red-500/20 hover:border-red-400/50"
                            : "bg-red-50 text-red-600 border-red-300 hover:bg-red-100 hover:border-red-400"
                        )}
                      >
                        {deletingId === draft.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!isOverwriteMode && (
          <div className={cn(
            "mt-4 pt-4",
            uiMode === "dark" ? "border-t border-white/10" : "border-t border-black/10"
          )}>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className={cn(
                "w-full rounded-full",
                uiMode === "dark"
                  ? "bg-white/5 text-white border-white/10 hover:bg-white/10"
                  : "bg-black/5 text-black border-black/10 hover:bg-black/10"
              )}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


