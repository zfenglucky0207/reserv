"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Copy, Share2, MessageCircle, Instagram, Send, ExternalLink, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface PublishShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  publishedUrl: string
  hostSlug: string
  publicCode: string
  sessionId?: string // Session ID for preview navigation
  uiMode: "dark" | "light"
  title?: string // Optional custom title
  description?: string // Optional custom description
  hostName?: string | null // Host name for share text
  sessionStartAt?: string | null // Session start date for WhatsApp message
  sessionLocation?: string | null // Session location for WhatsApp message
  sessionSport?: string | null // Session sport for WhatsApp message
}

export function PublishShareSheet({
  open,
  onOpenChange,
  publishedUrl,
  hostSlug,
  publicCode,
  sessionId,
  uiMode,
  title = "Published 🎉",
  description = "Your invite link is ready. Share it with your group.",
  hostName,
  sessionStartAt,
  sessionLocation,
  sessionSport,
}: PublishShareSheetProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  
  // Generate WhatsApp message with session details
  const generateWhatsAppMessage = (): string => {
    const host = hostName || "your friend"
    const location = sessionLocation || "the venue"
    
    // Format sport label
    let sportLabel = "session"
    if (sessionSport) {
      const sportLower = sessionSport.toLowerCase()
      if (sportLower === "badminton") sportLabel = "badminton session"
      else if (sportLower === "pickleball") sportLabel = "pickleball session"
      else if (sportLower === "volleyball") sportLabel = "volleyball session"
      else if (sportLower === "futsal") sportLabel = "futsal session"
      else sportLabel = "sports session"
    }
    
    // Format day from start_at
    let dayText = ""
    if (sessionStartAt) {
      try {
        const startDate = new Date(sessionStartAt)
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const dayName = dayNames[startDate.getDay()]
        // Use short format like "Sat" for brevity, but could use full name
        const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        dayText = `this ${shortDayNames[startDate.getDay()]}`
      } catch (e) {
        dayText = "soon"
      }
    } else {
      dayText = "soon"
    }
    
    return `Join ${host} for a ${sportLabel} ${dayText} at ${location}!`
  }
  
  // Generate share text with host name invitation message (fallback for non-WhatsApp shares)
  const shareText = `${hostName || "Your host"} is inviting you to a session!`
  const whatsAppMessage = generateWhatsAppMessage()

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  const handleCopyLink = async () => {
    try {
      // Copy the share text with URL for better UX
      const textToCopy = `${shareText}\n${publishedUrl}`
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      toast({
        title: "Link copied",
        description: "Invite link copied to clipboard.",
        variant: "success",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleShare = async (platform?: "whatsapp" | "instagram" | "telegram" | "more") => {
    const shareData = {
      title: "Join my session",
      text: `${shareText}\n${publishedUrl}`,
      url: publishedUrl,
    }

    // Use Web Share API if available and no specific platform
    if (platform === "more" || !platform) {
      if (navigator.share) {
        try {
          await navigator.share(shareData)
          return
        } catch (error: any) {
          // User cancelled or error - fall through to copy
          if (error.name !== "AbortError") {
            console.error("Share failed:", error)
          }
        }
      }
      // Fallback: copy to clipboard
      await handleCopyLink()
      return
    }

    // Platform-specific handling
    if (platform === "whatsapp") {
      if (navigator.share) {
        try {
          await navigator.share(shareData)
          return
        } catch {
          // Fall through to deep link
        }
      }
      // WhatsApp deep link with custom message
      const whatsappText = `${whatsAppMessage}\n\n${publishedUrl}`
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`
      window.open(whatsappUrl, "_blank")
      return
    }

    if (platform === "instagram") {
      // Instagram doesn't have a direct share API, use Web Share if available
      if (navigator.share) {
        try {
          await navigator.share(shareData)
          return
        } catch {
          // Fall through
        }
      }
      toast({
        title: "Share via Instagram",
        description: "Use your system share menu to share to Instagram.",
        variant: "default",
      })
      // Still try to copy
      await handleCopyLink()
      return
    }

    if (platform === "telegram") {
      if (navigator.share) {
        try {
          await navigator.share(shareData)
          return
        } catch {
          // Fall through to deep link
        }
      }
      // Telegram deep link (use shareText without URL for text, URL separately)
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(publishedUrl)}&text=${encodeURIComponent(shareText)}`
      window.open(telegramUrl, "_blank")
      return
    }
  }

  const handleGoToPublishedLink = () => {
    onOpenChange(false)
    // Navigate to host preview mode instead of public route (avoids redirect loop)
    if (sessionId) {
      router.push(`/host/sessions/${sessionId}/edit?mode=preview`)
    } else {
      // Fallback to public route if sessionId not available
      router.push(`/${hostSlug}/${publicCode}`)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "max-h-[85vh] pb-safe",
          uiMode === "dark" ? "bg-slate-900 border-white/10 text-white" : "bg-white border-black/10 text-black"
        )}
        data-vaul-drawer-direction="bottom"
      >
        <DrawerHeader className="text-center">
          <DrawerTitle className={cn("text-2xl font-bold", uiMode === "dark" ? "text-white" : "text-black")}>
            {title}
          </DrawerTitle>
          <DrawerDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
            {description}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Link Preview Row */}
          <Card className={cn("p-4", glassCard)}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm truncate", uiMode === "dark" ? "text-white/80" : "text-black/80")}>
                  {publishedUrl}
                </p>
              </div>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className={cn(
                  "shrink-0 rounded-full",
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
            </div>
          </Card>

          {/* Share Section */}
          <div className="space-y-3">
            <h3 className={cn("text-sm font-medium", uiMode === "dark" ? "text-white/90" : "text-black/90")}>
              Share via
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {/* WhatsApp */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleShare("whatsapp")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors",
                  glassCard
                )}
              >
                <MessageCircle className="w-6 h-6" />
                <span className="text-xs font-medium">WhatsApp</span>
              </motion.button>

              {/* Instagram */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleShare("instagram")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors",
                  glassCard
                )}
              >
                <Instagram className="w-6 h-6" />
                <span className="text-xs font-medium">Instagram</span>
              </motion.button>

              {/* Telegram */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleShare("telegram")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors",
                  glassCard
                )}
              >
                <Send className="w-6 h-6" />
                <span className="text-xs font-medium">Telegram</span>
              </motion.button>

              {/* More */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleShare("more")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors",
                  glassCard
                )}
              >
                <Share2 className="w-6 h-6" />
                <span className="text-xs font-medium">More</span>
              </motion.button>
            </div>
          </div>
        </div>

        <DrawerFooter className="gap-3">
          {/* Primary CTA: Go to published link */}
          <Button
            onClick={handleGoToPublishedLink}
            className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full h-12 shadow-lg shadow-lime-500/20"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View invite
          </Button>

          {/* Secondary: Done */}
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className={cn(
              "w-full rounded-full h-12",
              uiMode === "dark"
                ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
            )}
          >
            Done
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

