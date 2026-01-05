"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface GuestRSVPDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContinue: (name: string, phone: string | null) => void
  uiMode: "dark" | "light"
  action: "join"
  initialName?: string
}

export function GuestRSVPDialog({
  open,
  onOpenChange,
  onContinue,
  uiMode,
  action,
  initialName = "",
}: GuestRSVPDialogProps) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update name when initialName changes (e.g., when dialog opens with pre-filled name)
  useEffect(() => {
    if (open && initialName) {
      setName(initialName)
    }
  }, [open, initialName])

  const handleSubmit = async () => {
    if (!name.trim()) {
      return
    }

    setIsSubmitting(true)
    onContinue(name.trim(), phone.trim() || null)
    setName("")
    setPhone("")
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[425px]",
          uiMode === "dark" ? "bg-slate-900 border-white/10 text-white" : "bg-white border-black/10 text-black"
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn("text-2xl font-bold", uiMode === "dark" ? "text-white" : "text-black")}
          >
            Join Session
          </DialogTitle>
          <DialogDescription
            className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}
          >
            Please provide your name to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label
              htmlFor="name"
              className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}
            >
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your name"
              className={cn(
                uiMode === "dark"
                  ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
              )}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor="phone"
              className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}
            >
              Phone <span className="text-sm text-white/40">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your phone number"
              className={cn(
                uiMode === "dark"
                  ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
              )}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn(
              uiMode === "dark"
                ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
            )}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full"
          >
            Join
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

