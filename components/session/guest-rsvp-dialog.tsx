"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface GuestRSVPDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContinue: (name: string, phone: string | null) => void
  uiMode: "dark" | "light"
  action: "join"
  initialName?: string
  error?: string | null
}

export function GuestRSVPDialog({
  open,
  onOpenChange,
  onContinue,
  uiMode,
  action,
  initialName = "",
  error = null,
}: GuestRSVPDialogProps) {
  // Try to load name/phone from localStorage on mount
  const [name, setName] = useState(() => {
    if (initialName) return initialName
    if (typeof window !== "undefined") {
      return localStorage.getItem("guestName") || ""
    }
    return ""
  })
  const [phone, setPhone] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("guestPhone") || ""
    }
    return ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showError, setShowError] = useState(false)
  
  // Update error state when error prop changes
  useEffect(() => {
    if (error) {
      setShowError(true)
    } else {
      setShowError(false)
    }
  }, [error])
  
  // Clear error when user types
  const handleNameChange = (value: string) => {
    setName(value)
    // Clear error state when user starts typing
    if (showError) {
      setShowError(false)
    }
  }

  // Update name when initialName changes (e.g., when dialog opens with pre-filled name)
  useEffect(() => {
    if (open) {
      // Prefer initialName prop (from authenticated user's email/Gmail), then localStorage
      const storedName = typeof window !== "undefined" ? localStorage.getItem("guestName") : null
      const nameToUse = initialName || storedName || ""
      if (nameToUse) {
        setName(nameToUse)
      }
      
      // Also try to load phone from localStorage
      const storedPhone = typeof window !== "undefined" ? localStorage.getItem("guestPhone") : null
      if (storedPhone) {
        setPhone(storedPhone)
      }
    }
  }, [open, initialName])

  const handleSubmit = async () => {
    if (!name.trim()) {
      return
    }

    // Store name and phone in localStorage for future use
    if (typeof window !== "undefined") {
      localStorage.setItem("guestName", name.trim())
      if (phone.trim()) {
        localStorage.setItem("guestPhone", phone.trim())
      }
    }

    setIsSubmitting(true)
    await onContinue(name.trim(), phone.trim() || null)
    // Don't clear name/phone - keep them for next time
    setIsSubmitting(false)
    // Don't close dialog automatically - parent will handle it based on result
    // If there's a duplicate name error, dialog stays open
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
            <motion.div
              animate={showError ? {
                scale: [1, 1.02, 1],
                x: [0, -4, 4, -4, 4, 0],
              } : {}}
              transition={{
                duration: 0.5,
                ease: "easeInOut",
              }}
            >
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Your name"
                className={cn(
                  "transition-all",
                  showError
                    ? uiMode === "dark"
                      ? "bg-red-500/10 border-red-500/50 text-white placeholder:text-white/40 ring-2 ring-red-500/50"
                      : "bg-red-50 border-red-500/50 text-black placeholder:text-black/40 ring-2 ring-red-500/50"
                    : uiMode === "dark"
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                      : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
                )}
                autoFocus
              />
            </motion.div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "text-sm text-red-500 font-medium"
                )}
              >
                {error}
              </motion.p>
            )}
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

