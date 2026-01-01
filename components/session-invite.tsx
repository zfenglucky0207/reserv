"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
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
  ChevronRight,
  Search,
  Check,
  ImageIcon,
  ChevronDown,
  Sun,
  Moon,
  ArrowLeft,
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
import { MobileCalendar } from "@/components/ui/mobile-calendar"
import { TimePickerWheels } from "@/components/ui/time-picker-wheels"
import { DraftNameDialog } from "@/components/drafts/draft-name-dialog"
import { DraftsDialog } from "@/components/drafts/drafts-dialog"
import type { DraftData, DraftSummary } from "@/app/actions/drafts"
import { listDrafts, saveDraft, getDraft, deleteDraft, overwriteDraft } from "@/app/actions/drafts"
import { PublishShareSheet } from "@/components/publish-share-sheet"
import { HostSessionAnalytics } from "@/components/host/host-session-analytics"
import { CopyInviteLinkButton } from "@/components/common/copy-invite-link-button"

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

interface DemoParticipant {
  name: string
  avatar: string | null
}

interface SessionInviteProps {
  sessionId?: string
  initialCoverUrl?: string | null
  initialSport?: string | null
  initialEditMode?: boolean
  initialPreviewMode?: boolean
  initialTitle?: string | null
  initialDate?: string | null
  initialLocation?: string | null
  initialPrice?: number | null
  initialCapacity?: number | null
  initialHostName?: string | null
  initialDescription?: string | null
  demoMode?: boolean
  demoParticipants?: DemoParticipant[]
  hidePreviewBanner?: boolean // New prop to hide preview banner for public view
  onJoinClick?: () => void // RSVP handler for public view
  onDeclineClick?: () => void // RSVP handler for public view
  initialIsPublished?: boolean // New prop to indicate if session is published
  initialSessionStatus?: "draft" | "open" | "closed" | "completed" | "cancelled" // Session status for draft update logic
  rsvpState?: "none" | "joined" | "declined" // Current RSVP state for public view
}

export function SessionInvite({
  sessionId,
  initialCoverUrl = null,
  initialSport = null,
  initialEditMode = true,
  initialPreviewMode = false,
  initialTitle = null,
  initialDate = null,
  initialLocation = null,
  initialPrice = null,
  initialCapacity = null,
  initialHostName = null,
  initialDescription = null,
  demoMode = false,
  demoParticipants = [],
  hidePreviewBanner = false,
  onJoinClick,
  onDeclineClick,
  initialIsPublished = false,
  initialSessionStatus,
  rsvpState = "none",
}: SessionInviteProps) {
  console.log(`[SessionInvite] Render:`, { sessionId, initialCoverUrl, initialSport, initialEditMode, initialPreviewMode })
  
  // Detect if this is an empty/new session
  const isEmptySession = !sessionId || sessionId === "new" || sessionId === "edit"
  
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { authUser, isAuthenticated } = useAuth()
  const [isEditMode, setIsEditMode] = useState(initialEditMode)
  const [isPreviewMode, setIsPreviewMode] = useState(initialPreviewMode)
  const [isPublished, setIsPublished] = useState(initialIsPublished)
  const [sessionStatus, setSessionStatus] = useState<"draft" | "open" | "closed" | "completed" | "cancelled" | undefined>(initialSessionStatus)
  const [actualSessionId, setActualSessionId] = useState<string | undefined>(sessionId) // Store actual session ID (may be updated after creation)
  const [scrolled, setScrolled] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  
  // Sync initialEditMode prop changes - CRITICAL: if initialEditMode is true, we MUST render editor
  // BUT: Never override edit mode if initialEditMode is explicitly true (forceEditMode)
  useEffect(() => {
    if (initialEditMode !== undefined && initialEditMode === true) {
      // If initialEditMode is true, always set edit mode to true (force)
      setIsEditMode(true)
    } else if (initialEditMode !== undefined) {
      // Only sync when initialEditMode is explicitly false
      setIsEditMode(initialEditMode)
    }
  }, [initialEditMode])
  
  // Sync initialPreviewMode prop changes
  useEffect(() => {
    if (initialPreviewMode !== undefined) {
      setIsPreviewMode(initialPreviewMode)
    }
  }, [initialPreviewMode])
  
  // Sync initialIsPublished prop changes
  useEffect(() => {
    if (initialIsPublished !== undefined) {
      setIsPublished(initialIsPublished)
    }
  }, [initialIsPublished])
  
  // Sync sessionStatus when initialSessionStatus prop changes
  useEffect(() => {
    if (initialSessionStatus !== undefined) {
      setSessionStatus(initialSessionStatus)
    }
  }, [initialSessionStatus])
  
  // Helper to check if string is valid UUID
  const isValidUUID = (str: string | undefined): boolean => {
    if (!str) return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }
  
  // Determine if we're editing an existing draft session (must use sessionStatus from DB)
  const isEditingDraft = sessionStatus === "draft" && actualSessionId && isValidUUID(actualSessionId)
  
  // Button label: "Update draft" if editing draft, "Save draft" otherwise
  const saveDraftLabel = sessionStatus === "draft" ? "Update draft" : "Save draft"
  
  const { toast } = useToast()

  // Handle unpublish
  const handleUnpublish = async () => {
    if (!actualSessionId) return

    try {
      const { unpublishSession } = await import("@/app/host/sessions/[id]/actions")
      const result = await unpublishSession(actualSessionId)

      if (!result.ok) {
        toast({
          title: "Unpublish failed",
          description: result.error || "Failed to unpublish invite. Try again.",
          variant: "destructive",
        })
        return
      }

      // Update local state
      setIsPublished(false)
      setIsEditMode(true)
      setIsPreviewMode(false)

      toast({
        title: "Invite unpublished",
        description: "Back to edit mode.",
        variant: "default",
      })

      // Authoritative refresh: refetch server data
      router.refresh()
    } catch (error: any) {
      console.error("[handleUnpublish] Error:", { sessionId: actualSessionId, error })
      toast({
        title: "Unpublish failed",
        description: error.message || "Failed to unpublish invite. Try again.",
        variant: "destructive",
      })
    }
  }

  // Update actualSessionId when sessionId prop changes
  useEffect(() => {
    if (sessionId) {
      setActualSessionId(sessionId)
    }
  }, [sessionId])

  // Draft state
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [draftNameOpen, setDraftNameOpen] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [isOverwriteMode, setIsOverwriteMode] = useState(false)
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  // Publish share sheet state
  const [publishShareSheetOpen, setPublishShareSheetOpen] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState("")
  const [publishedHostSlug, setPublishedHostSlug] = useState("")
  const [publishedCode, setPublishedCode] = useState("")

  // Placeholder constants for validation
  const PLACEHOLDERS = {
    title: "Enter title here",
    date: "Choose date",
    location: "Enter location",
    host: "Your name",
  }

  // Refs for scrolling to fields
  const titleRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)
  const priceRef = useRef<HTMLDivElement>(null)
  const capacityRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  // Error state for field validation
  type FieldKey = "title" | "date" | "location" | "price" | "capacity" | "host"
  const [fieldErrors, setFieldErrors] = useState<Record<FieldKey, boolean>>({
    title: false,
    date: false,
    location: false,
    price: false,
    capacity: false,
    host: false,
  })

  // Error ring styling (works in light & dark mode)
  const errorRing = "ring-2 ring-red-500/70 border-red-500/60 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"

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

  const [eventTitle, setEventTitle] = useState(initialTitle || "")
  const [titleFont, setTitleFont] = useState<keyof typeof TITLE_FONTS>("Classic")
  const [eventDate, setEventDate] = useState(initialDate || "")
  const [selectedDateDraft, setSelectedDateDraft] = useState<Date | null>(null)
  const [selectedTimeDraft, setSelectedTimeDraft] = useState<{ hour: number; minute: number; ampm: "AM" | "PM" }>({ hour: 9, minute: 0, ampm: "AM" })
  const [selectedDurationDraft, setSelectedDurationDraft] = useState<number>(2) // Duration in hours (1, 1.5, 2, 2.5, 3, 3.5, 4)
  const [eventLocation, setEventLocation] = useState(initialLocation || "")
  const [eventMapUrl, setEventMapUrl] = useState<string>("")
  const [locationDraft, setLocationDraft] = useState<string>(initialLocation || "")
  const [mapUrlDraft, setMapUrlDraft] = useState<string>("")
  const [eventPrice, setEventPrice] = useState(initialPrice ?? (isEmptySession ? 0 : 15))
  const [eventCapacity, setEventCapacity] = useState(initialCapacity ?? (isEmptySession ? 0 : 8))
  const [hostName, setHostName] = useState<string | null>(initialHostName || null)
  const [hostNameInput, setHostNameInput] = useState(initialHostName || "")
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
  const [eventDescription, setEventDescription] = useState(initialDescription || "")

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

  // Handle cover image upload
  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please upload an image file.",
          variant: "default",
        })
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB.",
          variant: "default",
        })
        return
      }

      // Convert to data URL for preview (temporary - should upload to storage in production)
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        if (result) {
          setPendingCoverUrl(result)
          toast({
            title: "Image selected",
            description: "Click Confirm to apply the cover image.",
            variant: "success",
          })
        }
      }
      reader.onerror = () => {
        toast({
          title: "Upload failed",
          description: "Failed to read the image file.",
          variant: "default",
        })
      }
      reader.readAsDataURL(file)
    }
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

  // Parse eventDate string to extract date and time
  const parseEventDate = (dateString: string): { date: Date; hour: number; minute: number; ampm: "AM" | "PM"; durationHours: number } | null => {
    try {
      // Format: "Sat, Jan 25 • 9:00 AM - 11:00 AM"
      const parts = dateString.split("•")
      if (parts.length < 2) return null
      
      const datePart = parts[0].trim()
      const timePart = parts[1].trim()
      
      // Parse date: "Sat, Jan 25"
      const dateMatch = datePart.match(/(\w{3}),\s+(\w{3})\s+(\d{1,2})/)
      if (!dateMatch) return null
      
      const monthName = dateMatch[2]
      const day = parseInt(dateMatch[3], 10)
      const monthMap: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
      }
      const month = monthMap[monthName]
      if (month === undefined) return null
      
      const currentYear = new Date().getFullYear()
      const date = new Date(currentYear, month, day)
      
      // Parse time: "9:00 AM - 11:00 AM" (take first part)
      const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s+(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s+(AM|PM)/)
      if (!timeMatch) {
        // Try single time format
        const singleTimeMatch = timePart.match(/(\d{1,2}):(\d{2})\s+(AM|PM)/)
        if (singleTimeMatch) {
          let hour = parseInt(singleTimeMatch[1], 10)
          const minute = parseInt(singleTimeMatch[2], 10)
          const meridiem = singleTimeMatch[3] as "AM" | "PM"
          if (hour > 12) hour = 12
          if (hour === 0) hour = 12
          return { date, hour, minute, ampm: meridiem, durationHours: 2 } // Default 2 hours
        }
        return { date, hour: 9, minute: 0, ampm: "AM" as const, durationHours: 2 }
      }
      
      let hour = parseInt(timeMatch[1], 10)
      const minute = parseInt(timeMatch[2], 10)
      const meridiem = timeMatch[3] as "AM" | "PM"
      let endHour = parseInt(timeMatch[4], 10)
      const endMinute = parseInt(timeMatch[5], 10)
      const endMeridiem = timeMatch[6] as "AM" | "PM"
      
      // Convert to 24h for duration calculation
      let startHour24 = hour
      if (meridiem === "AM" && hour === 12) startHour24 = 0
      else if (meridiem === "PM" && hour !== 12) startHour24 = hour + 12
      
      let endHour24 = endHour
      if (endMeridiem === "AM" && endHour === 12) endHour24 = 0
      else if (endMeridiem === "PM" && endHour !== 12) endHour24 = endHour + 12
      
      const startMinutes = startHour24 * 60 + minute
      const endMinutes = endHour24 * 60 + endMinute
      let durationHours = (endMinutes - startMinutes) / 60
      if (durationHours < 0) durationHours += 24 // Handle day wrap
      
      if (hour > 12) hour = 12
      if (hour === 0) hour = 12
      
      return { date, hour, minute, ampm: meridiem, durationHours }
    } catch {
      return null
    }
  }

  // Format Date + time to eventDate string
  const formatEventDate = (date: Date, hour: number, minute: number, ampm: "AM" | "PM", durationHours: number = 2): string => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    const dayName = dayNames[date.getDay()]
    const monthName = monthNames[date.getMonth()]
    const day = date.getDate()
    
    // Format start time
    const startTime = `${hour}:${String(minute).padStart(2, "0")} ${ampm}`
    
    // Calculate end time (start + durationHours)
    let startHour24 = hour
    if (ampm === "AM" && hour === 12) startHour24 = 0
    else if (ampm === "PM" && hour !== 12) startHour24 = hour + 12
    
    let totalMinutes = startHour24 * 60 + minute + (durationHours * 60)
    if (totalMinutes >= 1440) totalMinutes -= 1440 // Wrap to next day
    
    const endHour24 = Math.floor(totalMinutes / 60) % 24
    const endMinute = totalMinutes % 60
    
    // Convert to 12h
    let endHour = endHour24
    let endMeridiem: "AM" | "PM" = "AM"
    if (endHour24 === 0) {
      endHour = 12
      endMeridiem = "AM"
    } else if (endHour24 === 12) {
      endHour = 12
      endMeridiem = "PM"
    } else if (endHour24 < 12) {
      endHour = endHour24
      endMeridiem = "AM"
    } else {
      endHour = endHour24 - 12
      endMeridiem = "PM"
    }
    
    const endTime = `${endHour}:${String(endMinute).padStart(2, "0")} ${endMeridiem}`
    
    return `${dayName}, ${monthName} ${day} • ${startTime} - ${endTime}`
  }

  // Initialize drafts when date modal opens
  useEffect(() => {
    if (isDateModalOpen) {
      const parsed = parseEventDate(eventDate)
      const now = new Date()
      
      if (parsed) {
        setSelectedDateDraft(parsed.date)
        setSelectedTimeDraft({ hour: parsed.hour, minute: parsed.minute, ampm: parsed.ampm })
        setSelectedDurationDraft(parsed.durationHours)
        setSelectedDurationDraft(parsed.durationHours)
      } else {
        // Default to current date and time rounded to nearest 5 minutes
        const currentMinute = now.getMinutes()
        const roundedMinute = Math.round(currentMinute / 5) * 5
        let currentHour = now.getHours()
        const currentAmpm: "AM" | "PM" = currentHour >= 12 ? "PM" : "AM"
        
        if (currentHour === 0) currentHour = 12
        else if (currentHour > 12) currentHour = currentHour - 12
        
        setSelectedDateDraft(now)
        setSelectedTimeDraft({ hour: currentHour, minute: roundedMinute >= 60 ? 0 : roundedMinute, ampm: currentAmpm })
        setSelectedDurationDraft(2) // Default to 2 hours
      }
    }
  }, [isDateModalOpen, eventDate])

  const handleDateSave = () => {
    if (!selectedDateDraft) return

    const formattedDate = formatEventDate(
      selectedDateDraft,
      selectedTimeDraft.hour,
      selectedTimeDraft.minute,
      selectedTimeDraft.ampm,
      selectedDurationDraft
    )
    
    setEventDate(formattedDate)
    setIsDateModalOpen(false)
    toast({
      title: "Date updated",
      description: "Session date and time have been saved.",
      variant: "success",
    })
  }

  // Initialize drafts when modal opens
  useEffect(() => {
    if (isLocationModalOpen) {
      setLocationDraft(eventLocation)
      setMapUrlDraft(eventMapUrl)
    }
  }, [isLocationModalOpen, eventLocation, eventMapUrl])

  // Helper function to convert map URL to embed URL
  const getMapEmbedSrc = (mapUrl: string, location: string): string => {
    if (mapUrl && mapUrl.includes("google.com/maps")) {
      // Try to extract place ID or coordinates from the URL (simple approach)
      // If we can't parse it properly, fall back to query-based embed
      try {
        // Check if it's already an embed URL
        if (mapUrl.includes("/embed")) {
          return mapUrl
        }
        // For now, use query-based fallback for simplicity
        return `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`
      } catch {
        return `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`
      }
    }
    // Fallback to query-based embed using location text
    return `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`
  }

  const handleLocationSave = () => {
    const trimmedLocation = locationDraft.trim()
    const trimmedMapUrl = mapUrlDraft.trim()
    
    // Don't allow empty location override; fallback to current
    if (trimmedLocation) {
      setEventLocation(trimmedLocation)
    }
    
    // Normalize map URL (prepend https:// if needed)
    let normalizedMapUrl = trimmedMapUrl
    if (normalizedMapUrl && !normalizedMapUrl.startsWith("http://") && !normalizedMapUrl.startsWith("https://")) {
      normalizedMapUrl = `https://${normalizedMapUrl}`
    }
    setEventMapUrl(normalizedMapUrl)
    
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

  // Computed host name: session hostName ?? user profileName ?? placeholder
  const displayHostName = hostName ?? getUserProfileName() ?? "Your name"

  // Validation helper functions
  const isBlank = (v?: string | null) => !v || v.trim().length === 0

  const isPlaceholder = (v: string, placeholder: string) =>
    v.trim().toLowerCase() === placeholder.trim().toLowerCase()

  const isTitleValid = () =>
    !isBlank(eventTitle) && !isPlaceholder(eventTitle, PLACEHOLDERS.title)

  const isDateValid = () =>
    !isBlank(eventDate) && !isPlaceholder(eventDate, PLACEHOLDERS.date)

  const isLocationValid = () =>
    !isBlank(eventLocation) && !isPlaceholder(eventLocation, PLACEHOLDERS.location)

  const isPriceValid = () =>
    typeof eventPrice === "number" && !Number.isNaN(eventPrice) && eventPrice >= 0

  const isCapacityValid = () =>
    Number.isInteger(eventCapacity) && eventCapacity >= 1

  const isHostValid = () =>
    !isBlank(displayHostName) && !isPlaceholder(displayHostName, PLACEHOLDERS.host)

  // Scroll to ref helper
  const scrollToRef = (ref: React.RefObject<HTMLElement | null>) => {
    const el = ref.current
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  // Initialize hostName input value
  useEffect(() => {
    if (!isHostNameEditing) {
      setHostNameInput(displayHostName)
    }
  }, [displayHostName, isHostNameEditing])

  // Clear errors when fields become valid
  useEffect(() => {
    setFieldErrors(prev => ({
      ...prev,
      title: prev.title ? !isTitleValid() : false,
    }))
  }, [eventTitle])

  useEffect(() => {
    setFieldErrors(prev => ({
      ...prev,
      date: prev.date ? !isDateValid() : false,
    }))
  }, [eventDate])

  useEffect(() => {
    setFieldErrors(prev => ({
      ...prev,
      location: prev.location ? !isLocationValid() : false,
    }))
  }, [eventLocation])

  useEffect(() => {
    setFieldErrors(prev => ({
      ...prev,
      price: prev.price ? !isPriceValid() : false,
    }))
  }, [eventPrice])

  useEffect(() => {
    setFieldErrors(prev => ({
      ...prev,
      capacity: prev.capacity ? !isCapacityValid() : false,
    }))
  }, [eventCapacity])

  useEffect(() => {
    setFieldErrors(prev => ({
      ...prev,
      host: prev.host ? !isHostValid() : false,
    }))
  }, [displayHostName])

  // Update hostName handler
  const handleHostNameSave = async () => {
    setIsHostNameEditing(false)
    
    // Trim and validate
    const trimmedValue = hostNameInput.trim()
    const finalValue = trimmedValue.length > 0 ? trimmedValue : null
    
    // If empty after trim, use user profile name (don't save to session)
    if (!finalValue) {
      setHostNameInput(getUserProfileName() ?? "Your name")
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

  // Validation function for publish
  const validateBeforePublish = () => {
    const missing: FieldKey[] = []

    if (!isTitleValid()) missing.push("title")
    if (!isDateValid()) missing.push("date")
    if (!isLocationValid()) missing.push("location")
    if (!isPriceValid()) missing.push("price")
    if (!isCapacityValid()) missing.push("capacity")
    if (!isHostValid()) missing.push("host")

    if (missing.length === 0) {
      setFieldErrors({ title: false, date: false, location: false, price: false, capacity: false, host: false })
      return { ok: true as const, missing: [] as FieldKey[] }
    }

    // Set error flags
    setFieldErrors(prev => ({
      ...prev,
      title: missing.includes("title"),
      date: missing.includes("date"),
      location: missing.includes("location"),
      price: missing.includes("price"),
      capacity: missing.includes("capacity"),
      host: missing.includes("host"),
    }))

    // Toast message
    const labelMap: Record<FieldKey, string> = {
      title: "Title",
      date: "Date",
      location: "Location",
      price: "Cost",
      capacity: "Spots",
      host: "Host name",
    }

    toast({
      title: "Missing required fields",
      description: `Please complete: ${missing.map(m => labelMap[m]).join(", ")}`,
      variant: "destructive",
    })

    // Scroll to first missing field
    const first = missing[0]
    if (first === "title") scrollToRef(titleRef)
    if (first === "date") scrollToRef(dateRef)
    if (first === "location") scrollToRef(locationRef)
    if (first === "price") scrollToRef(priceRef)
    if (first === "capacity") scrollToRef(capacityRef)
    if (first === "host") scrollToRef(hostRef)

    return { ok: false as const, missing }
  }

  // Handle publish/update with auth gating
  const handlePublish = async () => {
    // Validate required fields first
    const validation = validateBeforePublish()
    if (!validation.ok) return

    if (!isAuthenticated) {
      // Store intent to publish after login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_publish", "true")
      }
      setLoginDialogOpen(true)
      return
    }

    // Check if session is live (status === "open")
    const isLive = sessionStatus === "open"
    
    // User is authenticated, proceed with publish/update
    try {
      // Extract session ID from pathname (could be /host/sessions/[id]/edit) or use sessionId prop
      let publishSessionId: string | undefined = sessionId || actualSessionId
      if (!publishSessionId && pathname.includes("/host/sessions/")) {
        const parts = pathname.split("/")
        const sessionsIndex = parts.indexOf("sessions")
        if (sessionsIndex >= 0 && parts[sessionsIndex + 1]) {
          publishSessionId = parts[sessionsIndex + 1]
        }
      }

      if (!publishSessionId && isLive) {
        toast({
          title: "Update failed",
          description: "Session ID is missing.",
          variant: "destructive",
        })
        return
      }

      // Get host name for slug generation
      const hostNameForPublish = displayHostName || getUserProfileName() || "host"

      // Map sport display name to enum value
      const sportEnumMap: Record<string, "badminton" | "pickleball" | "volleyball" | "other"> = {
        "Badminton": "badminton",
        "Pickleball": "pickleball",
        "Volleyball": "volleyball",
        "Futsal": "other",
      }
      const sportEnum = sportEnumMap[selectedSport] || "badminton"

      // Parse eventDate to get start_at and end_at ISO strings
      let startAt = new Date().toISOString() // Default to now if parsing fails
      let endAt: string | null = null

      if (eventDate) {
        const parsed = parseEventDate(eventDate)
        if (parsed) {
          const startDate = new Date(parsed.date)
          // Convert hour to 24h format
          let hour24 = parsed.hour
          if (parsed.ampm === "PM" && parsed.hour !== 12) {
            hour24 = parsed.hour + 12
          } else if (parsed.ampm === "AM" && parsed.hour === 12) {
            hour24 = 0
          }
          startDate.setHours(hour24, parsed.minute, 0, 0)
          startAt = startDate.toISOString()

          // Calculate end_at
          const endDate = new Date(startDate)
          endDate.setHours(endDate.getHours() + parsed.durationHours)
          endAt = endDate.toISOString()
        }
      }

      const sessionData = {
        title: eventTitle,
        startAt,
        endAt,
        location: eventLocation || null,
        capacity: eventCapacity || null,
        hostName: hostNameForPublish,
        sport: sportEnum,
        description: eventDescription || null,
        coverUrl: optimisticCoverUrl || null,
      }

      let result: { ok: boolean; publicCode?: string; hostSlug?: string; sessionId?: string; error?: string }
      let inviteLink: string

      if (isLive && publishSessionId) {
        // Update existing live session (doesn't change status)
        const { updateLiveSession } = await import("@/app/host/sessions/[id]/actions")
        result = await updateLiveSession(publishSessionId, sessionData)
        
        if (!result.ok) {
          toast({
            title: "Update failed",
            description: result.error || "Failed to update session. Please try again.",
            variant: "destructive",
          })
          return
        }

        // Generate invite link using existing public_code
        inviteLink = `${window.location.origin}/${result.hostSlug}/${result.publicCode}`
        
        // Copy to clipboard
        if (typeof window !== "undefined" && navigator.clipboard) {
          navigator.clipboard.writeText(inviteLink)
        }

        toast({
          title: "Invite successfully updated",
          description: "Your changes have been saved.",
          variant: "default",
        })

        // Navigate to analytics page (same route as edit, but shows analytics view when isPublished=true)
        if (publishSessionId) {
          router.push(`/host/sessions/${publishSessionId}/edit`)
          router.refresh()
        } else {
          router.refresh()
        }
        return
      } else {
        // Publish new session or draft (sets status to 'open')
        const { publishSession } = await import("@/app/host/sessions/[id]/actions")
        result = await publishSession({
          sessionId: publishSessionId || null, // Pass null if "new" or doesn't exist
          ...sessionData,
        })

        if (!result.ok) {
          toast({
            title: "Publish failed",
            description: result.error || "Failed to publish session. Please try again.",
            variant: "destructive",
          })
          return
        }

        // Generate invite link using new format: /{hostSlug}/{code}
        if (!result.hostSlug || !result.publicCode) {
          toast({
            title: "Publish failed",
            description: "Failed to generate invite link.",
            variant: "destructive",
          })
          return
        }
        
        inviteLink = `${window.location.origin}/${result.hostSlug}/${result.publicCode}`
        
        // Set published URL first
        setPublishedUrl(inviteLink)
        setPublishedHostSlug(result.hostSlug)
        setPublishedCode(result.publicCode)
        
        // Update actualSessionId if session was created
        const finalSessionId = result.sessionId || publishSessionId || actualSessionId
        if (result.sessionId) {
          setActualSessionId(result.sessionId)
          // Store in sessionStorage so we can navigate after share sheet closes
          if (typeof window !== "undefined" && result.sessionId !== sessionId) {
            sessionStorage.setItem("pending_navigate_to_session", result.sessionId)
          }
        }

        // Open share sheet immediately (don't navigate yet - navigation will happen after sheet closes)
        // Store sessionId for share sheet to use in preview navigation
        setPublishShareSheetOpen(true)

        // Don't switch to analytics view yet - wait for user to close the share sheet
      }
    } catch (error: any) {
      console.error("[handlePublish] Error:", error)
      const actionLabel = sessionStatus === "open" ? "Update" : "Publish"
      toast({
        title: `${actionLabel} failed`,
        description: error?.message || `Failed to ${actionLabel.toLowerCase()} session. Please try again.`,
        variant: "destructive",
      })
    }
  }

  // Build session patch from current form state (for updating draft sessions)
  const buildSessionPatch = () => {
    // Get host name for update
    const hostNameForUpdate = displayHostName || getUserProfileName() || null

    // Map sport display name to enum value
    const sportEnumMap: Record<string, "badminton" | "pickleball" | "volleyball" | "other"> = {
      "Badminton": "badminton",
      "Pickleball": "pickleball",
      "Volleyball": "volleyball",
      "Futsal": "other",
    }
    const sportEnum = sportEnumMap[selectedSport] || "badminton"

    // Parse eventDate to get start_at and end_at ISO strings
    let startAt: string | undefined = undefined
    let endAt: string | null = null

    if (eventDate) {
      const parsed = parseEventDate(eventDate)
      if (parsed) {
        const startDate = new Date(parsed.date)
        // Convert hour to 24h format
        let hour24 = parsed.hour
        if (parsed.ampm === "PM" && parsed.hour !== 12) {
          hour24 = parsed.hour + 12
        } else if (parsed.ampm === "AM" && parsed.hour === 12) {
          hour24 = 0
        }
        startDate.setHours(hour24, parsed.minute, 0, 0)
        startAt = startDate.toISOString()

        // Calculate end_at
        const endDate = new Date(startDate)
        endDate.setHours(endDate.getHours() + parsed.durationHours)
        endAt = endDate.toISOString()
      }
    }

    return {
      title: eventTitle || undefined,
      description: eventDescription || null,
      cover_url: optimisticCoverUrl || null,
      sport: sportEnum,
      location: eventLocation || null,
      start_at: startAt,
      end_at: endAt,
      capacity: eventCapacity || null,
      host_name: hostNameForUpdate,
    }
  }

  // Build draft payload from current form state
  const buildDraftPayload = (): DraftData => {
    return {
      selectedSport,
      theme,
      effects,
      optimisticCoverUrl,
      eventTitle,
      titleFont,
      eventDate,
      eventLocation,
      eventMapUrl,
      eventPrice,
      eventCapacity,
      hostName,
      eventDescription,
      bankName,
      accountNumber,
      accountName,
      paymentNotes,
      paymentQrImage,
    }
  }

  // Apply draft payload to form state
  const applyDraftPayload = (payload: DraftData) => {
    setSelectedSport(payload.selectedSport)
    setTheme(payload.theme)
    setEffects(payload.effects)
    setOptimisticCoverUrl(payload.optimisticCoverUrl)
    setEventTitle(payload.eventTitle)
    // Validate titleFont is a valid key before setting
    if (payload.titleFont in TITLE_FONTS) {
      setTitleFont(payload.titleFont as keyof typeof TITLE_FONTS)
    }
    setEventDate(payload.eventDate)
    setEventLocation(payload.eventLocation)
    setEventMapUrl(payload.eventMapUrl)
    setEventPrice(payload.eventPrice)
    setEventCapacity(payload.eventCapacity)
    setHostName(payload.hostName)
    setEventDescription(payload.eventDescription)
    setBankName(payload.bankName)
    setAccountNumber(payload.accountNumber)
    setAccountName(payload.accountName)
    setPaymentNotes(payload.paymentNotes)
    setPaymentQrImage(payload.paymentQrImage)
  }

  // Refresh drafts list
  const refreshDrafts = async () => {
    setLoadingDrafts(true)
    try {
      const result = await listDrafts()
      if (result.ok) {
        setDrafts(result.drafts)
      } else {
        console.error("Failed to load drafts:", result.error)
      }
    } catch (error) {
      console.error("Error loading drafts:", error)
    } finally {
      setLoadingDrafts(false)
    }
  }

  // Handle save draft click
  const handleSaveDraftClick = async () => {
    if (!isAuthenticated) {
      // Store intent to save draft after login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_save_draft", "true")
      }
      setLoginDialogOpen(true)
      return
    }

    // If editing an existing draft session (status === "draft"), update it directly
    if (sessionStatus === "draft" && actualSessionId && isValidUUID(actualSessionId)) {
      try {
        const patch = buildSessionPatch()
        const { updateDraftSession } = await import("@/app/host/sessions/[id]/actions")
        const result = await updateDraftSession(actualSessionId, patch)

        if (!result.ok) {
          toast({
            title: "Failed to update draft",
            description: result.error || "Failed to update draft. Please try again.",
            variant: "destructive",
          })
          return
        }

        toast({
          title: "Draft updated",
          description: "Your draft has been updated successfully.",
          variant: "default",
        })

        // Authoritative refresh: refetch server data
        router.refresh()
        return
      } catch (error: any) {
        console.error("[handleSaveDraftClick] Error updating draft:", error)
        toast({
          title: "Failed to update draft",
          description: error?.message || "Failed to update draft. Please try again.",
          variant: "destructive",
        })
        return
      }
    }

    // User is authenticated, but not editing a draft - open name dialog for new draft
    setDraftNameOpen(true)
  }

  // Confirm save draft
  const confirmSaveDraft = async (name: string) => {
    try {
      const payload = buildDraftPayload()
      // Pass source_session_id if we're editing an existing session
      const result = await saveDraft(name, payload, actualSessionId || null)

      if (result.ok) {
        toast({
          title: "Draft saved",
          description: "Your draft has been saved successfully.",
          variant: "success",
        })
        setDraftNameOpen(false)
        setDraftName("")
        // Refresh drafts list if dialog is open
        if (draftsOpen) {
          await refreshDrafts()
        }
      } else {
        if (result.code === "LIMIT_REACHED") {
          // Open drafts dialog in overwrite mode
          setIsOverwriteMode(true)
          setDraftNameOpen(false)
          await refreshDrafts()
          setDraftsOpen(true)
        } else {
          toast({
            title: "Failed to save draft",
            description: result.error,
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to save draft",
        description: error?.message || "An error occurred while saving the draft.",
        variant: "destructive",
      })
    }
  }

  // Handle load draft
  const handleLoadDraft = async (draftId: string) => {
    try {
      const result = await getDraft(draftId)
      if (result.ok) {
        applyDraftPayload(result.draft.data)
        
        // If we have an actualSessionId, check if it's a draft session
        // and set the status accordingly so the button shows "Update draft"
        if (actualSessionId && isValidUUID(actualSessionId)) {
          try {
            const { createClient } = await import("@/lib/supabase/client")
            const supabase = createClient()
            const { data: session, error: sessionError } = await supabase
              .from("sessions")
              .select("status")
              .eq("id", actualSessionId)
              .single()
            
            if (!sessionError && session && session.status === "draft") {
              setSessionStatus("draft")
            } else if (!sessionError && session) {
              // If session exists but is not a draft, set the actual status
              setSessionStatus(session.status as "draft" | "open" | "closed" | "completed" | "cancelled")
            }
          } catch (error) {
            // If we can't fetch the session, that's okay - it might not exist yet
            console.log("[handleLoadDraft] Could not fetch session status:", error)
          }
        }
        
        toast({
          title: "Draft loaded",
          description: `"${result.draft.name}" has been loaded.`,
          variant: "success",
        })
      } else {
        toast({
          title: "Failed to load draft",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to load draft",
        description: error?.message || "An error occurred while loading the draft.",
        variant: "destructive",
      })
    }
  }

  // Handle delete draft
  const handleDeleteDraft = async (draftId: string) => {
    try {
      const result = await deleteDraft(draftId)
      if (result.ok) {
        toast({
          title: "Draft deleted",
          description: "The draft has been deleted.",
          variant: "success",
        })
        await refreshDrafts()
      } else {
        toast({
          title: "Failed to delete draft",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to delete draft",
        description: error?.message || "An error occurred while deleting the draft.",
        variant: "destructive",
      })
    }
  }

  // Handle overwrite draft
  const handleOverwriteDraft = async (draftId: string) => {
    try {
      const payload = buildDraftPayload()
      // Pass source_session_id if we're editing an existing session
      const result = await overwriteDraft(draftId, payload, undefined, actualSessionId || null)

      if (result.ok) {
        toast({
          title: "Draft updated",
          description: "Your draft has been updated successfully.",
          variant: "success",
        })
        setIsOverwriteMode(false)
        setDraftsOpen(false)
        await refreshDrafts()
      } else {
        toast({
          title: "Failed to update draft",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to update draft",
        description: error?.message || "An error occurred while updating the draft.",
        variant: "destructive",
      })
    }
  }

  // Handle drafts dialog open
  const handleDraftsOpen = async () => {
    await refreshDrafts()
    setIsOverwriteMode(false)
    setDraftsOpen(true)
  }

  const handleSaveDraft = handleSaveDraftClick

  // Button label is already set above based on sessionStatus
  // const saveDraftLabel = sessionStatus === "draft" ? "Update draft" : "Save draft"

  const handleLoginSuccess = () => {
    setLoginDialogOpen(false)
    // Check for pending actions after login
    if (typeof window !== "undefined") {
      const pendingPublish = sessionStorage.getItem("pending_publish")
      const pendingSaveDraft = sessionStorage.getItem("pending_save_draft")
      
      if (pendingPublish === "true") {
        sessionStorage.removeItem("pending_publish")
        // Publish will be handled by useEffect
      }
      
      if (pendingSaveDraft === "true") {
        sessionStorage.removeItem("pending_save_draft")
        // Open draft name dialog
        setDraftNameOpen(true)
      }
    }
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
  const inputPlaceholder = uiMode === "dark" ? "placeholder:text-white/40" : "placeholder:text-black/40"

  // HARD RULE: If initialEditMode is true (forceEditMode), ALWAYS render editor, never analytics
  // This ensures that when ?mode=edit is in URL, editor renders unconditionally
  // Use initialEditMode as PRIMARY source of truth (prop), fallback to state for backward compatibility
  // initialEditMode prop takes precedence because it comes directly from server/route and can't be out of sync
  const mustRenderEditor = initialEditMode === true ? true : (isEditMode === true)
  
  // Debug logging to diagnose render gate
  if (process.env.NODE_ENV === 'development') {
    console.log('[SessionInvite] Render gate check:', {
      initialEditMode,
      isEditMode,
      mustRenderEditor,
      isPublished,
      actualSessionId,
      demoMode,
      publishShareSheetOpen,
      willRenderAnalytics: isPublished && actualSessionId && !demoMode && !publishShareSheetOpen && !mustRenderEditor
    })
  }

  // If published, show analytics view instead of edit/preview
  // But don't show analytics if share sheet is open (let user see the share sheet first)
  // Or if edit mode is explicitly requested (via ?mode=edit query param or initialEditMode prop)
  // Or if preview mode is explicitly requested (via ?mode=preview query param or initialPreviewMode prop)
  if (isPublished && actualSessionId && !demoMode && !publishShareSheetOpen && !mustRenderEditor && !initialPreviewMode) {
    return (
      <div className="min-h-screen sporty-bg">
        <TopNav showCreateNow={false} />
        <HostSessionAnalytics sessionId={actualSessionId} uiMode={uiMode} />
        {/* Editor Bottom Bar with Edit button */}
        <AnimatePresence>
          <motion.div
            key="editorbar"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <EditorBottomBar
              onPreview={
                actualSessionId
                  ? () => {
                      router.push(`/host/sessions/${actualSessionId}/edit?mode=preview`)
                    }
                  : undefined // Pass undefined so EditorBottomBar can use fallback from useParams()
              }
              onEdit={
                actualSessionId
                  ? () => {
                      router.push(`/host/sessions/${actualSessionId}/edit?mode=edit&from=analytics`)
                    }
                  : undefined
              }
              onUnpublish={actualSessionId ? handleUnpublish : undefined}
              theme={theme}
              onThemeChange={setTheme}
              uiMode={uiMode}
              onUiModeChange={setUiMode}
              isPublished={true}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

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
      {/* Top Navigation - show in edit mode or demo mode */}
      <TopNav showCreateNow={false} />

      {/* Go to Analytics Button - show when session is live and in edit mode */}
      {isEditMode && !isPreviewMode && sessionStatus === "open" && actualSessionId && (
        <div className="fixed top-16 left-4 z-50">
          <Button
            onClick={() => router.push(`/host/sessions/${actualSessionId}/edit`)}
            variant="outline"
            className={cn(
              "rounded-full h-10 px-4 gap-2 backdrop-blur-xl border shadow-lg",
              uiMode === "dark"
                ? "bg-black/40 border-white/20 text-white hover:bg-black/60"
                : "bg-white/80 border-black/20 text-black hover:bg-white"
            )}
          >
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm font-medium">Go to Analytics</span>
          </Button>
        </div>
      )}

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
        {isPreviewMode && !hidePreviewBanner && (
          <motion.div
            key="previewbar"
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="sticky top-14 z-40 bg-lime-500/90 text-black px-4 py-2 flex items-center justify-between"
          >
            <span className="font-medium text-xs">
              {demoMode ? "Build yours now!" : "Previewing as participant"}
            </span>
            <Button
              onClick={() => {
                if (demoMode) {
                  router.push("/host/sessions/new/edit")
                } else if (actualSessionId) {
                  // Navigate to edit mode with query param
                  router.push(`/host/sessions/${actualSessionId}/edit?mode=edit`)
                } else {
                  handlePreviewModeChange(false)
                }
              }}
              size="sm"
              className="bg-black hover:bg-black/80 text-white h-7 text-xs px-3"
            >
              {demoMode ? "Create" : "Back to edit"}
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
                          className="bg-[var(--theme-accent)]/20 text-[var(--theme-accent-light)] border border-[var(--theme-accent)]/30 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5"
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
                      className={`${glassPill} px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5`}
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
                      <div ref={titleRef} className="space-y-3">
                        <div className={cn(
                          `${uiMode === "dark" ? "bg-white/5 border-white/10" : "bg-white/70 border-black/10"} backdrop-blur-sm rounded-2xl p-4`,
                          fieldErrors.title && errorRing
                        )}>
                          <input
                            type="text"
                            value={eventTitle}
                            onChange={(e) => setEventTitle(e.target.value)}
                            onFocus={() => setFieldErrors(prev => ({ ...prev, title: false }))}
                          className={`bg-transparent border-none text-4xl font-bold ${uiMode === "dark" ? "text-white" : "text-black"} w-full focus:outline-none focus:ring-0 p-0 text-center ${TITLE_FONTS[titleFont]} ${inputPlaceholder}`}
                            placeholder="Enter title here"
                          />
                        </div>
                        {/* Font picker */}
                        <div className="flex items-center justify-center gap-2">
                          {(Object.keys(TITLE_FONTS) as Array<keyof typeof TITLE_FONTS>).map((font) => (
                            <button
                              key={font}
                              onClick={() => setTitleFont(font)}
                              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
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
                        className={`text-4xl font-bold ${uiMode === "dark" ? "text-black" : "text-white"} ${isPreviewMode ? "text-left" : "text-center"} ${TITLE_FONTS[titleFont]} ${!eventTitle ? "italic opacity-60" : ""}`}
                      >
                        {eventTitle || "Enter title here"}
                      </motion.h1>
                    )}

                    {isEditMode && !isPreviewMode ? (
                      <>
                        <div className="space-y-3">
                          {/* Date & Time Button */}
                          <div ref={dateRef}>
                            <motion.button
                              onClick={() => {
                                setFieldErrors(prev => ({ ...prev, date: false }))
                                setIsDateModalOpen(true)
                              }}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              transition={{ duration: 0.15 }}
                              className={cn(
                                `w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 text-left min-h-[54px]`,
                                fieldErrors.date && errorRing
                              )}
                            >
                              <Calendar className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                              <div className="flex-1">
                                <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Date & Time</p>
                                <p className={`${eventDate ? strongText : mutedText} ${!eventDate ? "italic" : ""} font-medium`}>{eventDate || "Choose date"}</p>
                              </div>
                              <ChevronRight className={`w-5 h-5 ${uiMode === "dark" ? "text-white/40" : "text-black/40"} flex-shrink-0`} />
                            </motion.button>
                          </div>

                          {/* Location Button */}
                          <div ref={locationRef}>
                            <motion.button
                              onClick={() => {
                                setFieldErrors(prev => ({ ...prev, location: false }))
                                setIsLocationModalOpen(true)
                              }}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              transition={{ duration: 0.15 }}
                              className={cn(
                                `w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 text-left min-h-[54px]`,
                                fieldErrors.location && errorRing
                              )}
                            >
                            <MapPin className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Location</p>
                              <p className={`${eventLocation ? strongText : mutedText} ${!eventLocation ? "italic" : ""} font-medium`}>{eventLocation || "Enter location"}</p>
                            </div>
                            <ChevronRight className={`w-5 h-5 ${uiMode === "dark" ? "text-white/40" : "text-black/40"} flex-shrink-0`} />
                            </motion.button>
                          </div>

                          <motion.div
                            ref={priceRef}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={cn(
                              `w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 min-h-[54px]`,
                              fieldErrors.price && errorRing
                            )}
                          >
                            <DollarSign className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Cost per person</p>
                              <div className="flex items-center gap-1.5">
                                <span className={`${strongText} font-medium`}>$</span>
                                <input
                                  type="number"
                                  value={eventPrice || ""}
                                  onChange={(e) => setEventPrice(Number(e.target.value) || 0)}
                                  onBlur={handleCostBlur}
                                  onFocus={() => setFieldErrors(prev => ({ ...prev, price: false }))}
                                  min={0}
                                  step={1}
                                  placeholder="Cost"
                                  className={`bg-transparent border-none ${strongText} font-medium italic w-16 focus:outline-none focus:ring-0 p-0 ${inputPlaceholder}`}
                                />
                                <span className={`${strongText} font-medium`}>per person</span>
                              </div>
                            </div>
                          </motion.div>

                          <motion.div
                            ref={capacityRef}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={cn(
                              `w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 min-h-[54px]`,
                              fieldErrors.capacity && errorRing
                            )}
                          >
                            <Users className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Spots</p>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={eventCapacity || ""}
                                  onChange={(e) => setEventCapacity(Number(e.target.value) || 0)}
                                  onBlur={handleSpotsBlur}
                                  onFocus={() => setFieldErrors(prev => ({ ...prev, capacity: false }))}
                                  min={1}
                                  step={1}
                                  placeholder="Number"
                                  className={`bg-transparent border-none ${strongText} font-medium w-16 focus:outline-none focus:ring-0 p-0 ${inputPlaceholder} [&::placeholder]:italic`}
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
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"} ${!eventDate ? "italic opacity-60" : ""}`}>
                            {eventDate || "Choose date"}
                          </p>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className={`w-5 h-5 ${uiMode === "dark" ? "text-black/60" : "text-white/60"} mt-0.5`} />
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"} ${!eventLocation ? "italic opacity-60" : ""}`}>
                            {eventLocation || "Enter location"}
                          </p>
                        </div>
                        <div className="flex items-start gap-3">
                          <DollarSign className={`w-5 h-5 ${uiMode === "dark" ? "text-black/60" : "text-white/60"} mt-0.5`} />
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"} ${!eventPrice || eventPrice === 0 ? "italic opacity-60" : ""}`}>
                            {eventPrice && eventPrice > 0 
                              ? `$${eventPrice} ${demoMode ? "per chick" : "per person"}` 
                              : "Enter cost"}
                          </p>
                        </div>
                        <div className="flex items-start gap-3">
                          <Users className={`w-5 h-5 ${uiMode === "dark" ? "text-black/60" : "text-white/60"} mt-0.5`} />
                          <p className={`text-base ${uiMode === "dark" ? "text-black" : "text-white"} ${!eventCapacity || eventCapacity === 0 ? "italic opacity-60" : ""}`}>
                            {eventCapacity && eventCapacity > 0 ? `${eventCapacity} spots total` : "Enter number of spots"}
                          </p>
                        </div>
                      </div>
                    )}
                    </motion.div>

                    <motion.div
                      ref={hostRef}
                      layout
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className={cn(
                        "flex items-center gap-3 pt-2",
                        fieldErrors.host && "ring-2 ring-red-500/70 rounded-lg p-2 -m-2"
                      )}
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
                            onFocus={() => {
                              handleHostNameFocus()
                              setFieldErrors(prev => ({ ...prev, host: false }))
                            }}
                            onBlur={handleHostNameSave}
                            onKeyDown={handleHostNameKeyDown}
                            disabled={isHostNameSaving}
                            maxLength={40}
                            className={cn(
                              "bg-transparent border-none border-b border-transparent text-white font-medium focus:outline-none focus:ring-0 focus:border-b p-0 transition-colors disabled:opacity-50 min-w-[80px] placeholder:italic",
                              fieldErrors.host ? "border-red-500/70 focus:border-red-500/70" : "focus:border-white/30"
                            )}
                            placeholder={getUserProfileName() ?? "Your name"}
                        />
                      ) : (
                          <p className={`font-medium ${uiMode === "dark" ? "text-black" : "text-white"} ${!displayHostName || displayHostName === "Your name" ? "italic opacity-60" : ""}`}>
                            {displayHostName || "Your name"}
                          </p>
                      )}
                    </div>
                    </motion.div>
                  </motion.div>

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
                  placeholder="Add a short description for participants"
                  className={`${inputBg} ${inputBorder} ${inputPlaceholder} rounded-lg p-3 ${strongText} text-sm leading-relaxed w-full focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/50 resize-none overflow-hidden`}
                  rows={1}
                />
              ) : (
                <p className={`${mutedText} ${!eventDescription ? "italic opacity-60" : ""} text-sm leading-relaxed`}>
                  {eventDescription || "Add a short description for participants"}
                </p>
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
                {demoMode ? (
                  <div className="w-full h-48 rounded-lg overflow-hidden bg-gradient-to-br from-lime-100 to-emerald-100 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-2 text-lime-600" />
                      <p className="text-sm text-black font-medium">Map preview (demo)</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-48 rounded-lg overflow-hidden bg-slate-800">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      src={getMapEmbedSrc(eventMapUrl, eventLocation)}
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                    />
                    {!eventMapUrl && (
                      <p className={`text-xs ${mutedText} mt-2`}>
                        Map is approximate in beta. Paste a Google Maps link for a precise embed.
                      </p>
                    )}
                  </div>
                )}
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
                    {demoParticipants.length} / {eventCapacity}
                  </Badge>
                </div>
                {demoParticipants.length === 0 ? (
                  <p className={`text-sm ${mutedText} px-1`}>No one has joined so far.</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                    {demoParticipants.map((participant, i) => {
                      const initial = (participant.name?.trim()?.[0] ?? "?").toUpperCase()
                      return (
                        <motion.div
                          key={participant.name || i}
                          whileHover={{ scale: 1.05, y: -2 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col items-center gap-2 min-w-[80px]"
                        >
                          <div className="relative">
                            {participant.avatar ? (
                              <img
                                src={participant.avatar}
                                alt={participant.name}
                                className="w-16 h-16 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] p-0.5">
                                <div className={`w-full h-full rounded-full ${uiMode === "dark" ? "bg-slate-100" : "bg-white"} flex items-center justify-center border border-white/10`}>
                                  <span className={`text-lg font-semibold ${uiMode === "dark" ? "text-black" : "text-black"}`}>
                                    {initial}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          <p className={`mt-1 w-14 truncate text-center text-[11px] ${mutedText}`}>
                            {participant.name}
                          </p>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
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
                    <label className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-[var(--theme-accent)]/50 transition-colors cursor-pointer block ${
                      uiMode === "dark" ? "border-white/20" : "border-black/30"
                    }`}>
                      <input type="file" accept="image/*" onChange={handlePaymentImageUpload} className="hidden" />
                      <ImageIcon className={`w-8 h-8 mx-auto mb-2 ${
                        uiMode === "dark" ? "text-white/40" : "text-black/50"
                      }`} />
                      <p className={`text-sm ${
                        uiMode === "dark" ? "text-white/60" : "text-black/70"
                      }`}>Upload Touch 'n Go / Maybank QR</p>
                      <p className={`text-xs mt-1 ${
                        uiMode === "dark" ? "text-white/40" : "text-black/50"
                      }`}>or bank transfer screenshot</p>
                    </label>
                  )}
                </div>

                {/* Bank Details */}
                <div className="space-y-3">
                  <div>
                    <label className={`text-sm ${mutedText} mb-1.5 block`}>Bank Name</label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Maybank"
                      className={`${inputBg} ${inputBorder} ${strongText} ${inputPlaceholder} focus:ring-[var(--theme-accent)]/50`}
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
                  <label className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-[var(--theme-accent)]/50 transition-colors cursor-pointer block ${
                    uiMode === "dark" ? "border-white/20" : "border-black/30"
                  }`}>
                    <input type="file" accept="image/*" onChange={handleProofImageUpload} className="hidden" />
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${
                      uiMode === "dark" ? "text-white/40" : "text-black/50"
                    }`} />
                    <p className={`text-sm ${
                      uiMode === "dark" ? "text-white/60" : "text-black/70"
                    }`}>Click to upload or drag and drop</p>
                    <p className={`text-xs mt-1 ${
                      uiMode === "dark" ? "text-white/40" : "text-black/50"
                    }`}>Screenshot or photo</p>
                  </label>
                )}
              </Card>
            </motion.div>
          )}
          </motion.div>
        </div>
      </LayoutGroup>

      <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
        <DialogContent className={`${uiMode === "dark" ? "bg-slate-900 border-white/10 text-white" : "bg-white border-black/10 text-black"} max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0`}>
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className={`text-xl font-semibold ${uiMode === "dark" ? "text-white" : "text-black"}`}>Set a date</DialogTitle>
          </DialogHeader>
          
          {/* Scrollable content */}
          <div className="px-6 pb-28 overflow-y-auto flex-1">
            {/* Calendar */}
            {selectedDateDraft && (
              <div className="mb-6">
                <MobileCalendar
                  value={selectedDateDraft}
                  onChange={(date) => setSelectedDateDraft(date)}
                  uiMode={uiMode}
                />
              </div>
            )}

            {/* Time Picker */}
            <div className="mb-6">
              <label className={`text-sm font-medium mb-3 block ${uiMode === "dark" ? "text-white/80" : "text-black/80"}`}>
                Time
              </label>
              <TimePickerWheels
                hour={selectedTimeDraft.hour}
                minute={selectedTimeDraft.minute}
                ampm={selectedTimeDraft.ampm}
                onHourChange={(hour) => setSelectedTimeDraft(prev => ({ ...prev, hour }))}
                onMinuteChange={(minute) => setSelectedTimeDraft(prev => ({ ...prev, minute }))}
                onAmpmChange={(ampm) => setSelectedTimeDraft(prev => ({ ...prev, ampm }))}
                uiMode={uiMode}
              />
            </div>

            {/* Duration Picker */}
            <div className="mb-4">
              <label className={`text-sm font-medium mb-3 block ${uiMode === "dark" ? "text-white/80" : "text-black/80"}`}>
                Duration
              </label>
              <div className="overflow-x-auto -mx-6 px-6" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
                <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4].map((duration) => {
                    const isSelected = selectedDurationDraft === duration
                    return (
                      <button
                        key={duration}
                        onClick={() => setSelectedDurationDraft(duration)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                          isSelected
                            ? "bg-lime-500 text-black font-semibold"
                            : uiMode === "dark"
                            ? "bg-white/5 text-white/80 hover:bg-white/10 border border-white/10"
                            : "bg-black/5 text-black/80 hover:bg-black/10 border border-black/10"
                        }`}
                      >
                        {duration === 1 ? "1 hour" : `${duration} hours`}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky bottom action bar */}
          <div className={`sticky bottom-0 left-0 right-0 z-10 border-t ${uiMode === "dark" ? "border-white/10 bg-slate-900/95" : "border-black/10 bg-white/95"} backdrop-blur px-6 py-4`}>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDateModalOpen(false)}
                className={`flex-1 ${uiMode === "dark" ? "border-white/20 bg-white/5 hover:bg-white/10 text-white" : "border-black/20 bg-black/5 hover:bg-black/10 text-black"}`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDateSave}
                disabled={!selectedDateDraft}
                className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
        <DialogContent 
          className={cn(
            "max-w-md max-h-[90vh] overflow-y-auto rounded-2xl",
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
              Set location
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {/* Location Name Input */}
            <div>
              <label className={cn(
                "text-sm mb-2 block",
                uiMode === "dark" ? "text-white/70" : "text-black/60"
              )}>
                Location name
              </label>
              <Input
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                placeholder="e.g. Bukit Jalil Sports Arena, Court 2"
                className={cn(
                  "h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-lime-500/40",
                  uiMode === "dark"
                    ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
                )}
              />
            </div>

            {/* Google Maps Link Input */}
            <div>
              <label className={cn(
                "text-sm mb-2 block",
                uiMode === "dark" ? "text-white/70" : "text-black/60"
              )}>
                Google Maps link (optional)
              </label>
              <Input
                type="url"
                value={mapUrlDraft}
                onChange={(e) => setMapUrlDraft(e.target.value)}
                placeholder="Paste Google Maps link (optional)"
                className={cn(
                  "h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-lime-500/40",
                  uiMode === "dark"
                    ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
                )}
              />
            </div>

            {/* Helper Text */}
            <div className="space-y-2 pt-2">
              <p className={cn(
                "text-xs",
                uiMode === "dark" ? "text-white/60" : "text-black/60"
              )}>
                Beta: Autocomplete isn't enabled yet to keep costs low. Please type your location manually.
              </p>
              <p className={cn(
                "text-xs",
                uiMode === "dark" ? "text-white/60" : "text-black/60"
              )}>
                Tip: Paste a Google Maps link to enable the map preview.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={cn(
            "mt-6 pt-4 flex gap-3",
            uiMode === "dark" ? "border-t border-white/10" : "border-t border-black/10"
          )}>
            <Button
              variant="outline"
              onClick={() => setIsLocationModalOpen(false)}
              className={cn(
                "flex-1 rounded-full",
                uiMode === "dark"
                  ? "bg-white/5 text-white border-white/10 hover:bg-white/10"
                  : "bg-black/5 text-black border-black/10 hover:bg-black/10"
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLocationSave}
              className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full"
            >
              Save
            </Button>
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
              {/* Upload cover image option (first) */}
              <label className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                pendingCoverUrl && typeof pendingCoverUrl === "string" && pendingCoverUrl.startsWith("data:image/")
                  ? "border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)]/50"
                  : "border-white/10 hover:border-white/30"
              }`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageUpload}
                  className="hidden"
                />
                {pendingCoverUrl && typeof pendingCoverUrl === "string" && pendingCoverUrl.startsWith("data:image/") ? (
                  <>
                    <img
                      src={pendingCoverUrl}
                      alt="Uploaded cover"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium text-sm">Uploaded image</span>
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-[var(--theme-accent-light)]" />
                          <span className="text-xs text-[var(--theme-accent-light)] font-medium">Selected</span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-[var(--theme-accent)]/10 flex items-center justify-center pointer-events-none">
                      <div className="absolute top-3 right-3 bg-[var(--theme-accent)] rounded-full p-1.5">
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    <Upload className="w-12 h-12 text-white/60 mb-3" />
                    <span className="text-white font-medium text-sm">Upload cover image</span>
                    <span className="text-white/50 text-xs mt-1">JPG, PNG (max 5MB)</span>
                  </div>
                )}
              </label>

              {/* Default color option */}
              <motion.button
                onClick={() => setPendingCoverUrl(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all ${
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
                  className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all ${
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

      {/* Editor Bottom Bar - Edit mode only (analytics view has its own EditorBottomBar above) */}
      <AnimatePresence>
      {(isEditMode && !isPreviewMode) && !(isPublished && !isEditMode) ? (
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
          onDrafts={handleDraftsOpen}
          theme={theme}
          onThemeChange={setTheme}
          uiMode={uiMode}
          onUiModeChange={setUiMode}
          saveDraftLabel={saveDraftLabel}
          isLive={sessionStatus === "open"}
          />
          </motion.div>
      ) : null}
      </AnimatePresence>

      {/* Login Dialog for publish gating */}
      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onContinueAsGuest={handleLoginSuccess}
      />

      {/* Draft Name Dialog */}
      <DraftNameDialog
        open={draftNameOpen}
        onOpenChange={setDraftNameOpen}
        onSave={confirmSaveDraft}
        uiMode={uiMode}
      />

      {/* Drafts Dialog */}
      <DraftsDialog
        open={draftsOpen}
        onOpenChange={(open) => {
          setDraftsOpen(open)
          if (!open) {
            setIsOverwriteMode(false)
          }
        }}
        drafts={drafts}
        isOverwriteMode={isOverwriteMode}
        onLoad={handleLoadDraft}
        onDelete={handleDeleteDraft}
        onOverwrite={handleOverwriteDraft}
        uiMode={uiMode}
        isLoading={loadingDrafts}
      />

      {/* Publish Share Sheet */}
      <PublishShareSheet
        open={publishShareSheetOpen}
        onOpenChange={(open) => {
          setPublishShareSheetOpen(open)
          // When share sheet closes, handle navigation and switch to analytics view
          if (!open && publishedCode) {
            // Navigate to new session URL if needed (only if session was created)
            if (typeof window !== "undefined") {
              const pendingNavigateId = sessionStorage.getItem("pending_navigate_to_session")
              if (pendingNavigateId) {
                sessionStorage.removeItem("pending_navigate_to_session")
                router.replace(`/host/sessions/${pendingNavigateId}/edit`)
              }
            }
            // Mark as published and switch to analytics view
            setIsPublished(true)
            setIsEditMode(false)
            setIsPreviewMode(false)
          }
        }}
        publishedUrl={publishedUrl}
        hostSlug={publishedHostSlug}
        publicCode={publishedCode}
        sessionId={actualSessionId}
        uiMode={uiMode}
      />

      {/* Copy invite link button - Only show in host preview mode, above RSVP dock */}
      <AnimatePresence>
      {isPreviewMode && actualSessionId && !demoMode && (
        <motion.div
          key="copy-link-bar"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-24 left-0 right-0 z-30"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
        >
          <div className="mx-auto max-w-md px-4 pb-2">
            <div className={`${glassCard} rounded-2xl p-3 shadow-xl`}>
              <CopyInviteLinkButton
                sessionId={actualSessionId}
                variant="ghost"
                className={cn(
                  "w-full justify-center",
                  uiMode === "dark"
                    ? "text-white hover:bg-white/10"
                    : "text-black hover:bg-black/10"
                )}
                label="Copy invite link"
              />
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

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
            <div className={`${glassCard} rounded-2xl p-4 shadow-2xl ${rsvpState !== "none" ? "flex flex-col gap-3" : "flex gap-3"}`}>
              {/* Show status message if user has already RSVP'd */}
              {rsvpState !== "none" && (
                <div className="flex flex-col gap-1 pb-2">
                  <p className={`text-base font-semibold ${uiMode === "dark" ? "text-white" : "text-black"}`}>
                    {rsvpState === "joined" ? "You're in ✅" : "You're marked as not going"}
                  </p>
                  <p className={`text-xs ${uiMode === "dark" ? "text-white/60" : "text-black/60"}`}>
                    {rsvpState === "joined" ? "Want to change it? You can decline anytime." : "Plans changed? You can join again."}
                  </p>
                </div>
              )}
              
              <div className="flex gap-3">
                {/* Show appropriate button based on RSVP state */}
                {rsvpState === "none" ? (
                  <>
                    <Button 
                      onClick={onJoinClick || undefined}
                      className="flex-1 bg-gradient-to-r from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] hover:from-[var(--theme-accent)] hover:to-[var(--theme-accent-dark)] text-black font-medium rounded-full h-12 shadow-lg shadow-[var(--theme-accent)]/20"
                    >
                      Join session
                    </Button>
                    <Button
                      onClick={onDeclineClick || undefined}
                      variant="outline"
                      className={`flex-1 bg-transparent ${uiMode === "dark" ? "border-white/20 text-white hover:bg-white/10" : "border-black/20 text-black hover:bg-black/10"} rounded-full h-12`}
                    >
                      Decline
                    </Button>
                  </>
                ) : rsvpState === "joined" ? (
                  <div className="flex justify-center w-full">
                    <Button
                      onClick={onDeclineClick || undefined}
                      className="bg-red-500/20 text-white rounded-full h-12 border border-red-500/40 hover:bg-red-500/40 hover:text-white shadow-none px-6"
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={onJoinClick || undefined}
                    className="flex-1 bg-gradient-to-r from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] hover:from-[var(--theme-accent)] hover:to-[var(--theme-accent-dark)] text-black font-medium rounded-full h-12 shadow-lg shadow-[var(--theme-accent)]/20"
                  >
                    Join instead
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
