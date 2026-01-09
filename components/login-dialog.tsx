"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ActionButton } from "@/components/ui/action-button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chrome, Mail, ArrowLeft } from "lucide-react"
import { handleGoogleOAuth, handleEmailAuth, handleEmailOtpVerify } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/hooks/use-auth"
import { getCurrentReturnTo, setPostAuthRedirect, consumePostAuthRedirect } from "@/lib/post-auth-redirect"
import { useRouter } from "next/navigation"

const COOLDOWN_S = 60

// Cooldown helper functions
function getCooldownKey(email: string): string {
  return `sl:emailOtp:cooldownUntil:${email.toLowerCase()}`
}

function getRemainingCooldown(email: string): number {
  if (typeof window === 'undefined' || !email) return 0
  const key = getCooldownKey(email)
  const raw = localStorage.getItem(key)
  const until = raw ? Number(raw) : 0
  const now = Date.now()
  return Math.max(0, Math.ceil((until - now) / 1000))
}

function setCooldown(email: string): void {
  if (typeof window === 'undefined' || !email) return
  const key = getCooldownKey(email)
  const until = Date.now() + COOLDOWN_S * 1000
  localStorage.setItem(key, String(until))
}

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContinueAsGuest?: (name: string) => void
}

export function LoginDialog({ open, onOpenChange, onContinueAsGuest }: LoginDialogProps) {
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  // Removed showGuestForm and guestName - no longer needed since we skip the name-only dialog
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailStep, setEmailStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  // Close dialog when user becomes authenticated and refresh
  useEffect(() => {
    if (isAuthenticated && open) {
      onOpenChange(false)
      // Reset all forms
      setShowEmailForm(false)
      setEmail("")
      setOtp("")
      setEmailStep("email")
      setEmailError(null)
      setCooldownRemaining(0)
      
      // Stay on current page, refresh server components
      // This ensures the UI updates to show authenticated state without navigation
      console.log("[auth] signed_in - refreshing current page", { currentPath: window.location.pathname })
      router.refresh()
    }
  }, [isAuthenticated, open, onOpenChange, router])

  // Cooldown countdown timer
  useEffect(() => {
    if (!email || !showEmailForm || emailStep !== "code") {
      setCooldownRemaining(0)
      return
    }

    const updateCooldown = () => {
      const remaining = getRemainingCooldown(email)
      setCooldownRemaining(remaining)
    }

    // Initial update
    updateCooldown()

    // Update every second
    const interval = setInterval(updateCooldown, 1000)

    return () => clearInterval(interval)
  }, [email, showEmailForm, emailStep])

  const handleGuestContinue = () => {
    // Skip the name-only form and directly proceed to GuestRSVPDialog
    // The GuestRSVPDialog will handle name + phone collection
    if (onContinueAsGuest) {
      // Pass empty string - GuestRSVPDialog will handle name input
      onContinueAsGuest("")
    }
    onOpenChange(false)
    // Stay on current page, refresh server components
    router.refresh()
  }

  // Reset form when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowEmailForm(false)
      setEmail("")
      setOtp("")
      setEmailStep("email")
      setEmailError(null)
      setIsSending(false)
      setIsVerifying(false)
    }
    onOpenChange(isOpen)
  }

  const handleGoogleClick = async () => {
    try {
      // Capture current URL before starting OAuth
      const returnTo = getCurrentReturnTo()
      console.log("[AUTH] Google login clicked", { returnTo, currentPath: window.location.pathname })
      
      // Set post-auth redirect
      setPostAuthRedirect(returnTo)
      
      await handleGoogleOAuth(returnTo)
      // Note: handleGoogleOAuth will redirect to Google, so code after this won't run
    } catch (error: any) {
      console.error("[AUTH] Google OAuth error:", error)
      toast({
        title: "Authentication Error",
        description: error?.message || "Google OAuth is not enabled. Please enable it in your Supabase dashboard.",
        variant: "destructive",
      })
    }
  }

  const handleEmailClick = () => {
    setShowEmailForm(true)
    setEmailError(null)
  }

  const handleEmailBack = () => {
    if (emailStep === "code") {
      // Go back to email step, keep email filled
      setEmailStep("email")
      setOtp("")
      setEmailError(null)
    } else {
      // Close email form entirely
      setShowEmailForm(false)
      setEmail("")
      setOtp("")
      setEmailStep("email")
      setEmailError(null)
      setCooldownRemaining(0)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    
    if (!email.trim()) {
      setEmailError("Please enter your email address")
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email address")
      return
    }

    // Capture current URL before sending OTP
    const returnTo = getCurrentReturnTo()
    console.log("[AUTH] Email login initiated", { email: email.trim(), returnTo, currentPath: window.location.pathname })
    
    // Set post-auth redirect
    setPostAuthRedirect(returnTo)

    setIsSending(true)
    setEmailError(null)
    try {
      await handleEmailAuth(email.trim(), returnTo)
      // Move to code step on success
      setEmailStep("code")
      setOtp("")
      setCooldown(email.trim())
      setCooldownRemaining(COOLDOWN_S)
          toast({
            title: "Code sent",
            description: "Check your email for the verification code.",
            variant: "default",
          })
    } catch (error: any) {
      // Stay on email step if error
      setEmailError(error?.message || "Failed to send verification code. Please try again.")
      toast({
        title: "Error",
        description: error?.message || "Failed to send verification code. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleResendCode = async () => {
    // Prevent resend during cooldown
    if (cooldownRemaining > 0) {
      return
    }

    setEmailError(null)
    setIsSending(true)
    try {
      await handleEmailAuth(email.trim())
      // Only restart cooldown if successful
      setCooldown(email.trim())
      setCooldownRemaining(COOLDOWN_S)
      setOtp("") // Clear previous code input
          toast({
            title: "Code sent",
            description: "Check your email for the verification code.",
            variant: "default",
          })
    } catch (error: any) {
      // Do NOT restart cooldown on error
      setEmailError(error?.message || "Failed to send verification code. Please try again.")
      toast({
        title: "Error",
        description: error?.message || "Failed to send verification code. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)

    if (!otp.trim()) {
      setEmailError("Please enter the verification code")
      return
    }

    setIsVerifying(true)
    try {
      await handleEmailOtpVerify(email.trim(), otp.trim())
      // Success - user is authenticated, modal will close via useEffect
      // The useEffect will handle redirecting to the stored URL
      toast({
        title: "Signed in",
        description: "Welcome to Reserv!",
        variant: "default",
      })
      // The useEffect will handle closing the modal and redirecting when isAuthenticated becomes true
    } catch (error: any) {
      setEmailError(error?.message || "Invalid or expired code. Please try again.")
      toast({
        title: "Verification failed",
        description: error?.message || "Invalid or expired code. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-slate-900 to-slate-950 border-white/10 text-white">
        {showEmailForm ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">Continue with Email</DialogTitle>
              <DialogDescription className="text-white/60">
                {emailStep === "code"
                  ? `Enter the code we sent to ${email}`
                  : "Enter your email to receive a verification code"}
              </DialogDescription>
            </DialogHeader>

            {emailStep === "code" ? (
              <form onSubmit={handleVerifyCode} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-white">
                    Verification Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter code"
                    required
                    value={otp}
                    onChange={(e) => {
                      // Only allow digits
                      const value = e.target.value.replace(/\D/g, '')
                      setOtp(value)
                    }}
                    className="bg-slate-700/50 border-white/10 text-white placeholder:text-white/40 text-center text-2xl tracking-widest font-mono h-14"
                    autoFocus
                    disabled={isVerifying}
                  />
                  {emailError && (
                    <p className="text-red-400 text-xs mt-1 text-center">{emailError}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEmailBack}
                    disabled={isVerifying}
                    className="border-white/30 bg-white/5 hover:bg-white/10 text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifying || !otp.trim()}
                    className="flex-1 bg-white hover:bg-white/90 text-black font-medium"
                  >
                    {isVerifying ? "Verifying..." : "Verify"}
                  </Button>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResendCode}
                    disabled={isSending || cooldownRemaining > 0}
                    className="w-full text-white/60 hover:text-white/80 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending 
                      ? "Sending..." 
                      : cooldownRemaining > 0 
                      ? `Resend code (${cooldownRemaining}s)` 
                      : "Resend code"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-700/50 border-white/10 text-white placeholder:text-white/40"
                    autoFocus
                    disabled={isSending}
                  />
                  {emailError && (
                    <p className="text-red-400 text-xs mt-1">{emailError}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEmailBack}
                    disabled={isSending}
                    className="border-white/30 bg-white/5 hover:bg-white/10 text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSending}
                    className="flex-1 bg-white hover:bg-white/90 text-black font-medium"
                  >
                    {isSending ? "Sending..." : "Send code"}
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">Welcome to RESERV</DialogTitle>
              <DialogDescription className="text-white/60">
                Sign in to save your sessions and manage your events
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-4">
              {/* OAuth Options - Main/Prominent */}
              <ActionButton
                onClick={handleGoogleClick}
                className="w-full bg-white hover:bg-white/90 text-black font-medium h-12 text-base shadow-lg"
                size="lg"
              >
                <Chrome className="mr-2 h-5 w-5" />
                Continue with Google
              </ActionButton>

              <ActionButton
                onClick={handleEmailClick}
                variant="outline"
                className="w-full border-white/30 bg-white/5 hover:bg-white/10 text-white font-medium h-12 text-base"
                size="lg"
              >
                <Mail className="mr-2 h-5 w-5" />
                Continue with Email
              </ActionButton>

              {/* Separator */}
              <div className="relative py-2">
                <Separator className="bg-white/10" />
              </div>

              {/* Continue as Guest - Less Visible */}
              <button
                onClick={handleGuestContinue}
                className="w-full text-center text-white/40 hover:text-white/60 text-xs font-normal py-2 transition-colors underline-offset-4 hover:underline"
              >
                Continue as guest
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

