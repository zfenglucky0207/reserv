"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform, animate } from "framer-motion"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { TopNav } from "./top-nav"
import { LoginDialog } from "./login-dialog"
import { getCurrentReturnTo, setPostAuthRedirect } from "@/lib/post-auth-redirect"
import {
  Calendar,
  MapPin,
  DollarSign,
  Users,
  Grid3x3,
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
  Sparkles,
  Eye,
  EyeOff,
  AlertTriangle,
  Download,
  Maximize2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { logInfo, logError, newTraceId, withTrace } from "@/lib/logger"
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
import { Share2 } from "lucide-react"
import { HERO_TITLE_SHADOW, HERO_META_SHADOW, HERO_ICON_SHADOW, DEFAULT_COVER_BG, SPORT_COVER_MAP, SPORT_THEME_MAP, TITLE_FONTS } from "@/constants/session-invite-constants"
import { formatCourtDisplay, getSportDisplayName, getCoverOptions, parseEventDate, formatEventDate, isValidGoogleMapsUrl, getValidGoogleMapsUrl, getMapEmbedSrc, normalizeMapUrl, isTitleValid, isDateValid, isLocationValid, isPriceValid, isCapacityValid, isHostValid } from "@/utils/session-invite-helpers"
import { SwipeToJoinSlider } from "@/components/session/swipe-to-join-slider"
import { SessionInviteHero } from "@/components/session/session-invite-hero"
import { SessionInviteContent } from "@/components/session/session-invite-content"
import { SessionInviteModals } from "@/components/session/session-invite-modals"
import { SessionInviteRSVPDock } from "@/components/session/session-invite-rsvp-dock"
import { PullOutButton } from "@/components/session/pull-out-button"

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
  initialCourt?: string | null
  initialHostName?: string | null
  initialDescription?: string | null
  initialMapUrl?: string | null
  initialPaymentQrImage?: string | null
  initialContainerOverlayEnabled?: boolean | null
  demoMode?: boolean
  demoParticipants?: DemoParticipant[]
  hidePreviewBanner?: boolean // New prop to hide preview banner for public view
  onJoinClick?: () => void // RSVP handler for public view
  initialIsPublished?: boolean // New prop to indicate if session is published
  initialSessionStatus?: "draft" | "open" | "closed" | "completed" | "cancelled" // Session status for draft update logic
  rsvpState?: "none" | "joined" | "waitlisted" // Current RSVP state for public view
  waitlist?: Array<{ id: string; display_name: string }> // Waitlist participants for public view
  publicCode?: string // Public code for sharing (available on public invite page)
  hostSlug?: string | null // Host slug for sharing (available on public invite page)
  hasStarted?: boolean // Whether the session has started (for payment flow)
  onMakePaymentClick?: () => void // Handler for make payment button
  payingForParticipantId?: string | null // ID of participant being paid for (first selected, for payment submission)
  payingForParticipantNames?: string[] // Names of all participants being paid for (for display)
  isFull?: boolean // Whether the session is at capacity
  joinedCount?: number // Number of confirmed participants
  participantName?: string | null // Name of the current participant (for success message)
  participantId?: string | null // ID of the current participant (for pull-out functionality)
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
  initialCourt = null,
  initialHostName = null,
  initialDescription = null,
  initialMapUrl = null,
  initialPaymentQrImage = null,
  initialContainerOverlayEnabled = true,
  demoMode = false,
  demoParticipants = [],
  hidePreviewBanner = false,
  onJoinClick,
  initialIsPublished = false,
  initialSessionStatus,
  rsvpState = "none",
  waitlist = [],
  publicCode,
  hostSlug,
  hasStarted = false,
  onMakePaymentClick,
  payingForParticipantId = null,
  payingForParticipantNames = [],
  isFull = false,
  joinedCount = 0,
  participantName = null,
  participantId = null,
}: SessionInviteProps) {
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
  
  // Celebration animation state for joined state
  const [shouldCelebrate, setShouldCelebrate] = useState(false)
  const prevRsvpStateRef = useRef<"none" | "joined" | "waitlisted">(rsvpState)
  
  // Detect join transition and trigger celebration (only once, not on preview mode)
  useEffect(() => {
    if (isPreviewMode) {
      setShouldCelebrate(false)
      prevRsvpStateRef.current = rsvpState
      return
    }
    
    const prev = prevRsvpStateRef.current
    const isJoined = rsvpState === "joined"
    const wasJoined = prev === "joined"
    
    // Trigger celebration when transitioning from non-joined to joined
    if (!wasJoined && isJoined) {
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (!prefersReducedMotion) {
        setShouldCelebrate(true)
        // Auto-hide after animation completes
        const timer = setTimeout(() => setShouldCelebrate(false), 600)
        return () => clearTimeout(timer)
      }
    }
    
    prevRsvpStateRef.current = rsvpState
  }, [rsvpState, isPreviewMode])
  
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

  // Handle share invite link - opens PublishShareSheet
  const handleShareInviteLink = async () => {
    const { getInviteShareUrl } = await import("@/lib/invite-url")

    // Generate URL from props or current URL
    const inviteUrl = getInviteShareUrl({ hostSlug, publicCode })

    if (!inviteUrl || !hostSlug || !publicCode) {
      // If session is not published, show helpful message
      if (!publicCode) {
        toast({
          title: "Publish to generate link",
          description: "Publish the session to get a live invite link.",
          variant: "default",
        })
      } else {
        toast({
          title: "Can't generate share link",
          description: "Missing invite link information.",
          variant: "destructive",
        })
      }
        return
      }

    // Set up the share sheet with the invite URL
    setPublishedUrl(inviteUrl)
    setPublishedHostSlug(hostSlug)
    setPublishedCode(publicCode)
    setPublishedHostName(initialHostName || null)
      setIsShareFromButton(true) // Mark as opened from share button
    setPublishShareSheetOpen(true) // Opens the share sheet
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
  const [publishedHostName, setPublishedHostName] = useState<string | null>(null)
  const [isShareFromButton, setIsShareFromButton] = useState(false) // Track if opened from share button vs publish

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
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false)
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
  const [eventMapUrl, setEventMapUrl] = useState<string>(initialMapUrl || "")
  const [locationDraft, setLocationDraft] = useState<string>(initialLocation || "")
  const [mapUrlDraft, setMapUrlDraft] = useState<string>("")
  const [courtDraft, setCourtDraft] = useState<string>(initialCourt || "")
  const [eventPrice, setEventPrice] = useState(initialPrice ?? (isEmptySession ? 0 : 15))
  const [eventCapacity, setEventCapacity] = useState(initialCapacity ?? (isEmptySession ? 0 : 8))
  const [eventCourt, setEventCourt] = useState(initialCourt || "")
  const [containerOverlayEnabled, setContainerOverlayEnabled] = useState(initialContainerOverlayEnabled ?? true)


  // Sync eventCourt when initialCourt prop changes (e.g., when session data loads)
  useEffect(() => {
    if (initialCourt !== undefined && initialCourt !== null) {
      setEventCourt(initialCourt)
    }
  }, [initialCourt])

  // Sync containerOverlayEnabled when initialContainerOverlayEnabled prop changes
  useEffect(() => {
    if (initialContainerOverlayEnabled !== undefined && initialContainerOverlayEnabled !== null) {
      setContainerOverlayEnabled(initialContainerOverlayEnabled)
    }
  }, [initialContainerOverlayEnabled])

  // Sync eventMapUrl when initialMapUrl prop changes (e.g., when session data loads)
  useEffect(() => {
    if (initialMapUrl !== undefined && initialMapUrl !== null) {
      setEventMapUrl(initialMapUrl)
    }
  }, [initialMapUrl])

  // Helper function to format court display
  const formatCourtDisplay = (courtValue: string): string => {
    if (!courtValue) return ""
    const trimmed = courtValue.trim()
    // If already starts with "Court" or "Courts", return as is
    if (/^Courts?/i.test(trimmed)) {
      return trimmed
    }
    // Check if it contains commas (multiple courts)
    if (trimmed.includes(",")) {
      return `Courts ${trimmed}`
    }
    // Single court, add "Court" prefix
    return `Court ${trimmed}`
  }
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
    
    // Only sync if initialCoverUrl actually changed from what we last synced
    // This confirms the DB update succeeded and router.refresh() brought back the new value
    if (normalizedInitial !== lastSyncedInitialCoverUrlRef.current) {
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
    // Store previous for rollback using functional update to get current value
    const wasModalOpen = isCoverPickerOpen
    
    // Immediately update UI (optimistic)
    setOptimisticCoverUrl((prev) => {
      previousCoverUrlRef.current = prev
      return coverUrl
    })
    setIsCoverPickerOpen(false)

    // If no sessionId, just update local state (for new sessions)
    if (!sessionId || sessionId === "new" || sessionId === "edit") {
      toast({
        title: "Cover updated",
        description: "Cover will be saved when you publish the session.",
        variant: "success",
      })
      return
    }

    try {
      // Persist to database (coverUrl can be null for default color)
      const { updateSessionCoverUrl } = await import("@/app/host/sessions/[id]/actions")
      const result = await updateSessionCoverUrl(sessionId, coverUrl)

      // Success: keep optimistic state, refresh server components
      toast({
        title: "Cover updated",
        description: "Session cover image has been changed.",
        variant: "success",
      })
      
      // Refresh to sync server components (but UI is already updated optimistically)
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

  // Handle cover image upload with compression
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

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 10MB.",
          variant: "default",
        })
        return
      }

      // Compress and convert to data URL
      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1920 // Max width for cover images
          const MAX_HEIGHT = 1080 // Max height for cover images
          
          let width = img.width
          let height = img.height
          
          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height
              height = MAX_HEIGHT
            }
          }
          
          canvas.width = width
          canvas.height = height
          
          // Draw and compress
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            
            // Convert to data URL with compression (0.85 quality for good balance)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
            
            // Check compressed size (base64 is ~33% larger than binary)
            const base64Size = compressedDataUrl.length
            const estimatedBinarySize = (base64Size * 3) / 4
            const estimatedMB = estimatedBinarySize / (1024 * 1024)
            
            if (estimatedMB > 5) {
              // If still too large, compress more aggressively
              const moreCompressed = canvas.toDataURL('image/jpeg', 0.7)
              setPendingCoverUrl(moreCompressed)
            } else {
              setPendingCoverUrl(compressedDataUrl)
            }
            
          toast({
            title: "Image selected",
            description: "Click Confirm to apply the cover image.",
            variant: "success",
          })
        }
        }
        img.onerror = () => {
          toast({
            title: "Upload failed",
            description: "Failed to process the image file.",
            variant: "default",
          })
        }
        img.src = reader.result as string
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
  const [paymentQrImage, setPaymentQrImage] = useState<string | null>(initialPaymentQrImage || null)
  const [qrImageModalOpen, setQrImageModalOpen] = useState(false)
  const [proofImage, setProofImage] = useState<string | null>(null) // For payment proof in preview mode
  const [proofImageFile, setProofImageFile] = useState<File | null>(null) // Store actual File object for upload
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [proofSubmitted, setProofSubmitted] = useState(false)

  const [theme, setTheme] = useState("badminton")
  const [effects, setEffects] = useState({
    grain: true,
    glow: false,
    vignette: true,
  })

  // Draft persistence key
  const draftKey = useMemo(() => {
    if (isEmptySession) {
      return "reserv:editDraft:new"
    }
    if (actualSessionId && actualSessionId !== "new" && actualSessionId !== "edit") {
      return `reserv:editDraft:${actualSessionId}`
    }
    // Fallback: use publicCode if available, otherwise "new"
    if (publicCode) {
      return `reserv:editDraft:${publicCode}`
    }
    return "reserv:editDraft:new"
  }, [isEmptySession, actualSessionId, publicCode])

  // Draft auto-save debounce ref
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)

  // Restore draft on mount (only once, before first render if possible)
  useLayoutEffect(() => {
    if (!isEditMode || isPreviewMode || draftRestored) return

    try {
      const stored = localStorage.getItem(draftKey)
      if (stored) {
        const draft = JSON.parse(stored)

        // Restore all form fields
        if (draft.eventTitle !== undefined) setEventTitle(draft.eventTitle || "")
        if (draft.titleFont !== undefined) setTitleFont(draft.titleFont || "Classic")
        if (draft.eventDate !== undefined) setEventDate(draft.eventDate || "")
        if (draft.selectedDateDraft !== undefined) setSelectedDateDraft(draft.selectedDateDraft ? new Date(draft.selectedDateDraft) : null)
        if (draft.selectedTimeDraft !== undefined) setSelectedTimeDraft(draft.selectedTimeDraft || { hour: 9, minute: 0, ampm: "AM" })
        if (draft.selectedDurationDraft !== undefined) setSelectedDurationDraft(draft.selectedDurationDraft || 2)
        if (draft.eventLocation !== undefined) setEventLocation(draft.eventLocation || "")
        if (draft.locationDraft !== undefined) setLocationDraft(draft.locationDraft || "")
        if (draft.eventMapUrl !== undefined) setEventMapUrl(draft.eventMapUrl || "")
        if (draft.mapUrlDraft !== undefined) setMapUrlDraft(draft.mapUrlDraft || "")
        if (draft.courtDraft !== undefined) setCourtDraft(draft.courtDraft || "")
        if (draft.eventCourt !== undefined) setEventCourt(draft.eventCourt || "")
        if (draft.eventPrice !== undefined) setEventPrice(draft.eventPrice ?? 0)
        if (draft.eventCapacity !== undefined) setEventCapacity(draft.eventCapacity ?? 0)
        if (draft.hostNameInput !== undefined) setHostNameInput(draft.hostNameInput || "")
        if (draft.selectedSport !== undefined) setSelectedSport(draft.selectedSport || "Badminton")
        if (draft.eventDescription !== undefined) setEventDescription(draft.eventDescription || "")
        if (draft.optimisticCoverUrl !== undefined) setOptimisticCoverUrl(draft.optimisticCoverUrl || null)
        if (draft.containerOverlayEnabled !== undefined) setContainerOverlayEnabled(draft.containerOverlayEnabled ?? true)
        if (draft.bankName !== undefined) setBankName(draft.bankName || "")
        if (draft.accountNumber !== undefined) setAccountNumber(draft.accountNumber || "")
        if (draft.accountName !== undefined) setAccountName(draft.accountName || "")
        if (draft.paymentNotes !== undefined) setPaymentNotes(draft.paymentNotes || "")
        if (draft.paymentQrImage !== undefined) setPaymentQrImage(draft.paymentQrImage || null)
        if (draft.theme !== undefined) setTheme(draft.theme || "badminton")
        if (draft.effects !== undefined) setEffects(draft.effects || { grain: true, glow: false, vignette: false })

        setDraftRestored(true)
        
        // Show toast notification
        toast({
          title: "Draft restored",
          description: "Your previous edits have been restored.",
          variant: "default",
        })
      } else {
        setDraftRestored(true) // Mark as checked even if no draft found
      }
    } catch (error) {
      console.error("[draft] restore failed", { key: draftKey, error })
      setDraftRestored(true) // Mark as checked even on error
    }
  }, [isEditMode, isPreviewMode, draftKey, draftRestored, toast])

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!isEditMode || isPreviewMode || !draftRestored) return

    // Clear existing timeout
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current)
    }

    // Set new timeout for debounced save
    draftSaveTimeoutRef.current = setTimeout(() => {
      try {
        const draft = {
          version: 1,
          updatedAt: new Date().toISOString(),
          eventTitle,
          titleFont,
          eventDate,
          selectedDateDraft: selectedDateDraft ? selectedDateDraft.toISOString() : null,
          selectedTimeDraft,
          selectedDurationDraft,
          eventLocation,
          locationDraft,
          eventMapUrl,
          mapUrlDraft,
          courtDraft,
          eventCourt,
          eventPrice,
          eventCapacity,
          hostNameInput,
          selectedSport,
          eventDescription,
          optimisticCoverUrl,
          containerOverlayEnabled,
          bankName,
          accountNumber,
          accountName,
          paymentNotes,
          paymentQrImage,
          theme,
          effects,
        }
        localStorage.setItem(draftKey, JSON.stringify(draft))
      } catch (error) {
        console.error("[draft] autosave failed", { key: draftKey, error })
      }
    }, 300) // 300ms debounce

    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current)
      }
    }
  }, [
    isEditMode,
    isPreviewMode,
    draftRestored,
    draftKey,
    eventTitle,
    titleFont,
    eventDate,
    selectedDateDraft,
    selectedTimeDraft,
    selectedDurationDraft,
    eventLocation,
    locationDraft,
    mapUrlDraft,
    courtDraft,
    eventCourt,
    eventPrice,
    eventCapacity,
    hostNameInput,
    selectedSport,
    eventDescription,
    optimisticCoverUrl,
    containerOverlayEnabled,
    bankName,
    accountNumber,
    accountName,
    paymentNotes,
    paymentQrImage,
    theme,
    effects,
  ])

  // Handle sport change - only update sport and theme, NOT cover
  const handleSportChange = (sport: string) => {
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
    if (isCourtModalOpen) {
      setCourtDraft(eventCourt)
    }
  }, [isLocationModalOpen, eventLocation, eventMapUrl, isCourtModalOpen, eventCourt])

  // Helper function to validate if a string is a valid Google Maps URL
  const isValidGoogleMapsUrl = (value: string | null | undefined): boolean => {
    if (!value || !value.trim()) {
      return false
    }

    try {
      const url = new URL(value.trim())
      const hostname = url.hostname.toLowerCase()
      
      // Explicitly reject share.google links (these are share links, not maps links)
      if (hostname.includes("share.google")) {
        return false
      }
      
      // Check if hostname is a Google Maps domain
      const isGoogleMapsDomain = 
        (hostname.includes("google.com") && url.pathname.includes("/maps")) ||
        hostname.includes("maps.app.goo.gl") ||
        (hostname.includes("goo.gl") && url.pathname.includes("/maps")) ||
        hostname === "maps.google.com" ||
        hostname === "www.google.com" // Allow www.google.com if path includes /maps
      
      if (!isGoogleMapsDomain) {
        return false
      }
      
      return true
    } catch {
      // Not a valid URL
      return false
    }
  }

  // Helper function to get the Google Maps URL to embed (checks both eventMapUrl and eventLocation)
  const getValidGoogleMapsUrl = (): string | null => {
    // First check eventMapUrl (dedicated map URL field)
    if (eventMapUrl && isValidGoogleMapsUrl(eventMapUrl)) {
      return eventMapUrl.trim()
    }
    
    // Then check eventLocation (might contain a Google Maps URL)
    if (eventLocation && isValidGoogleMapsUrl(eventLocation)) {
      return eventLocation.trim()
    }
    
    return null
  }

  // Helper function to convert map URL to embed URL
  // Uses the shared helper from utils to avoid duplication
  const getMapEmbedSrc = (mapUrl: string): string => {
    const { getMapEmbedSrc: getEmbedSrc } = require("@/utils/session-invite-helpers")
    return getEmbedSrc(mapUrl)
  }

  const handleLocationSave = () => {
    const trimmedLocation = locationDraft.trim()
    const trimmedMapUrl = mapUrlDraft.trim()
    
    // Don't allow empty location override; fallback to current
    if (trimmedLocation) {
      setEventLocation(trimmedLocation)
    }
    
    // Normalize map URL - extract from iframe HTML if needed, or use as-is
    let normalizedMapUrl = trimmedMapUrl
    if (normalizedMapUrl) {
      // Extract URL from iframe HTML if present, otherwise use as-is
      const extracted = normalizeMapUrl(normalizedMapUrl)
      
      if (extracted) {
        normalizedMapUrl = extracted
      } else if (!normalizedMapUrl.startsWith("http://") && !normalizedMapUrl.startsWith("https://")) {
        // If not an iframe and not a full URL, prepend https://
      normalizedMapUrl = `https://${normalizedMapUrl}`
      }
    }
    setEventMapUrl(normalizedMapUrl)
    
    setIsLocationModalOpen(false)
    toast({
      title: "Location updated",
      description: "Session location has been saved.",
      variant: "success",
    })
  }

  // Handle court save
  const handleCourtSave = () => {
    setEventCourt(courtDraft.trim())
    setIsCourtModalOpen(false)
    toast({
      title: "Courts updated",
      description: "Court information has been saved.",
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

  // Download QR image function
  const handleDownloadQrImage = () => {
    if (!paymentQrImage) return

    try {
      // Convert base64 to blob
      const base64Data = paymentQrImage.split(',')[1] || paymentQrImage
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'payment-qr-code.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download QR image:', error)
    }
  }

  const handleProofImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 10MB.",
          variant: "default",
        })
        return
      }

      // Compress and convert to data URL
      // Payment proof optimization: 720px longest edge, JPEG quality 65
      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas')
          const MAX_LONGEST_EDGE = 720 // Recommended for payment proofs (receipts/screenshots)
          
          let width = img.width
          let height = img.height
          const longestEdge = Math.max(width, height)
          
          // Calculate new dimensions while maintaining aspect ratio
          // Resize to 720px on longest edge
          if (longestEdge > MAX_LONGEST_EDGE) {
            const scale = MAX_LONGEST_EDGE / longestEdge
            width = Math.round(width * scale)
            height = Math.round(height * scale)
          }
          
          canvas.width = width
          canvas.height = height
          
          // Draw and compress
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Use high-quality rendering for text readability
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, width, height)
            
            // Convert to JPEG with quality 65 (optimal for receipts/screenshots)
            // This keeps text readable while minimizing file size
            let compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65)
            
            // Check compressed size (base64 is ~33% larger than binary)
            const base64Size = compressedDataUrl.length
            const estimatedBinarySize = (base64Size * 3) / 4
            const estimatedKB = estimatedBinarySize / 1024
            
            // If still too large (>500KB), compress more aggressively
            if (estimatedKB > 500) {
              compressedDataUrl = canvas.toDataURL('image/jpeg', 0.60)
              const newBase64Size = compressedDataUrl.length
              const newEstimatedKB = ((newBase64Size * 3) / 4) / 1024
              
              // If still too large, reduce quality further
              if (newEstimatedKB > 500) {
                compressedDataUrl = canvas.toDataURL('image/jpeg', 0.55)
              }
            }
            
            // Store compressed data URL for preview and submission
            setProofImage(compressedDataUrl)
            
            // Create a File object from the compressed data URL for submission
            // Convert data URL to blob directly (more reliable than fetch)
            try {
              // Extract base64 data from data URL (format: data:image/jpeg;base64,/9j/4AAQ...)
              const base64Data = compressedDataUrl.includes(',') ? compressedDataUrl.split(',')[1] : compressedDataUrl
              const byteCharacters = atob(base64Data)
              const byteNumbers = new Array(byteCharacters.length)
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
              }
              const byteArray = new Uint8Array(byteNumbers)
              const blob = new Blob([byteArray], { type: 'image/jpeg' })
              
              // Create File from blob (strips metadata)
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' })
              setProofImageFile(compressedFile)
              
            } catch (error) {
              console.error("Error creating compressed file:", error)
              // Fallback: use original file if compression file creation fails
              setProofImageFile(file)
            }
            
            toast({
              title: "Image uploaded",
              description: "Payment proof image has been optimized and uploaded.",
              variant: "success",
            })
          }
        }
        img.onerror = () => {
          toast({
            title: "Upload failed",
            description: "Failed to process the image file.",
            variant: "default",
          })
        }
        img.src = reader.result as string
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

  // Check localStorage for submitted payment proof
  useEffect(() => {
    if (typeof window !== "undefined" && actualSessionId) {
      const cacheKey = `sl:paymentSubmitted:${actualSessionId}`
      const cached = localStorage.getItem(cacheKey)
      if (cached === "true") {
        setProofSubmitted(true)
      }
    }
  }, [actualSessionId])

  const handleSubmitPaymentProof = async () => {
    if (!proofImage && !proofImageFile) {
      toast({
        title: "Error",
        description: "No payment proof image selected.",
        variant: "destructive",
      })
      return
    }

    if (!actualSessionId) return

    if (typeof window === "undefined") return

    const traceId = newTraceId("upload")

    // Get guest key for participant identification
    const { getOrCreateGuestKey } = await import("@/lib/guest-key")
    const guestKey = getOrCreateGuestKey()

    // Get participant ID from props or state (if available)
    const participantIdForUpload = (typeof window !== "undefined" && (window as any).__payingForParticipantId) || null
    
    logInfo("upload_start", withTrace({
      participantId: participantIdForUpload,
      fileName: proofImageFile?.name || "payment-proof.jpg",
      fileSize: proofImageFile?.size || 0,
      mime: proofImageFile?.type || "image/jpeg",
      sessionId: actualSessionId,
      guestKey,
      hasCompressedImage: !!proofImage,
    }, traceId))

    setIsSubmittingProof(true)

    try {
      // Use the already-compressed proofImage (data URL) if available, otherwise convert file
      let base64Data: string
      
      if (proofImage) {
        // Use the compressed image that was already created during upload
        base64Data = proofImage
      } else if (proofImageFile) {
        // Fallback: convert file to base64 (shouldn't happen if compression worked)
      const reader = new FileReader()
        const promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            resolve(reader.result as string)
          }
          reader.onerror = reject
          reader.readAsDataURL(proofImageFile!)
        })
        base64Data = await promise
      } else {
        toast({
          title: "Error",
          description: "No payment proof image selected.",
          variant: "destructive",
        })
        setIsSubmittingProof(false)
        return
      }

        const { submitPaymentProof } = await import("@/app/session/[id]/actions")
      
      // Use participant ID from props
      if (!payingForParticipantId) {
        logError("upload_failed", withTrace({
          error: "No participant ID provided",
          stage: "validation",
        }, traceId))
        toast({
          title: "Error",
          description: "Please select who you're paying for first.",
          variant: "destructive",
        })
        setIsSubmittingProof(false)
        return
      }
        
        const result = await submitPaymentProof(
          actualSessionId,
        payingForParticipantId,
          base64Data,
        proofImageFile?.name || "payment-proof.jpg"
        )

        if (result.ok) {
        logInfo("upload_success", withTrace({
          storagePath: result.storagePath || null,
          publicUrl: result.publicUrl || null,
          paymentProofId: result.paymentProofId,
        }, traceId))
        
          // Mark as submitted
          setProofSubmitted(true)
          const cacheKey = `sl:paymentSubmitted:${actualSessionId}`
          localStorage.setItem(cacheKey, "true")

          toast({
            title: "Payment proof submitted",
            description: "Your payment proof has been submitted for review.",
            variant: "success",
          })

          // Clear file and preview
          setProofImageFile(null)
          setProofImage(null)
        } else {
        logError("upload_failed", withTrace({
          error: result.error,
          stage: "server_action",
        }, traceId))
          toast({
            title: "Failed to submit payment proof",
            description: result.error,
            variant: "destructive",
          })
        }
        setIsSubmittingProof(false)
    } catch (error: any) {
      logError("upload_failed", withTrace({
        error: error?.message || "Unknown error",
        stack: error?.stack,
        stage: "exception",
      }, traceId))
      toast({
        title: "Upload failed",
        description: error?.message || "Failed to upload payment proof. Please try again.",
        variant: "destructive",
      })
      setIsSubmittingProof(false)
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
          // Draft is auto-saved via useEffect, so we just need to store publish intent
        sessionStorage.setItem("pending_publish", "true")
          // Capture current URL for redirect after login
          const returnTo = getCurrentReturnTo()
          // Set post-auth redirect
          setPostAuthRedirect(returnTo)
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
        courtNumbers: eventCourt || null,
        containerOverlayEnabled: containerOverlayEnabled,
        mapUrl: eventMapUrl || null,
        paymentQrImage: paymentQrImage || null,
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
        setIsShareFromButton(false) // Mark as opened from publish
        
        // Update actualSessionId if session was created
        const finalSessionId = result.sessionId || publishSessionId || actualSessionId
        if (result.sessionId) {
          setActualSessionId(result.sessionId)
          // Store in sessionStorage so we can navigate after share sheet closes
          if (typeof window !== "undefined" && result.sessionId !== sessionId) {
            sessionStorage.setItem("pending_navigate_to_session", result.sessionId)
          }
        }

        // Clear draft on successful publish
        try {
          localStorage.removeItem(draftKey)
        } catch (error) {
          console.error("[draft] clear failed", { key: draftKey, error })
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
      // Force save draft immediately (no debounce) before login
      if (typeof window !== "undefined") {
        try {
          const draft = {
            version: 1,
            updatedAt: new Date().toISOString(),
            eventTitle,
            titleFont,
            eventDate,
            selectedDateDraft: selectedDateDraft ? selectedDateDraft.toISOString() : null,
            selectedTimeDraft,
          selectedDurationDraft,
          eventLocation,
          locationDraft,
          eventMapUrl,
          mapUrlDraft,
          courtDraft,
          eventCourt,
          eventPrice,
          eventCapacity,
          hostNameInput,
          selectedSport,
          eventDescription,
          optimisticCoverUrl,
          containerOverlayEnabled,
          bankName,
          accountNumber,
          accountName,
          paymentNotes,
          paymentQrImage,
          theme,
          effects,
        }
        localStorage.setItem(draftKey, JSON.stringify(draft))
        } catch (error) {
          console.error("[draft] force save failed", { key: draftKey, error })
        }
        
        sessionStorage.setItem("pending_save_draft", "true")
        // Capture current URL for redirect after login
        const returnTo = getCurrentReturnTo()
        // Set post-auth redirect
        setPostAuthRedirect(returnTo)
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

  // If published, show analytics view instead of edit/preview
  // But don't show analytics if share sheet is open (let user see the share sheet first)
  // Or if edit mode is explicitly requested (via ?mode=edit query param or initialEditMode prop)
  // Or if preview mode is explicitly requested (via ?mode=preview query param or initialPreviewMode prop)
  if (isPublished && actualSessionId && !demoMode && !publishShareSheetOpen && !mustRenderEditor && !initialPreviewMode) {
    // Check if we're in payments mode
    const mode = searchParams.get("mode")
    const showPaymentsView = mode === "payments"
    
    return (
      <div className="min-h-screen sporty-bg">
        <TopNav showCreateNow={false} />
        <HostSessionAnalytics sessionId={actualSessionId} uiMode={uiMode} />
        {/* Editor Bottom Bar with Edit button - hide when in payments view with slide-down animation */}
        <AnimatePresence>
          {!showPaymentsView && (
            <motion.div
              key="editorbar"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
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
          )}
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
        <div className="absolute top-16 left-4 z-50">
          <Button
            onClick={() => router.push(`/host/sessions/${actualSessionId}/edit`)}
            variant="ghost"
            className={cn(
              "rounded-full h-10 px-4 gap-2 backdrop-blur-xl border shadow-lg",
              uiMode === "dark"
                ? "bg-black/40 border-white/20 text-white hover:bg-black/60"
                : "bg-white/80 border-black/20 text-black hover:bg-white/90"
            )}
          >
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm font-medium">Go to Session Control</span>
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

      {/* Go to Analytics Button - show when session is live and in preview mode */}
      {isPreviewMode && sessionStatus === "open" && actualSessionId && (
        <div className="absolute top-30 left-4 z-50">
          <Button
            onClick={() => router.push(`/host/sessions/${actualSessionId}/edit`)}
            variant="ghost"
            className={cn(
              "rounded-full h-10 px-4 gap-2 backdrop-blur-xl border shadow-lg",
              uiMode === "dark"
                ? "bg-black/40 border-white/20 text-white hover:bg-black/60"
                : "bg-white/10 border-black/20 text-black hover:bg-white/20"
            )}
          >
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm font-medium">Go to Session Control</span>
          </Button>
        </div>
      )}


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


            {/* Lighter gradient overlay - Only for edit mode */}
            {isEditMode && !isPreviewMode && (
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/60" />
            )}

            {/* Scroll Cue - Only show in preview/public mode when not scrolled */}
            {(!isEditMode || isPreviewMode) && !scrolled && (
              <motion.div
                className="fixed left-0 right-0 bottom-[140px] z-30 flex justify-center pointer-events-none"
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
              className={`relative z-10 flex flex-col min-h-[85vh] px-6 pb-[200px] text-white ${
                isEditMode && !isPreviewMode ? "pt-16" : "pt-24"
              }`}
            >
            <div className={cn("flex-1 flex flex-col justify-between relative", isPreviewMode && "pointer-events-none")}>
              {/* Toggle button - Only in preview mode, positioned top-right (always visible) */}
              {isPreviewMode && (
                <div className="absolute -right-1 -top-1 z-30 pointer-events-auto">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      const newValue = !containerOverlayEnabled
                      setContainerOverlayEnabled(newValue)
                      
                      // Save preference to database if session exists
                      if (sessionId && sessionId !== "new" && sessionId !== "edit") {
                        try {
                          const { updateSessionContainerOverlay } = await import("@/app/host/sessions/[id]/actions")
                          await updateSessionContainerOverlay(sessionId, newValue)
                          router.refresh() // Refresh to sync with server state
                        } catch (error) {
                          console.error("[ContainerOverlayToggle] Error saving preference:", error)
                          // Revert on error
                          setContainerOverlayEnabled(!newValue)
                        }
                      }
                    }}
                    className={cn(
                      "rounded-full h-9 w-9 flex items-center justify-center",
                      "border border-white/12 bg-white/8 backdrop-blur-xl",
                      "text-white/85 transition-all duration-200",
                      "hover:bg-white/12 active:scale-95 shadow-lg"
                    )}
                    aria-pressed={containerOverlayEnabled}
                    aria-label="Toggle readability overlay"
                    type="button"
                  >
                    {containerOverlayEnabled ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Local text backdrop - uses saved preference (containerOverlayEnabled) for both preview and public invite */}
              {containerOverlayEnabled && (
                <div className="absolute -inset-4 z-0 pointer-events-none rounded-[28px]">
                  {/* Text container overlay backdrop */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-black/0 blur-[2px] rounded-[28px]"
                    style={{
                      maskImage: "radial-gradient(120% 120% at 20% 20%, black 45%, transparent 75%)",
                      WebkitMaskImage: "radial-gradient(120% 120% at 20% 20%, black 45%, transparent 75%)",
                    }}
                  />
                </div>
              )}
              {/* Top Section */}
                <motion.div layout transition={{ duration: 0.22, ease: "easeOut" }} className="relative z-10">
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
                    <Badge className={cn("bg-[var(--theme-accent)]/20 text-[var(--theme-accent-light)] border-[var(--theme-accent)]/30 px-3 py-1.5 text-xs font-medium", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>
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
                        className={cn(
                          "text-4xl font-bold text-white",
                          isPreviewMode ? "text-left" : "text-center",
                          TITLE_FONTS[titleFont],
                          !eventTitle && "italic opacity-60",
                          (!isEditMode || isPreviewMode) && HERO_TITLE_SHADOW
                        )}
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

                          {/* Courts Booked Button */}
                          <motion.button
                            onClick={() => setIsCourtModalOpen(true)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.15 }}
                            className={cn(`w-full ${glassCard} rounded-2xl p-4 flex items-center gap-3 text-left min-h-[54px]`)}
                          >
                            <Grid3x3 className="w-5 h-5 text-[var(--theme-accent-light)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className={`text-xs ${mutedText} uppercase tracking-wide mb-0.5`}>Courts booked</p>
                              <p className={`${eventCourt ? strongText : mutedText} ${!eventCourt ? "italic" : ""} font-medium`}>
                                {eventCourt ? formatCourtDisplay(eventCourt) : "Enter court numbers (optional)"}
                              </p>
                            </div>
                            <ChevronRight className={`w-5 h-5 ${uiMode === "dark" ? "text-white/40" : "text-black/40"} flex-shrink-0`} />
                          </motion.button>

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
                          <Calendar className={cn("w-5 h-5 text-white/60 mt-0.5", (!isEditMode || isPreviewMode) && HERO_ICON_SHADOW)} />
                          <p className={cn("text-base text-white", !eventDate && "italic opacity-60", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>
                            {eventDate || "Choose date"}
                          </p>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className={cn("w-5 h-5 text-white/60 mt-0.5", (!isEditMode || isPreviewMode) && HERO_ICON_SHADOW)} />
                          <p className={cn("text-sm sm:text-base text-white break-words min-w-0", !eventLocation && "italic opacity-60", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>
                            {eventLocation || "Enter location"}
                          </p>
                        </div>
                        {/* Courts Booked - only show if court info exists */}
                        {eventCourt && (
                          <div className="flex items-start gap-3">
                            <Grid3x3 className={cn("w-5 h-5 text-white/60 mt-0.5 flex-shrink-0", (!isEditMode || isPreviewMode) && HERO_ICON_SHADOW)} />
                            <p className={cn("text-base text-white break-words min-w-0", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>
                              {formatCourtDisplay(eventCourt)}
                            </p>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <DollarSign className={cn("w-5 h-5 text-white/60 mt-0.5", (!isEditMode || isPreviewMode) && HERO_ICON_SHADOW)} />
                          <p className={cn("text-base text-white", (!eventPrice || eventPrice === 0) && "italic opacity-60", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>
                            {eventPrice && eventPrice > 0 
                              ? `$${eventPrice} ${demoMode ? "per chick" : "per person"}` 
                              : "Enter cost"}
                          </p>
                        </div>
                        <div className="flex items-start gap-3">
                          <Users className={cn("w-5 h-5 text-white/60 mt-0.5", (!isEditMode || isPreviewMode) && HERO_ICON_SHADOW)} />
                          <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn("text-base text-white", (!eventCapacity || eventCapacity === 0) && "italic opacity-60", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>
                            {eventCapacity && eventCapacity > 0 ? `${eventCapacity} spots total` : "Enter number of spots"}
                          </p>
                            {/* FULL badge when session is at capacity (public view only) */}
                            {!isEditMode && !isPreviewMode && isFull && (
                              <Badge className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-500/20 text-red-200 border border-red-500/30 backdrop-blur">
                                <AlertTriangle className="w-3 h-3" />
                                FULL
                              </Badge>
                            )}
                          </div>
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
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className={cn("text-xs text-white/70 uppercase tracking-wide", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>Hosted by</p>
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
                              "bg-transparent border-none border-b border-transparent text-white font-medium focus:outline-none focus:ring-0 focus:border-b p-0 transition-colors disabled:opacity-50 w-full placeholder:italic",
                              fieldErrors.host ? "border-red-500/70 focus:border-red-500/70" : "focus:border-white/30"
                            )}
                            placeholder={getUserProfileName() ?? "Your name"}
                        />
                      ) : (
                          <p className={cn("font-medium text-white truncate", (!displayHostName || displayHostName === "Your name") && "italic opacity-60", (!isEditMode || isPreviewMode) && HERO_META_SHADOW)}>
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
            className="px-6 pt-8 pb-[200px] space-y-4"
          >
          {/* Content Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className={`${glassCard} p-6`}>
              <h2 className={`text-lg font-semibold ${strongText} mb-2`}>About this session</h2>
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
                <p className={`${mutedText} ${!eventDescription ? "italic opacity-60" : ""} text-sm leading-relaxed whitespace-pre-wrap`}>
                  {eventDescription || "Add a short description for participants"}
                </p>
              )}
            </Card>
          </motion.div>

          {(!isEditMode || isPreviewMode) && eventLocation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className={`${glassCard} p-6`}>
                <h2 className={`text-lg font-semibold ${strongText} mb-2`}>Location</h2>
                <p className={`${mutedText} text-sm mb-4`}>{eventLocation}</p>
                {(() => {
                  // Only show map embed if there's a valid Google Maps URL
                  const validMapUrl = getValidGoogleMapsUrl()
                  
                  // Demo mode
                  if (demoMode) {
                    return (
                      <div className="w-full h-48 rounded-lg overflow-hidden bg-gradient-to-br from-lime-100 to-emerald-100 flex items-center justify-center">
                        <div className="text-center">
                          <MapPin className="w-12 h-12 mx-auto mb-2 text-lime-600" />
                          <p className="text-sm text-black font-medium">Map preview (demo)</p>
                        </div>
                      </div>
                    )
                  }
                  
                  // Only show map iframe if we have a valid Google Maps URL
                  if (validMapUrl) {
                    return (
                      <div className="relative w-full h-48 rounded-2xl overflow-hidden">
                        <iframe
                          src={getMapEmbedSrc(validMapUrl)}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Session location"
                        />
                      </div>
                    )
                  }
                  
                  // No valid map URL - don't show map embed at all
                  return null
                })()}
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
                <div className="flex items-center justify-between mb-2">
                  <h2 className={`text-lg font-semibold ${strongText}`}>Going</h2>
                  <div className="flex items-center gap-2">
                  <Badge className="bg-[var(--theme-accent)]/20 text-[var(--theme-accent-light)] border-[var(--theme-accent)]/30">
                      {joinedCount > 0 ? joinedCount : demoParticipants.length} / {eventCapacity || "∞"}
                  </Badge>
                    {isFull && eventCapacity && eventCapacity > 0 && (
                      <Badge className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-500/20 text-red-200 border border-red-500/30 backdrop-blur">
                        <AlertTriangle className="w-3 h-3" />
                        Full
                      </Badge>
                    )}
                  </div>
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

                {/* Waitlist section - shown below joined participants */}
                {!isEditMode && !isPreviewMode && waitlist && waitlist.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                      <h3 className={cn("text-xs font-medium uppercase tracking-wide", mutedText)}>Waitlist</h3>
                      <Badge className={cn(
                        "text-[10px] px-1.5 py-0.5",
                        uiMode === "dark" 
                          ? "bg-amber-500/10 text-amber-400/60 border-amber-500/20" 
                          : "bg-amber-500/10 text-amber-600/70 border-amber-500/20"
                      )}>
                        {waitlist.length}
                    </Badge>
                  </div>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                      {waitlist.map((participant) => (
                        <div
                          key={participant.id}
                          className={cn(
                            "px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0",
                            "text-xs font-medium",
                            uiMode === "dark"
                              ? "bg-white/5 border border-white/10 text-white/60"
                              : "bg-black/5 border border-black/10 text-black/60"
                          )}
                        >
                          {participant.display_name}
                              </div>
                      ))}
                            </div>
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
                    <div
                      onClick={() => setQrImageModalOpen(true)}
                      className="relative w-full max-w-[200px] mx-auto cursor-pointer group"
                    >
                      <img
                        src={paymentQrImage || "/placeholder.svg"}
                        alt="Payment QR"
                        className="w-full rounded-lg transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>
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

                {/* QR Image Modal */}
                <Dialog open={qrImageModalOpen} onOpenChange={setQrImageModalOpen}>
                  <DialogContent className={cn(
                    "sm:max-w-[90vw] max-w-[95vw] p-0 gap-0 overflow-hidden",
                    uiMode === "dark" ? "bg-slate-900 border-white/10" : "bg-white border-black/10"
                  )}>
                    <DialogHeader className="sr-only">
                      <DialogTitle>Payment QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="relative w-full h-auto flex items-center justify-center bg-black/5 p-4">
                      {/* Download button at top right */}
                      <button
                        onClick={handleDownloadQrImage}
                        className={cn(
                          "absolute top-4 right-4 z-10 p-3 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95",
                          uiMode === "dark"
                            ? "bg-white/90 text-black hover:bg-white"
                            : "bg-black/90 text-white hover:bg-black"
                        )}
                        aria-label="Download QR code"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      
                      {/* Close button */}
                      <button
                        onClick={() => setQrImageModalOpen(false)}
                        className={cn(
                          "absolute top-4 left-4 z-10 p-3 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95",
                          uiMode === "dark"
                            ? "bg-white/90 text-black hover:bg-white"
                            : "bg-black/90 text-white hover:bg-black"
                        )}
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      {/* QR Image */}
                      <img
                        src={paymentQrImage || "/placeholder.svg"}
                        alt="Payment QR Code"
                        className="max-w-full max-h-[70vh] w-auto h-auto rounded-lg"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            </motion.div>
          )}

          {(!isEditMode || isPreviewMode) && actualSessionId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className={`${glassCard} p-6`}>
                <h2 className={`text-lg font-semibold ${strongText} mb-2`}>Upload payment proof</h2>
                {proofSubmitted ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                      <Check className="w-6 h-6 text-green-500" />
                    </div>
                    <p className={`text-sm font-medium ${strongText} mb-1`}>Payment proof submitted</p>
                    <p className={`text-xs ${mutedText}`}>Your payment proof is being reviewed by the host.</p>
                  </div>
                ) : (
                  <>
                    {/* Payment upload - available to anyone (not in host preview mode) */}
                    {(() => {
                      // Host preview: in preview mode AND no actual session ID (means it's a draft/new session being previewed)
                      const isHostPreview = isPreviewMode && !actualSessionId
                      
                      return (
                        <>
                          {/* Show selected participants as pills */}
                          {payingForParticipantNames.length > 0 && (
                            <div className="mb-4">
                              <p className={`text-xs ${mutedText} mb-2`}>Paying for:</p>
                              <div className="flex flex-wrap gap-2">
                                {payingForParticipantNames.map((name, index) => (
                                  <div
                                    key={index}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                                      uiMode === "dark"
                                        ? "bg-lime-500/20 text-lime-300 border border-lime-500/30"
                                        : "bg-lime-500/20 text-lime-700 border border-lime-500/30"
                                    )}
                                  >
                                    <span>{name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                  
                          {proofImage ? (
                            <div className="space-y-4">
                              <div className="relative">
                                <img src={proofImage || "/placeholder.svg"} alt="Payment proof" className="w-full rounded-lg" />
                                <button
                                  onClick={() => {
                                    setProofImage(null)
                                    setProofImageFile(null)
                                  }}
                                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-2"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {!isHostPreview && (
                                <Button
                                  onClick={handleSubmitPaymentProof}
                                  disabled={isSubmittingProof || !proofImageFile}
                                  className="w-full rounded-full h-11 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isSubmittingProof ? "Submitting..." : "Submit payment proof"}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <label className={`border-2 border-dashed rounded-lg p-8 text-center hover:border-[var(--theme-accent)]/50 transition-colors cursor-pointer block ${
                              uiMode === "dark" ? "border-white/20" : "border-black/30"
                            } ${isHostPreview ? "opacity-50 cursor-not-allowed" : ""}`}>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleProofImageUpload} 
                                className="hidden"
                                disabled={isHostPreview}
                              />
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
                        </>
                      )
                    })()}
                  </>
                )}
              </Card>
            </motion.div>
          )}

          {/* Pull Out Button - Only show when user is joined and not in edit mode */}
          {(!isEditMode || isPreviewMode) && actualSessionId && rsvpState === "joined" && participantId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <Card className={`${glassCard} p-6`}>
                <PullOutButton
                  participantId={participantId}
                  sessionId={actualSessionId}
                  onSuccess={() => {
                    // Refresh the page to update RSVP state
                    if (typeof window !== "undefined") {
                      window.location.reload()
                    }
                  }}
                  uiMode={uiMode}
                />
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
                uiMode === "dark" ? "text-white" : "text-black/60"
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
              </p>
            </div>

            {/* Google Maps Link Input */}
            <div>
              <label className={cn(
                "text-sm mb-2 block",
                uiMode === "dark" ? "text-white" : "text-black/60"
              )}>
                Google Maps link (optional)
              </label>
              <Input
                type="text"
                value={mapUrlDraft}
                onChange={(e) => {
                  const value = e.target.value
                  setMapUrlDraft(value)
                  // Validate and show warning if it's a share.google link
                  if (value && value.includes("share.google")) {
                    toast({
                      title: "Invalid link format",
                      description: "Please use a Google Maps link (maps.google.com or maps.app.goo.gl), not a share.google link.",
                      variant: "default",
                    })
                  }
                }}
                placeholder='<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>'
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
                <strong>How to get embed code:</strong>
                <br />
                1. Visit{" "}
                <a
                  href="https://www.atlist.com/embed-code-generator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "underline hover:opacity-80 transition-opacity",
                    uiMode === "dark" ? "text-lime-400" : "text-lime-600"
                  )}
                >
                  atlist.com/embed-code-generator
                </a>{" "}
                and search for your location
                <br />
                2. From the Embed Code section press on "Copy to Clipboard"
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

      {/* Courts Booked Modal */}
      <Dialog open={isCourtModalOpen} onOpenChange={setIsCourtModalOpen}>
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
              Set courts booked
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {/* Court Numbers Input */}
            <div>
              <label className={cn(
                "text-sm mb-2 block",
                uiMode === "dark" ? "text-white/70" : "text-black/60"
              )}>
                Court numbers (optional)
              </label>
              <Input
                value={courtDraft}
                onChange={(e) => setCourtDraft(e.target.value)}
                placeholder="e.g. G9, or 7, 8 for multiple courts"
                className={cn(
                  "h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-lime-500/40",
                  uiMode === "dark"
                    ? "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    : "bg-black/5 border-black/10 text-black placeholder:text-black/40"
                )}
              />
            </div>

            {/* Helper Text */}
            <p className={cn(
              "text-xs",
              uiMode === "dark" ? "text-white/60" : "text-black/60"
            )}>
              Enter court numbers that have been booked for this session. Leave empty if not applicable.
            </p>
          </div>

          {/* Action Buttons */}
          <div className={cn(
            "mt-6 pt-4 flex gap-3",
            uiMode === "dark" ? "border-t border-white/10" : "border-t border-black/10"
          )}>
            <Button
              variant="outline"
              onClick={() => setIsCourtModalOpen(false)}
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
              onClick={handleCourtSave}
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
          if (!open) {
            // Only handle navigation when opened from publish (not from share button)
            if (!isShareFromButton && publishedCode) {
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
            // Reset share from button state
            setIsShareFromButton(false)
          }
        }}
        publishedUrl={publishedUrl}
        hostSlug={publishedHostSlug}
        publicCode={publishedCode}
        sessionId={actualSessionId}
        uiMode={uiMode}
        hostName={publishedHostName}
        title={isShareFromButton ? "Share invite link" : undefined}
        description={isShareFromButton ? "Share your invite link with participants." : undefined}
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
            {/* If session has started, always show "Make Payment" slider regardless of RSVP state */}
            {hasStarted ? (
              /* Session Started state - show payment slider */
              <div className={`${glassCard} rounded-2xl p-4 shadow-2xl flex gap-3`}>
                <div className="flex justify-center items-center gap-2 w-full">
                  {/* Swipe to Make Payment Slider */}
                  <SwipeToJoinSlider
                    onJoin={() => {
                      // Block join if session has started
                      return
                    }}
                    onPayment={onMakePaymentClick ? () => {
                      if (isPreviewMode) return
                      onMakePaymentClick()
                      // Scroll to payment section after a short delay
                      setTimeout(() => {
                        const paymentSection = document.querySelector('[data-payment-section]')
                        if (paymentSection) {
                          paymentSection.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                      }, 300)
                    } : undefined}
                    disabled={false}
                    uiMode={uiMode}
                    isPreviewMode={isPreviewMode}
                    label="Make Payment"
                    isJoined={false}
                  />
                  {actualSessionId && !demoMode && (
                    <Button
                      onClick={handleShareInviteLink}
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-12 w-12 rounded-full",
                        uiMode === "dark"
                          ? "text-white hover:bg-white/10"
                          : "text-black hover:bg-black/10"
                      )}
                      aria-label="Share invite link"
                    >
                      <Share2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : rsvpState === "joined" ? (
              /* Joined state: Green glass premium UI */
              <div className={cn(
                "rounded-2xl p-4 shadow-2xl relative",
                "border border-emerald-400/15",
                "bg-emerald-500/20 backdrop-blur-xl",
                "shadow-[0_0_0_1px_rgba(16,185,129,0.12)] shadow-emerald-500/10",
                isPreviewMode && "pointer-events-none"
              )}>
                {/* Share icon - top-right corner */}
                {actualSessionId && !demoMode && (
                  <Button
                    onClick={(e) => {
                      if (isPreviewMode) {
                        e.preventDefault()
                        return
                      }
                      handleShareInviteLink()
                    }}
                    variant="ghost"
                    size="icon"
                    disabled={isPreviewMode}
                    className={cn(
                      "absolute top-3 right-3 h-11 w-11 rounded-full",
                      uiMode === "dark"
                        ? "text-white hover:bg-white/10"
                        : "text-black hover:bg-black/10",
                      isPreviewMode && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label="Share invite link"
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
                )}

                {/* Title and subtitle - centered content */}
                <div className="flex flex-col gap-2 pr-12">
                  {/* Title with celebration animation */}
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-white">
                      🎉 You're in{participantName ? `, ${participantName}` : ""}!
                    </p>
                    {/* Celebration sparkles animation */}
                    <AnimatePresence>
                      {shouldCelebrate && !isPreviewMode && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="flex items-center"
                        >
                          <motion.div
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [1, 0.8, 1],
                            }}
                            transition={{
                              duration: 0.4,
                              repeat: 1,
                              ease: "easeInOut",
                            }}
                          >
                            <Sparkles className="w-4 h-4 text-emerald-300" />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Subtitle - below title with clear spacing */}
                  <p className="text-xs text-white/60 leading-relaxed">
                    You can change your response anytime.
                  </p>
                </div>
              </div>
            ) : rsvpState === "waitlisted" ? (
              /* Waitlisted state */
              <div className={cn(
                "rounded-2xl p-4 shadow-2xl flex flex-col gap-3",
                "border border-amber-400/15",
                "bg-amber-500/10 backdrop-blur-xl",
                "shadow-[0_0_0_1px_rgba(245,158,11,0.12)] shadow-amber-500/10",
                isPreviewMode && "pointer-events-none"
              )}>
                {/* Title and share button - top row */}
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-base font-semibold ${uiMode === "dark" ? "text-white" : "text-black"}`}>
                    You're on the waitlist ✅
                  </p>
                  {actualSessionId && !demoMode && (
                    <Button
                      onClick={(e) => {
                        if (isPreviewMode) {
                          e.preventDefault()
                          return
                        }
                        handleShareInviteLink()
                      }}
                      variant="ghost"
                      size="icon"
                      disabled={isPreviewMode}
                      className={cn(
                        "h-8 w-8 rounded-full shrink-0",
                        uiMode === "dark"
                          ? "text-white hover:bg-white/10"
                          : "text-black hover:bg-black/10",
                        isPreviewMode && "opacity-50 cursor-not-allowed"
                      )}
                      aria-label="Share invite link"
                    >
                      <Share2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                {/* Subtitle */}
                <p className={`text-xs ${uiMode === "dark" ? "text-white/70" : "text-black/70"}`}>
                  We'll let you know if a spot opens.
                    </p>
                  </div>
            ) : (
              /* Default state - show swipe slider (rsvpState is "none") */
              <div className={`${glassCard} rounded-2xl p-4 shadow-2xl flex gap-3`}>
                <div className="flex justify-center items-center gap-2 w-full">
                  {/* Swipe to Join Slider */}
                  <SwipeToJoinSlider
                    onJoin={() => {
                      // Block join if session has started
                      if (hasStarted) {
                        return
                      }
                      // Call the original join handler
                      if (onJoinClick) {
                        onJoinClick()
                      }
                    }}
                    disabled={isPreviewMode || hasStarted}
                    uiMode={uiMode}
                    isPreviewMode={isPreviewMode}
                    label={hasStarted ? "Session Started" : isFull ? "Join waitlist" : "Join session"}
                    isJoined={String(rsvpState) === "joined"}
                  />
                      {actualSessionId && !demoMode && (
                        <Button
                          onClick={handleShareInviteLink}
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-12 w-12 rounded-full",
                            uiMode === "dark"
                              ? "text-white hover:bg-white/10"
                              : "text-black hover:bg-black/10"
                          )}
                          aria-label="Share invite link"
                        >
                          <Share2 className="h-5 w-5" />
                        </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
