"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DraftSummary } from "@/app/actions/drafts"
import { Trash2, Loader2 } from "lucide-react"

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
            {isOverwriteMode ? "Overwrite draft" : "My drafts"}
          </DialogTitle>
          <DialogDescription className={cn(
            uiMode === "dark" ? "text-white/60" : "text-black/60"
          )}>
            {isOverwriteMode
              ? "You have 2 drafts already. Choose one to overwrite or delete one first."
              : "Load or manage your saved drafts"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-3 min-h-0">
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
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      "font-medium text-base mb-1 truncate",
                      uiMode === "dark" ? "text-white" : "text-black"
                    )}>
                      {draft.name}
                    </h3>
                    <p className={cn(
                      "text-xs",
                      uiMode === "dark" ? "text-white/50" : "text-black/50"
                    )}>
                      {formatRelativeTime(draft.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOverwriteMode ? (
                      <Button
                        onClick={() => {
                          onOverwrite(draft.id)
                          onOpenChange(false)
                        }}
                        size="sm"
                        className="bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full text-xs px-3 h-8"
                      >
                        Overwrite
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => {
                            onLoad(draft.id)
                            onOpenChange(false)
                          }}
                          size="sm"
                          variant="outline"
                          className={cn(
                            "rounded-full text-xs px-3 h-8",
                            uiMode === "dark"
                              ? "bg-white/5 text-white border-white/10 hover:bg-white/10"
                              : "bg-black/5 text-black border-black/10 hover:bg-black/10"
                          )}
                        >
                          Load
                        </Button>
                        <Button
                          onClick={() => handleDelete(draft.id)}
                          size="sm"
                          variant="outline"
                          disabled={deletingId === draft.id}
                          className={cn(
                            "rounded-full text-xs px-3 h-8",
                            uiMode === "dark"
                              ? "bg-white/5 text-red-400 border-red-400/20 hover:bg-red-400/10"
                              : "bg-black/5 text-red-600 border-red-600/20 hover:bg-red-600/10"
                          )}
                        >
                          {deletingId === draft.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      </>
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


