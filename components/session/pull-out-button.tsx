"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface PullOutButtonProps {
  participantId: string
  sessionId: string
  onSuccess?: () => void
  className?: string
  uiMode?: "dark" | "light"
}

export function PullOutButton({
  participantId,
  sessionId,
  onSuccess,
  className,
  uiMode = "dark",
}: PullOutButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleConfirm = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const { pullOutFromSession } = await import("@/app/session/[id]/actions")
      const result = await pullOutFromSession({
        participantId,
        sessionId,
        reason: reason.trim(),
      })

      if (result.ok) {
        toast({
          title: "Pulled out successfully",
          description: "You've been removed from the session.",
          variant: "default",
        })
        setOpen(false)
        setReason("")
        onSuccess?.()
      } else {
        toast({
          title: "Failed to pull out",
          description: result.error || "Please try again.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to pull out from session.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        className={cn("w-full mt-6 rounded-xl", className)}
        onClick={() => setOpen(true)}
      >
        Pull out from session
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-[425px]",
            uiMode === "dark" ? "bg-slate-900 border-white/10 text-white" : "bg-white border-black/10 text-black"
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn("text-2xl font-bold", uiMode === "dark" ? "text-white" : "text-black")}>
              Pull out from session?
            </DialogTitle>
            <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              Let the host know why you're pulling out.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Optional reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={cn(
                "min-h-[100px]",
                uiMode === "dark"
                  ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
              )}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setReason("")
              }}
              disabled={isSubmitting}
              className={cn(
                uiMode === "dark"
                  ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                  : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
              )}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Pulling out..." : "Confirm pull out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

