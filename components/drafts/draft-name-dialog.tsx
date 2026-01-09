"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ActionButton } from "@/components/ui/action-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface DraftNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => Promise<void> | void
  uiMode: "dark" | "light"
}

export function DraftNameDialog({ open, onOpenChange, onSave, uiMode }: DraftNameDialogProps) {
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || isSaving) {
      return
    }

    setIsSaving(true)
    try {
      await onSave(name.trim())
      // Parent will close the dialog and reset state
      // We keep isSaving true to show feedback until parent closes
    } catch (error) {
      // Error handling is done in parent
      setIsSaving(false) // Reset on error so user can try again
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName("")
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md rounded-2xl",
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
            Save draft
          </DialogTitle>
          <DialogDescription className={cn(
            uiMode === "dark" ? "text-white/60" : "text-black/60"
          )}>
            Give your draft a name so you can find it later
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div>
            <Label
              htmlFor="draft-name"
              className={cn(
                "text-sm mb-2 block",
                uiMode === "dark" ? "text-white/70" : "text-black/60"
              )}
            >
              Draft name
            </Label>
            <Input
              id="draft-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Badminton"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSave()
                }
              }}
              className={cn(
                "h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-lime-500/40",
                uiMode === "dark"
                  ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
              )}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className={cn(
          "mt-6 pt-4 flex gap-3",
          uiMode === "dark" ? "border-t border-white/10" : "border-t border-black/10"
        )}>
          <ActionButton
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
            className={cn(
              "flex-1 rounded-full",
              uiMode === "dark"
                ? "bg-white/5 text-white border-white/10 hover:bg-white/10"
                : "bg-black/5 text-black border-black/10 hover:bg-black/10"
            )}
          >
            Cancel
          </ActionButton>
          <ActionButton
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save draft"}
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}


