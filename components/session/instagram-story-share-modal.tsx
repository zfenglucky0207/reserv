"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, Download, Copy, Instagram } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface InstagramStoryShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uiMode: "dark" | "light"
  inviteLink: string
}

export function InstagramStoryShareModal({
  open,
  onOpenChange,
  uiMode,
  inviteLink,
}: InstagramStoryShareModalProps) {
  const [linkCopied, setLinkCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy link:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md rounded-2xl",
          uiMode === "dark"
            ? "bg-slate-900 text-white border border-white/10"
            : "bg-white text-black border border-black/10"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn("text-xl font-semibold flex items-center gap-2", uiMode === "dark" ? "text-white" : "text-black")}>
            <Instagram className="w-5 h-5" />
            Share to Instagram Story
          </DialogTitle>
          <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
            Image downloaded! Follow these steps to post to Instagram.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className={cn(
            "rounded-xl p-4 space-y-3",
            uiMode === "dark" ? "bg-white/5" : "bg-black/5"
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold text-sm",
                uiMode === "dark" ? "bg-lime-500/20 text-lime-400" : "bg-lime-500/20 text-lime-600"
              )}>
                1
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  Open Instagram
                </p>
                <p className={cn("text-xs mt-1", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                  Open the Instagram app on your phone
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={cn(
                "rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold text-sm",
                uiMode === "dark" ? "bg-lime-500/20 text-lime-400" : "bg-lime-500/20 text-lime-600"
              )}>
                2
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  Create a Story
                </p>
                <p className={cn("text-xs mt-1", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                  Tap the + button and select "Story"
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={cn(
                "rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold text-sm",
                uiMode === "dark" ? "bg-lime-500/20 text-lime-400" : "bg-lime-500/20 text-lime-600"
              )}>
                3
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  Upload the image
                </p>
                <p className={cn("text-xs mt-1", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                  Select the downloaded image from your gallery
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={cn(
                "rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold text-sm",
                uiMode === "dark" ? "bg-lime-500/20 text-lime-400" : "bg-lime-500/20 text-lime-600"
              )}>
                4
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
                  Add link sticker
                </p>
                <p className={cn("text-xs mt-1", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
                  Tap the sticker icon → "Link" → paste the copied link
                </p>
              </div>
            </div>
          </div>

          <div className={cn(
            "rounded-xl p-3 flex items-center justify-between",
            uiMode === "dark" ? "bg-white/5 border border-white/10" : "bg-black/5 border border-black/10"
          )}>
            <div className="flex-1 min-w-0 mr-3">
              <p className={cn("text-xs font-medium mb-1", uiMode === "dark" ? "text-white/70" : "text-black/70")}>
                Invite link
              </p>
              <p className={cn("text-xs truncate", uiMode === "dark" ? "text-white/50" : "text-black/50")}>
                {inviteLink}
              </p>
            </div>
            <Button
              onClick={handleCopyLink}
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 rounded-full flex-shrink-0",
                uiMode === "dark"
                  ? "text-white hover:bg-white/10"
                  : "text-black hover:bg-black/10"
              )}
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-6 pt-4 flex gap-3 border-t border-white/10">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className={cn(
              "flex-1 rounded-full",
              uiMode === "dark"
                ? "bg-white/5 text-white border-white/10 hover:bg-white/10"
                : "bg-black/5 text-black border-black/10 hover:bg-black/10"
            )}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
