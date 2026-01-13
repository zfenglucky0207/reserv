"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Copy, MessageCircle, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateAttendanceReminderMessage, getWhatsAppDeepLink } from "@/utils/session-prompt-messages"
import { markPromptShown, markPromptDismissed } from "@/app/host/sessions/[id]/actions"

interface AttendanceReminderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptId: string
  session: {
    title: string
    start_at: string
    end_at: string | null
    location: string | null
    sport: string
  }
  participants: Array<{ display_name: string }>
  slotsRemaining: number
  uiMode: "dark" | "light"
}

export function AttendanceReminderDialog({
  open,
  onOpenChange,
  promptId,
  session,
  participants,
  slotsRemaining,
  uiMode,
}: AttendanceReminderDialogProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  const message = generateAttendanceReminderMessage(session, participants, slotsRemaining)
  const whatsappUrl = getWhatsAppDeepLink(message)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      
      // Mark as shown
      const result = await markPromptShown(promptId)
      if (result.ok) {
        toast({
          title: "Message copied",
          description: "Attendance reminder copied to clipboard.",
          variant: "success",
        })
        setTimeout(() => {
          setCopied(false)
          onOpenChange(false)
        }, 1000)
      } else {
        toast({
          title: "Copied",
          description: "Message copied, but failed to save state.",
          variant: "default",
        })
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleShareToWhatsApp = async () => {
    setIsProcessing(true)
    try {
      // Mark as shown
      await markPromptShown(promptId)
      
      // Open WhatsApp
      window.open(whatsappUrl, "_blank")
      
      toast({
        title: "Opening WhatsApp",
        description: "Share the message with your group.",
        variant: "success",
      })
      
      setTimeout(() => {
        onOpenChange(false)
        setIsProcessing(false)
      }, 500)
    } catch (error) {
      toast({
        title: "Failed to open WhatsApp",
        description: "Please try copying the message instead.",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  const handleDismiss = async () => {
    setIsProcessing(true)
    try {
      const result = await markPromptDismissed(promptId)
      if (result.ok) {
        onOpenChange(false)
      } else {
        toast({
          title: "Failed to dismiss",
          description: result.error || "Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dismiss reminder.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md",
          uiMode === "dark"
            ? "bg-slate-900 border-white/10 text-white"
            : "bg-white border-black/10 text-black"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn("text-xl font-bold", uiMode === "dark" ? "text-white" : "text-black")}>
            Attendance Reminder
          </DialogTitle>
          <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
            Share this message to remind participants about the upcoming session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message Preview */}
          <Card className={cn("p-4", glassCard)}>
            <pre className={cn(
              "whitespace-pre-wrap text-sm font-mono",
              uiMode === "dark" ? "text-white/90" : "text-black/90"
            )}>
              {message}
            </pre>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            onClick={handleDismiss}
            variant="outline"
            disabled={isProcessing}
            className={cn(
              "flex-1",
              uiMode === "dark"
                ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
            )}
          >
            <X className="w-4 h-4 mr-2" />
            Dismiss
          </Button>
          <Button
            onClick={handleCopy}
            variant="outline"
            disabled={isProcessing || copied}
            className={cn(
              "flex-1",
              uiMode === "dark"
                ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>
          <Button
            onClick={handleShareToWhatsApp}
            disabled={isProcessing}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-medium"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
