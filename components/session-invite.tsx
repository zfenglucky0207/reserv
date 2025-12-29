"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { TopNav } from "./top-nav"
import { LoginDialog } from "./login-dialog"
import {
  Calendar,
  MapPin,
  DollarSign,
  Users,
  Upload,
  X,
  Copy,
  ChevronRight,
  Search,
  Check,
  ImageIcon,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { EditorBottomBar } from "./editor-bottom-bar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Default cover background colors by sport (when no cover image is set)
const DEFAULT_COVER_BG: Record<string, string> = {
  Badminton: "#ECFCCB",   // light green (lime-100, matches badminton lime green theme)
  Futsal: "#EAF2FF",      // light blue (matches futsal blue vibe)
  Volleyball: "#F3F4F6",  // light gray (clean neutral)
  Pickleball: "#FFF1E6",  // light orange/peach (matches pickleball orange vibe)
}

// Sport to cover image mapping
const SPORT_COVER_MAP: Record<string, { cyberpunk: string; ghibli: string }> = {
  Badminton: {
    cyberpunk: "/cyberpunk/badminton.png",
    ghibli: "/ghibli style/bird-badminton.png",
  },
  Pickleball: {
    cyberpunk: "/cyberpunk/pickleball.png",
    ghibli: "/ghibli style/bird-pickleball.png",
  },
  Volleyball: {
    cyberpunk: "/cyberpunk/volleyball.png",
    ghibli: "/ghibli style/bird-volleyball.png",
  },
  Futsal: {
    cyberpunk: "/cyberpunk/futsal.png",
    ghibli: "/ghibli style/bird-football.png",
  },
}

// Sport to theme mapping
const SPORT_THEME_MAP: Record<string, string> = {
  Badminton: "badminton",
  Pickleball: "pickleball",
  Volleyball: "clean", // Using clean theme for volleyball
  Futsal: "midnight", // Using midnight theme for futsal
}

const TITLE_FONTS = {
  Classic: "font-sans",
  Eclectic: "font-mono",
  Fancy: "font-serif",
  Literary: "font-serif italic",
}

interface SessionInviteProps {
  sessionId?: string
  initialCoverUrl?: string | null
  initialSport?: string | null
  initialEditMode?: boolean
  initialPreviewMode?: boolean
}

export function SessionInvite({
  sessionId,
  initialCoverUrl = null,
  initialSport = null,
  initialEditMode = true,
  initialPreviewMode = false,
}: SessionInviteProps) {
  console.log(`[SessionInvite] Render:`, { sessionId, initialCoverUrl, initialSport, initialEditMode, initialPreviewMode })
  
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { authUser, isAuthenticated } = useAuth()
  const [isEditMode, setIsEditMode] = useState(initialEditMode)
  const [isPreviewMode, setIsPreviewMode] = useState(initialPreviewMode)
  const [scrolled, setScrolled] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const { toast } = useToast()

  // UI Mode state (dark/light) with localStorage persistence
  // Always start with "dark" to match server render, then sync from localStorage on client
  const [uiMode, setUiMode] = useState<"dark" | "light">("dark")
  const [isUiModeHydrated, setIsUiModeHydrated] = useState(false)

  // Hydrate uiMode from localStorage on client mount (prevents hydration mismatch)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("reserv-ui-mode")
      if (saved === "light" || saved === "dark") {
        setUiMode(saved)
      }
      setIsUiModeHydrated(true)
    }
  }, [])

  // Persist uiMode to localStorage whenever it changes (after hydration)
  useEffect(() => {
    if (typeof window !== "undefined" && isUiModeHydrated) {
      localStorage.setItem("reserv-ui-mode", uiMode)
    }
  }, [uiMode, isUiModeHydrated])

  // Sync preview mode with URL query parameter
  useEffect(() => {
    if (isEditMode) {
      const mode = searchParams.get("mode")
      setIsPreviewMode(mode === "preview")
    }
  }, [searchParams, isEditMode])

  // Update URL when preview mode changes (only in edit mode)
  const handlePreviewModeChange = (isPreview: boolean) => {
    if (!isEditMode) return
    
    setIsPreviewMode(isPreview)
    const params = new URLSearchParams(searchParams.toString())
    if (isPreview) {
      params.set("mode", "preview")
    } else {
      params.delete("mode")
    }
    const queryString = params.toString()
    const newPath = queryString ? `${pathname}?${queryString}` : pathname
    router.replace(newPath, { scroll: false })
  }

  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false)
  // Pending cover selection in modal (not applied until Confirm is clicked)
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null)

  const [eventTitle, setEventTitle] = useState("Saturday Morning Smash")
  const [titleFont, setTitleFont] = useState<keyof typeof TITLE_FONTS>("Classic")
  const [eventDate, setEventDate] = useState("Sat, Jan 25 • 9:00 AM - 11:00 AM")
  const [eventLocation, setEventLocation] = useState("Victory Sports Complex, Court 3")
  const [eventPrice, setEventPrice] = useState(15)
  const [eventCapacity, setEventCapacity] = useState(8)
  const [hostName, setHostName] = useState<string | null>(null)
  const [hostNameInput, setHostNameInput] = useState("")
  const [isHostNameEditing, setIsHostNameEditing] = useState(false)
  const [isHostNameSaving, setIsHostNameSaving] = useState(false)
  // Initialize sport from prop or default to "Badminton"
  // Normalize to capitalized form for UI consistency
  const getSportDisplayName = (sport: string | null | undefined): string => {
    if (!sport) return "Badminton"
    const lower = sport.toLowerCase()
    if (lower === "badminton") return "Badminton"
    if (lower === "pickleball") return "Pickleball"
    if (lower === "volleyball") return "Volleyball"
    if (lower === "futsal" || lower === "other") return "Futsal"
    return "Badminton" // Default fallback
  }
  
  const [selectedSport, setSelectedSport] = useState(getSportDisplayName(initialSport))
  const [eventDescription, setEventDescription] = useState(
    "Join us for an energetic morning of badminton! All skill levels welcome. We'll have a rotation system so everyone gets to play. Bring your own racket or use one of ours.",
  )

  // Optimistic cover URL state - single source of truth for UI
  // null means use default gradient, string means use image URL
  const normalizedInitialCoverUrl = initialCoverUrl || null
  const [optimisticCoverUrl, setOptimisticCoverUrl] = useState<string | null>(normalizedInitialCoverUrl)
  const previousCoverUrlRef = useRef<string | null>(normalizedInitialCoverUrl) // For rollback on error
  const lastSyncedInitialCoverUrlRef = useRef<string | null>(normalizedInitialCoverUrl) // Track last synced prop value

  // Debug: Log when optimisticCoverUrl state changes
  useEffect(() => {
    console.log(`[SessionInvite] optimisticCoverUrl state changed:`, optimisticCoverUrl)
  }, [optimisticCoverUrl])

  // Initialize pendingCoverUrl when modal opens
  useEffect(() => {
    if (isCoverPickerOpen) {
      setPendingCoverUrl(optimisticCoverUrl)
    }
  }, [isCoverPickerOpen, optimisticCoverUrl])

  // Sync optimistic state when initialCoverUrl prop changes (e.g., after server refresh)
  // Only sync if the prop actually changed (to confirm DB update succeeded)
  useEffect(() => {
    const normalizedInitial = initialCoverUrl || null
    console.log(`[useEffect initialCoverUrl] initialCoverUrl=${normalizedInitial}, optimisticCoverUrl=${optimisticCoverUrl}, lastSynced=${lastSyncedInitialCoverUrlRef.current}`)
    
    // Only sync if initialCoverUrl actually changed from what we last synced
    // This confirms the DB update succeeded and router.refresh() brought back the new value
    if (normalizedInitial !== lastSyncedInitialCoverUrlRef.current) {
      console.log(`[useEffect initialCoverUrl] Syncing optimistic state: ${lastSyncedInitialCoverUrlRef.current} -> ${normalizedInitial}`)
      setOptimisticCoverUrl(normalizedInitial)
      lastSyncedInitialCoverUrlRef.current = normalizedInitial
      previousCoverUrlRef.current = normalizedInitial // Update rollback ref too
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCoverUrl])

  // Get cover options for current sport
  const getCoverOptions = () => {
    const sportCovers = SPORT_COVER_MAP[selectedSport] || SPORT_COVER_MAP["Badminton"]
    return [
      { id: "cyberpunk", label: "Cyberpunk", path: sportCovers.cyberpunk },
      { id: "ghibli", label: "Ghibli Style", path: sportCovers.ghibli },
    ]
  }

  // Update cover with optimistic UI and persistence
  const updateCover = React.useCallback(async (coverUrl: string | null, reopenModalOnError = false) => {
    console.log(`[updateCover] Called with:`, { coverUrl, sessionId, reopenModalOnError })
    
    // Store previous for rollback using functional update to get current value
    const wasModalOpen = isCoverPickerOpen
    
    // Immediately update UI (optimistic)
    setOptimisticCoverUrl((prev) => {
      console.log(`[updateCover] Previous cover: ${prev}, New cover: ${coverUrl}`)
      previousCoverUrlRef.current = prev
      return coverUrl
    })
    setIsCoverPickerOpen(false)

    // If no sessionId, just update local state (for new sessions)
    if (!sessionId || sessionId === "new" || sessionId === "edit") {
      console.log(`[updateCover] No sessionId, skipping DB update`)
      toast({
        title: "Cover updated",
        description: "Cover will be saved when you publish the session.",
        variant: "success",
      })
      return
    }

    try {
      console.log(`[updateCover] Calling updateSessionCoverUrl server action...`)
      // Persist to database (coverUrl can be null for default color)
      const { updateSessionCoverUrl } = await import("@/app/host/sessions/[id]/actions")
      const result = await updateSessionCoverUrl(sessionId, coverUrl)
      console.log(`[updateCover] Server action result:`, result)

      // Success: keep optimistic state, refresh server components
      toast({
        title: "Cover updated",
        description: "Session cover image has been changed.",
        variant: "success",
      })
      
      // Refresh to sync server components (but UI is already updated optimistically)
      console.log(`[updateCover] Calling router.refresh()...`)
      router.refresh()
    } catch (error: any) {
      console.error(`[updateCover] Error:`, error)
      // Error: revert optimistic state
      setOptimisticCoverUrl(previousCoverUrlRef.current || null)
      // Only reopen modal if it was explicitly opened by user (not from sport change)
      if (reopenModalOnError && wasModalOpen) {
        setIsCoverPickerOpen(true)
      }
      toast({
        title: "Update failed",
        description: error?.message || "Failed to update cover. Please try again.",
        variant: "destructive",
      })
    }
  }, [sessionId, router, toast, isCoverPickerOpen])

  // Handle confirm button click in cover picker modal
  const handleCoverConfirm = () => {
    updateCover(pendingCoverUrl, false)
  }

  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentQrImage, setPaymentQrImage] = useState<string | null>(null)
  const [proofImage, setProofImage] = useState<string | null>(null) // For payment proof in preview mode

  const [theme, setTheme] = useState("badminton")
  const [effects, setEffects] = useState({
    grain: true,
    glow: false,
    vignette: true,
  })

  // Handle sport change - only update sport and theme, NOT cover
  const handleSportChange = (sport: string) => {
    console.log(`[handleSportChange] Changing sport to: ${sport}, current optimisticCoverUrl: ${optimisticCoverUrl}`)
    setSelectedSport(sport)
    // Update theme based on sport
    const newTheme = SPORT_THEME_MAP[sport] || "badminton"
    setTheme(newTheme)
    // DO NOT update cover - let the default background color update automatically
    // If user has selected a cover image, it will remain. If not, the background color will change.
    toast({
      title: "Sport updated",
      description: `Changed to ${sport} with ${newTheme} theme.`,
      variant: "success",
    })
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem("reserv-theme")
    const savedEffects = localStorage.getItem("reserv-effects")
    if (savedTheme) setTheme(savedTheme)
    if (savedEffects) setEffects(JSON.parse(savedEffects))
  }, [])

  useEffect(() => {
    localStorage.setItem("reserv-theme", theme)
    localStorage.setItem("reserv-effects", JSON.stringify(effects))
  }, [theme, effects])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [eventDescription, isEditMode, isPreviewMode])

  const suggestedDates = [
    "Sat, Jan 25 • 9:00 AM - 11:00 AM",
    "Sat, Jan 25 • 2:00 PM - 4:00 PM",
    "Sun, Jan 26 • 9:00 AM - 11:00 AM",
    "Sun, Jan 26 • 3:00 PM - 5:00 PM",
  ]

  const suggestedLocations = [
    "Victory Sports Complex, Court 3",
    "Setapak Sports Complex, Hall A",
    "KL Badminton Centre, Court 5",
    "Bukit Jalil Sports Arena",
  ]

  const handleDateSave = (date: string) => {
    setEventDate(date)
    setIsDateModalOpen(false)
    toast({
      title: "Date updated",
      description: "Session date and time have been saved.",
      variant: "success",
    })
  }

  const handleLocationSave = (location: string) => {
    setEventLocation(location)
    setIsLocationModalOpen(false)
    toast({
      title: "Location updated",
      description: "Session location has been saved.",
      variant: "success",
    })
  }


  const handlePaymentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPaymentQrImage(reader.result as string)
        toast({
          title: "Image uploaded",
          description: "Payment QR code has been uploaded.",
          variant: "success",
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProofImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProofImage(reader.result as string)
        toast({
          title: "Image uploaded",
          description: "Payment proof has been uploaded.",
          variant: "success",
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCostBlur = () => {
    toast({
      title: "Updated",
      description: "Cost per person has been updated.",
      variant: "success",
    })
  }

  const handleSpotsBlur = () => {
    toast({
      title: "Updated",
      description: "Spots count has been updated.",
      variant: "success",
    })
  }

  // Get user's profile name (fallback to email prefix)
  const getUserProfileName = () => {
    if (!authUser) return null
    const fullName = authUser.user_metadata?.full_name
    if (fullName) return fullName
    const email = authUser.email || ""
    return email.split("@")[0]
  }

  // Computed host name: session hostName ?? user profileName
  const displayHostName = hostName ?? getUserProfileName() ?? "Host"

  // Initialize hostName input value
  useEffect(() => {
    if (!isHostNameEditing) {
      setHostNameInput(displayHostName)
    }
  }, [displayHostName, isHostNameEditing])

  // Update hostName handler
  const handleHostNameSave = async () => {
    setIsHostNameEditing(false)
    
    // Trim and validate
    const trimmedValue = hostNameInput.trim()
    const finalValue = trimmedValue.length > 0 ? trimmedValue : null
    
    // If empty after trim, use user profile name (don't save to session)
    if (!finalValue) {
      setHostNameInput(getUserProfileName() ?? "Host")
      // Reset to null so it falls back to user profile name
      if (hostName !== null) {
        await saveHostName(null)
      }
      return
    }

    // If value hasn't changed, don't save
    if (finalValue === hostName) {
      setHostNameInput(finalValue)
      return
    }

    // Save new value
    await saveHostName(finalValue)
  }

  const saveHostName = async (newHostName: string | null) => {
    setIsHostNameSaving(true)
    
    try {
      // Get session ID from pathname
      // Pathname could be: /host/sessions/[id]/edit or /s/[code]
      let sessionId: string | undefined
      
      if (pathname.includes("/host/sessions/")) {
        // Extract ID from /host/sessions/[id]/edit
        const parts = pathname.split("/")
        const sessionsIndex = parts.indexOf("sessions")
        if (sessionsIndex >= 0 && parts[sessionsIndex + 1]) {
          sessionId = parts[sessionsIndex + 1]
        }
      } else if (pathname.startsWith("/s/")) {
        // Extract code from /s/[code]
        sessionId = pathname.split("/").pop()
      }
      
      if (!sessionId || sessionId === "new" || sessionId === "edit") {
        // For new sessions, just update local state without saving to DB
        setHostName(newHostName)
    toast({
          title: "Host name updated",
          description: "Host name will be saved when you publish the session.",
          variant: "success",
        })
        return
      }

      // Dynamically import server action to handle the [id] route pattern
      const { updateSessionHostName } = await import("@/app/host/sessions/[id]/actions")
      await updateSessionHostName(sessionId, newHostName)
      
      // Update local state
      setHostName(newHostName)
      
      toast({
        title: "Host name updated",
        description: "Host name has been saved successfully.",
        variant: "success",
      })
    } catch (error: any) {
      // Revert on error
      setHostNameInput(displayHostName)
      toast({
        title: "Update failed",
        description: error?.message || "Failed to update host name. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsHostNameSaving(false)
    }
  }

  const handleHostNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleHostNameSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setIsHostNameEditing(false)
      setHostNameInput(displayHostName)
    }
  }

  const handleHostNameFocus = () => {
    setIsHostNameEditing(true)
    setHostNameInput(displayHostName)
  }

  // Handle publish with auth gating
  const handlePublish = async () => {
    if (!isAuthenticated) {
      // Store intent to publish after login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_publish", "true")
      }
      setLoginDialogOpen(true)
      return
    }

    // User is authenticated, proceed with publish
    try {
      // TODO: Implement actual publish API call here
      // For now, simulate success
      const inviteLink = `${window.location.origin}/s/${pathname.split("/").pop() || "demo"}`
      
      // Copy to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteLink)
      }
      
      toast({
        title: "Published!",
        description: "Your session has been published and the invite link has been copied to your clipboard.",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Publish failed",
        description: "Failed to publish session. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSaveDraft = () => {
    // TODO: Implement save draft functionality
    toast({
      title: "Draft saved",
      description: "Your changes have been saved as a draft.",
      variant: "success",
    })
  }

  const handleLoginSuccess = () => {
    setLoginDialogOpen(false)
    // The useEffect will handle the pending publish
  }

  // Reusable class tokens based on uiMode
  const glassCard = uiMode === "dark" 
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm" 
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"
  
  const glassPill = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"
  
  const mutedText = uiMode === "dark" ? "text-white/70" : "text-black/60"
  const strongText = uiMode === "dark" ? "text-white/90" : "text-black/90"
  const inputBg = uiMode === "dark" ? "bg-white/5" : "bg-black/5"
  const inputBorder = uiMode === "dark" ? "border-white/10" : "border-black/10"
  const inputPlaceholder = uiMode === "dark" ? "placeholder:text-white/30" : "placeholder:text-black/40"

  return (
    <div
      className={`min-h-screen ${uiMode === "dark" 
        ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" 
        : "bg-white text-black"}`}
      data-ui={uiMode}
      data-theme={theme}
      data-effect-grain={effects.grain}
      data-effect-glow={effects.glow}
      data-effect-vignette={effects.vignette}
    >
      {/* Top Navigation - only show in edit mode */}
      {isEditMode && <TopNav showCreateNow={false} />}

      {effects.grain && (
        <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.015] mix-blend-overlay">
          <svg className="w-full h-full">
            <filter id="noiseFilter">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
          </svg>
        </div>
      )}
      {effects.vignette && (
        <div
          className="fixed inset-0 pointer-events-none z-[99]"
          style={{
            background: "radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.2) 100%)",
          }}
        />
      )}

      {/* Preview Bar - sticky below TopNav */}
      <AnimatePresence>
        {isPreviewMode && (
          <motion.div
            key="previewbar"
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="sticky top-14 z-40 bg-lime-500/90 text-black px-4 py-2 flex items-center justify-between"
          >
            <span className="font-medium text-xs">Previewing as participant</span>
            <Button
              onClick={() => handlePreviewModeChange(false)}
              size="sm"
              className="bg-black hover:bg-black/80 text-white h-7 text-xs px-3"
            >
              Back to edit
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Hero Section */}
      <LayoutGroup>
      <div className="relative">
        {/* Hero Card with Full-Height Immersive Background */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative min-h-[85vh] overflow-hidden"
        >
            {/* Background Image or Default Color */}
            {(() => {
              const hasCustomCover = Boolean(optimisticCoverUrl)
              if (hasCustomCover) {
                // User has selected a cover image - show it
                return (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${encodeURI(optimisticCoverUrl!)}")`,
                    }}
                  />
                )
              } else {
                // No custom cover - show sport-specific default color
                return (
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: DEFAULT_COVER_BG[selectedSport] ?? "#FFFFFF" }}
                  />
                )
              }
            })()}

          {effects.glow && (
            <div className="absolute inset-0 bg-gradient-radial from-[var(--theme-accent)]/20 via-transparent to-transparent" />
          )}

            {/* Gradient Overlay - Lighter for better visibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/60" />

            {/* Scroll Cue - Only show in preview/public mode when not scrolled */}
            {(!isEditMode || isPreviewMode) && !scrolled && (
              <motion.div
                className="absolute left-0 right-0 bottom-24 z-20 flex justify-center pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    y: [0, 10, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="bg-black/30 backdrop-blur-sm rounded-full p-2 border border-white/20"
                >
                  <ChevronDown className="w-10 h-10 sm:w-12 sm:h-12 text-white/90" />
                </motion.div>
              </motion.div>
            )}

          {/* Content */}
            <motion.div
              layout
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`relative z-10 flex flex-col min-h-[85vh] px-6 pb-8 ${
                isEditMode && !isPreviewMode ? "pt-16" : "pt-24"
              }`}
            >
            <div className="flex-1 flex flex-col justify-between">
              {/* Top Section */}
                <motion.div layout transition={{ duration: 0.22, ease: "easeOut" }}>
                <motion.div
                    layout
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex items-center justify-between mb-4"
                >
                  {isEditMode && !isPreviewMode ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="bg-[var(--theme-accent)]/20 text-[var(--theme-accent-light)] border border-[var(--theme-accent)]/30 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 focus:outline-none focus:ring-0"
                        >
                          {selectedSport}
                          <ChevronDown className="w-3 h-3" />
                        </motion.button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-black/90 backdrop-blur-xl border-white/10">
                        <DropdownMenuItem
                          onClick={() => handleSportChange("Badminton")}
                          className="text-white focus:bg-[var(--theme-accent)]/20 focus:text-[var(--theme-accent-light)]"
                        >
                          Badminton
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSportChange("Pickleball")}
                          className="text-white focus:bg-[var(--theme-accent)]/20 focus:text-[var(--theme-accent-light)]"
                        >
                          Pickleball
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSportChange("Volleyball")}
                          className="text-white focus:bg-[var(--theme-accent)]/20 focus:text-[var(--theme-accent-light)]"
                        >
                          Volleyball
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSportChange("Futsal")}
                          className="text-white focus:bg-[var(--theme-accent)]/20 focus:text-[var(--theme-accent-light)]"
                        >
                          Futsal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge className="bg-[var(--theme-accent)]/20 text-[var(--theme-accent-light)] border-[var(--theme-accent)]/30 px-3 py-1.5 text-xs font-medium">
                      {selectedSport}
                    </Badge>
                  )}

                  {isEditMode && !isPreviewMode && (
                    <motion.button
                      onClick={() => setIsCoverPickerOpen(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className={`${glassPill} px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 focus:outline-none focus:ring-0`}
                    >
                      <Upload className="w-3 h-3" />
                      Change cover
                    </motion.button>
                  )}
                </motion.div>

                  <motion.div
                    layout
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-6"
                  >
                    <motion.div
                      layout
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="space-y-4"
                    >
                    {isEditMode && !isPreviewMode ? (
                      <div className="space-y-3">
                        <div className={`${uiMode === "dark" ? "bg-white/5 border-white/10" : "bg-white/70 border-black/10"} backdrop-blur-sm rounded-2xl p-4`}>
                          <input
                            type="text"
                            value={eventTitle}
                            onChange={(e) => setEventTitle(e.target.value)}
                          className={`bg-transparent border-none text-4xl font-bold ${uiMode === "dark" ? "text-white" : "text-black"} w-full focus:outline-none focus:ring-0 p-0 text-center ${TITLE_FONTS[titleFont]}`}
                          placeholder="Event title"
                          />
                        </div>
                        {/* Font picker */}
                        <div className="flex items-center justify-center gap-2">
                          {(Object.keys(TITLE_FONTS) as Array<keyof typeof TITLE_FONTS>).map((font) => (
                            <button
                              key={font}
                              onClick={() => setTitleFont(font)}
                              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all focus:outline-none focus:ring-0 ${
                                titleFont === font
                                  ? uiMode === "dark"
                                    ? "bg-white/10 text-[var(--theme-accent-light)] border border-[var(--theme-accent)]/40"
                                    : "bg-white/70 text-[var(--theme-accent-light)] border border-[var(--theme-accent)]/40"
                                  : uiMode === "dark"
                                    ? "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                                    : "bg-white/70 text-black/70 border border-black/10 hover:bg-white/80"
                              }`}
                            >
                              {font}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <motion.h1
                        layout
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className={`text-4xl font-bold ${uiMode === "dark" ? "text-black" : "text-white"} ${isPreviewMode ? "text-left" : "text-center"} ${TITLE_FONTS[titleFont]}`}
                      >
                        {eventTitle}
                      </motion.h1>
                    )}

                    {isEditMode && !isPreviewMode ? (
                      <>
                        <div className="space-y-3">
                          {/* Date & Time Button */}
                          <motion.button
                            onClick={() => setIsDateModalOpen(true)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={`w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 text-left min-h-[54px] focus:outline-none focus:ring-0`}
                          >
                            <Calendar className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Date & Time</p>
                              <p className={`${strongText} font-medium`}>{eventDate}</p>
                            </div>
                            <ChevronRight className={`w-5 h-5 ${uiMode === "dark" ? "text-white/40" : "text-black/40"} flex-shrink-0`} />
                          </motion.button>

                          {/* Location Button */}
                          <motion.button
                            onClick={() => setIsLocationModalOpen(true)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={`w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 text-left min-h-[54px] focus:outline-none focus:ring-0`}
                          >
                            <MapPin className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Location</p>
                              <p className={`${strongText} font-medium`}>{eventLocation}</p>
                            </div>
                            <ChevronRight className={`w-5 h-5 ${uiMode === "dark" ? "text-white/40" : "text-black/40"} flex-shrink-0`} />
                          </motion.button>

                          <motion.div
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={`w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 min-h-[54px]`}
                          >
                            <DollarSign className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Cost per person</p>
                              <div className="flex items-center gap-1.5">
                                <span className={`${strongText} font-medium`}>$</span>
                                <input
                                  type="number"
                                  value={eventPrice}
                                  onChange={(e) => setEventPrice(Number(e.target.value))}
                                  onBlur={handleCostBlur}
                                  min={0}
                                  step={1}
                                  className={`bg-transparent border-none ${strongText} font-medium w-16 focus:outline-none focus:ring-0 p-0`}
                                />
                                <span className={`${strongText} font-medium`}>per person</span>
                              </div>
                            </div>
                          </motion.div>

                          <motion.div
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={`w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 min-h-[54px]`}
                          >
                            <Users className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Spots</p>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={eventCapacity}
                                  onChange={(e) => setEventCapacity(Number(e.target.value))}
                                  onBlur={handleSpotsBlur}
                                  min={1}
                                  step={1}
                                  className={`bg-transparent border-none ${strongText} font-medium w-16 focus:outline-none focus:ring-0 p-0`}
                                />
                                <span className={`${strongText} font-medium`}>spots available</span>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </>
                    ) : (
                      /* Preview mode shows regular text display */
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Calendar className={`w-5 h-5 ${uiMode === "dark" ? "text-black/60" : "text-white/60"} mt-0.5`} />
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"}`}>{eventDate}</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className={`w-5 h-5 ${uiMode === "dark" ? "text-black/60" : "text-white/60"} mt-0.5`} />
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"}`}>{eventLocation}</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <DollarSign className={`w-5 h-5 ${uiMode === "dark" ? "text-black/60" : "text-white/60"} mt-0.5`} />
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"}`}>${eventPrice} per person</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <Users className={`w-5 h-5 ${uiMode === "dark" ? "text-black/60" : "text-white/60"} mt-0.5`} />
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"}`}>{eventCapacity} spots total</p>
                        </div>
                      </div>
                    )}
                    </motion.div>

                    <motion.div
                      layout
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="flex items-center gap-3 pt-2"
                    >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)]" />
                    <div>
                        <p className={`text-xs ${uiMode === "dark" ? "text-black/70" : "text-white/70"} uppercase tracking-wide`}>Hosted by</p>
                      {isEditMode && !isPreviewMode ? (
                        <input
                          type="text"
                            value={hostNameInput}
                            onChange={(e) => {
                              const value = e.target.value
                              if (value.length <= 40) {
                                setHostNameInput(value)
                              }
                            }}
                            onFocus={handleHostNameFocus}
                            onBlur={handleHostNameSave}
                            onKeyDown={handleHostNameKeyDown}
                            disabled={isHostNameSaving}
                            maxLength={40}
                            className="bg-transparent border-none border-b border-transparent text-white font-medium focus:outline-none focus:ring-0 focus:border-b focus:border-white/30 p-0 transition-colors disabled:opacity-50 min-w-[80px]"
                            placeholder={getUserProfileName() ?? "Host"}
                        />
                      ) : (
                          <p className={`font-medium ${uiMode === "dark" ? "text-black" : "text-white"}`}>{displayHostName}</p>
                      )}
                    </div>
                    </motion.div>
                  </motion.div>

                  {isEditMode && !isPreviewMode && (
                    <div className="flex flex-col gap-2 pt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className={`${uiMode === "dark" ? "bg-white/10 border-white/20 text-white" : "bg-white/70 border-black/10 text-black"} backdrop-blur-sm px-4 py-3 rounded-full text-sm font-medium flex items-center justify-center gap-2 focus:outline-none focus:ring-0`}
                      >
                        <Copy className="w-4 h-4" />
                        Copy invite link
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="bg-red-500/20 border border-red-500/30 text-red-100 backdrop-blur-sm px-4 py-3 rounded-full text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Close session
                      </motion.button>
                    </div>
                  )}
                </motion.div>
          </div>
            </motion.div>
        </motion.div>

          <motion.div
            layout
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="px-6 pt-8 pb-32 space-y-4"
          >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className={`${glassCard} p-6`}>
              <h2 className={`text-lg font-semibold ${strongText} mb-3`}>About this session</h2>
              {isEditMode && !isPreviewMode ? (
                <textarea
                  ref={textareaRef}
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className={`${inputBg} ${inputBorder} ${inputPlaceholder} rounded-lg p-3 ${strongText} text-sm leading-relaxed w-full focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/50 resize-none overflow-hidden`}
                  rows={1}
                />
              ) : (
                <p className={`${mutedText} text-sm leading-relaxed`}>{eventDescription}</p>
              )}
            </Card>
          </motion.div>

          {(!isEditMode || isPreviewMode) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className={`${glassCard} p-6`}>
                <h2 className={`text-lg font-semibold ${strongText} mb-3`}>Location</h2>
                <p className={`${mutedText} text-sm mb-4`}>{eventLocation}</p>
                <div className="w-full h-48 rounded-lg overflow-hidden bg-slate-800">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.2!2d-73.98!3d40.75!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQ1JzAwLjAiTiA3M8KwNTgnNDguMCJX!5e0!3m2!1sen!2sus!4v1234567890"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </Card>
            </motion.div>
          )}

          {(!isEditMode || isPreviewMode) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card className={`${glassCard} p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${strongText}`}>Going</h2>
                  <Badge className="bg-[var(--theme-accent)]/20 text-[var(--theme-accent-light)] border-[var(--theme-accent)]/30">
                    5 / {eventCapacity}
                  </Badge>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-2 min-w-[80px]"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] p-0.5">
                          <div className="w-full h-full rounded-full bg-slate-900" />
                        </div>
                      </div>
                      <span className={`text-xs ${mutedText} text-center`}>User {i}</span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {isEditMode && !isPreviewMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className={`${glassCard} p-6`}>
                <h2 className={`text-lg font-semibold ${strongText} mb-4`}>Payment details</h2>

                {/* Upload QR Section */}
                <div className="mb-6">
                  <label className={`text-sm ${mutedText} mb-2 block`}>Upload QR Code</label>
                  {paymentQrImage ? (
                    <div className="relative">
                      <img
                        src={paymentQrImage || "/placeholder.svg"}
                        alt="Payment QR"
                        className="w-full max-w-[200px] rounded-lg"
                      />
                      <button
                        onClick={() => setPaymentQrImage(null)}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-[var(--theme-accent)]/50 transition-colors cursor-pointer block">
                      <input type="file" accept="image/*" onChange={handlePaymentImageUpload} className="hidden" />
                      <ImageIcon className="w-8 h-8 text-white/40 mx-auto mb-2" />
                      <p className="text-sm text-white/60">Upload Touch 'n Go / Maybank QR</p>
                      <p className="text-xs text-white/40 mt-1">or bank transfer screenshot</p>
                    </label>
                  )}
                </div>

                {/* Bank Details */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-white/70 mb-1.5 block">Bank Name</label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Maybank"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-[var(--theme-accent)]/50"
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${mutedText} mb-1.5 block`}>Account Number</label>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="1234567890"
                      className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50`}
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${mutedText} mb-1.5 block`}>Account Name</label>
                    <Input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Your name"
                      className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50`}
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${mutedText} mb-1.5 block`}>Instructions (optional)</label>
                    <Textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="e.g. Please include your name in the transfer notes"
                      className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50 min-h-[80px]`}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {(!isEditMode || isPreviewMode) && (bankName || accountNumber || accountName || paymentQrImage) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className={`${glassCard} p-6`}>
                <h2 className={`text-lg font-semibold ${strongText} mb-4`}>Payment details</h2>

                {paymentQrImage && (
                  <div className="mb-4">
                    <img
                      src={paymentQrImage || "/placeholder.svg"}
                      alt="Payment QR"
                      className="w-full max-w-[200px] rounded-lg mx-auto"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {bankName && (
                    <div>
                      <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Bank Name</p>
                      <p className={`${strongText} font-medium`}>{bankName}</p>
                    </div>
                  )}
                  {accountNumber && (
                    <div>
                      <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Account Number</p>
                      <p className={`${strongText} font-medium`}>{accountNumber}</p>
                    </div>
                  )}
                  {accountName && (
                    <div>
                      <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Account Name</p>
                      <p className={`${strongText} font-medium`}>{accountName}</p>
                    </div>
                  )}
                  {paymentNotes && (
                    <div>
                      <p className={`text-xs ${mutedText} uppercase tracking-wide`}>Instructions</p>
                      <p className={`${mutedText} text-sm`}>{paymentNotes}</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {(!isEditMode || isPreviewMode) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className={`${glassCard} p-6`}>
                <h2 className={`text-lg font-semibold ${strongText} mb-3`}>Upload payment proof</h2>
                <p className={`text-sm ${mutedText} mb-4`}>
                  Please upload your payment confirmation to secure your spot.
                </p>
                {proofImage ? (
                  <div className="relative">
                    <img src={proofImage || "/placeholder.svg"} alt="Payment proof" className="w-full rounded-lg" />
                    <button
                      onClick={() => setProofImage(null)}
                      className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-[var(--theme-accent)]/50 transition-colors cursor-pointer block">
                    <input type="file" accept="image/*" onChange={handleProofImageUpload} className="hidden" />
                    <Upload className="w-8 h-8 text-white/40 mx-auto mb-2" />
                    <p className="text-sm text-white/60">Click to upload or drag and drop</p>
                    <p className="text-xs text-white/40 mt-1">Screenshot or photo</p>
                  </label>
                )}
              </Card>
            </motion.div>
          )}
          </motion.div>
        </div>
      </LayoutGroup>

      <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Set a date</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {suggestedDates.map((date) => (
              <motion.button
                key={date}
                onClick={() => handleDateSave(date)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-left flex items-center justify-between group"
              >
                <span className="text-white/90">{date}</span>
                {eventDate === date && <Check className="w-5 h-5 text-[var(--theme-accent-light)]" />}
              </motion.button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Search location</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                placeholder="Search for a location..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 pl-10 focus:ring-[var(--theme-accent)]/50"
              />
            </div>
            <div className="space-y-2">
              {suggestedLocations.map((location) => (
                <motion.button
                  key={location}
                  onClick={() => handleLocationSave(location)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[var(--theme-accent-light)]" />
                    <span className="text-white/90">{location}</span>
                  </div>
                  {eventLocation === location && <Check className="w-5 h-5 text-[var(--theme-accent-light)]" />}
                </motion.button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCoverPickerOpen} onOpenChange={setIsCoverPickerOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md p-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-3">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Choose a cover</DialogTitle>
              <p className="text-sm text-white/60 mt-1">Select a style for {selectedSport}</p>
            </DialogHeader>
          </div>

          {/* Scrollable options */}
          <div className="px-6 pb-28 overflow-y-auto max-h-[70vh]">
            <div className="mt-4 flex flex-col gap-4">
              {/* Default color option (first) */}
              <motion.button
                onClick={() => setPendingCoverUrl(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all focus:outline-none focus:ring-0 ${
                  pendingCoverUrl === null
                    ? "border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/50"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: DEFAULT_COVER_BG[selectedSport] ?? "#FFFFFF" }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-sm">Default color</span>
                    {pendingCoverUrl === null && (
                      <div className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-[var(--theme-accent-light)]" />
                        <span className="text-xs text-[var(--theme-accent-light)] font-medium">Selected</span>
                      </div>
                    )}
                  </div>
                </div>
                {pendingCoverUrl === null && (
                  <div className="absolute inset-0 bg-[var(--theme-accent)]/10 flex items-center justify-center pointer-events-none">
                    <div className="absolute top-3 right-3 bg-[var(--theme-accent)] rounded-full p-1.5">
                      <Check className="w-4 h-4 text-black" />
                    </div>
                  </div>
                )}
              </motion.button>

              {/* Image cover options */}
              {getCoverOptions().map((option) => (
                <motion.button
                  key={option.id}
                  onClick={() => setPendingCoverUrl(option.path)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all focus:outline-none focus:ring-0 ${
                    pendingCoverUrl === option.path
                      ? "border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/50"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img
                    src={option.path || "/placeholder.svg"}
                    alt={option.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">{option.label}</span>
                      {pendingCoverUrl === option.path && (
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-[var(--theme-accent-light)]" />
                          <span className="text-xs text-[var(--theme-accent-light)] font-medium">Selected</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {pendingCoverUrl === option.path && (
                    <div className="absolute inset-0 bg-[var(--theme-accent)]/10 flex items-center justify-center pointer-events-none">
                      <div className="absolute top-3 right-3 bg-[var(--theme-accent)] rounded-full p-1.5">
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-slate-900/95 backdrop-blur px-6 py-4">
            <Button
              onClick={handleCoverConfirm}
              disabled={pendingCoverUrl === optimisticCoverUrl}
              className="w-full rounded-full h-12 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium shadow-lg shadow-lime-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor Bottom Bar - Edit mode only */}
      <AnimatePresence>
      {isEditMode && !isPreviewMode && (
          <motion.div
            key="editorbar"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
        <EditorBottomBar
          onPreview={() => handlePreviewModeChange(true)}
          onPublish={handlePublish}
          onSaveDraft={handleSaveDraft}
          theme={theme}
          onThemeChange={setTheme}
              uiMode={uiMode}
              onUiModeChange={setUiMode}
        />
          </motion.div>
      )}
      </AnimatePresence>

      {/* Login Dialog for publish gating */}
      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onContinueAsGuest={handleLoginSuccess}
      />

      {/* Sticky RSVP Dock - Only show in preview mode or when not in edit mode */}
      <AnimatePresence>
      {(!isEditMode || isPreviewMode) && (
        <motion.div
            key="rsvpdock"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-40 pb-safe"
        >
          <div className="mx-auto max-w-md px-4 pb-4">
            <div className={`${glassCard} rounded-2xl p-4 shadow-2xl flex gap-3`}>
              <Button className="flex-1 bg-gradient-to-r from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] hover:from-[var(--theme-accent)] hover:to-[var(--theme-accent-dark)] text-black font-medium rounded-full h-12 shadow-lg shadow-[var(--theme-accent)]/20">
                Join session
              </Button>
              <Button
                variant="outline"
                className={`flex-1 bg-transparent ${uiMode === "dark" ? "border-white/20 text-white hover:bg-white/10" : "border-black/20 text-black hover:bg-black/10"} rounded-full h-12`}
              >
                Decline
              </Button>
              {/* Light/Dark toggle for preview mode */}
              {isPreviewMode && (
                <button
                  onClick={() => setUiMode(uiMode === "dark" ? "light" : "dark")}
                  className={`w-12 h-12 rounded-full ${glassPill} flex items-center justify-center transition-colors`}
                  aria-label={uiMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {uiMode === "dark" ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
