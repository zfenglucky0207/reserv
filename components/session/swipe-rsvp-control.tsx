"use client"

import { useState, useRef, useEffect } from "react"
import { motion, useMotionValue, useSpring, useTransform, useMotionValueEvent } from "framer-motion"
import { Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type SwipeRSVPState = "none" | "joined" | "declined" | "waitlisted"

interface SwipeRSVPControlProps {
  state: SwipeRSVPState
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  disabled?: boolean
  uiMode: "dark" | "light"
  isPreviewMode?: boolean
}

const THUMB_SIZE = 44
const TRACK_HEIGHT = 56
const THRESHOLD_PERCENT = 0.35 // 35% from center

export function SwipeRSVPControl({
  state,
  onAccept,
  onDecline,
  disabled = false,
  uiMode,
  isPreviewMode = false,
}: SwipeRSVPControlProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [committedAction, setCommittedAction] = useState<"accept" | "decline" | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const isDraggingRef = useRef(false)
  const startOffsetRef = useRef(0)
  const startXRef = useRef(0)
  
  const x = useMotionValue(0)
  const springX = useSpring(x, { damping: 30, stiffness: 400 })

  // Calculate allowed directions based on state
  const canAccept = state === "none" || state === "declined"
  const canDecline = state === "none" || state === "joined" || state === "waitlisted"

  // Track drag offset from motion value for fill overlays
  useMotionValueEvent(springX, "change", (latest) => {
    if (!trackRef.current) {
      setDragOffset(0)
      return
    }
    const trackWidth = trackRef.current.offsetWidth - THUMB_SIZE
    const maxOffset = trackWidth / 2
    const percentage = maxOffset > 0 ? (latest / maxOffset) * 100 : 0
    setDragOffset(percentage)
  })

  // Calculate intensities for fill overlays
  const leftIntensity = dragOffset < 0 ? Math.min(Math.abs(dragOffset) / 100, 1) : 0
  const rightIntensity = dragOffset > 0 ? Math.min(dragOffset / 100, 1) : 0

  // Label opacities
  const acceptLabelOpacity = canAccept ? (0.35 + leftIntensity * 0.65) : 0.15
  const declineLabelOpacity = canDecline ? (0.35 + rightIntensity * 0.65) : 0.15

  // Handle pointer down on knob OR track
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isPending) {
      return
    }

    console.log("[SwipeRSVPControl] Pointer DOWN", { type: e.pointerType, button: e.button })

    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(true)
    isDraggingRef.current = true
    
    const target = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    
    const trackRect = trackRef.current?.getBoundingClientRect()
    if (!trackRect) {
      setIsDragging(false)
      isDraggingRef.current = false
      return
    }

    // Capture pointer - critical for iOS Safari
    try {
      if (target.setPointerCapture && pointerId !== undefined) {
        target.setPointerCapture(pointerId)
      }
    } catch (err) {
      console.warn("[SwipeRSVPControl] Failed to capture pointer:", err)
    }

    const startX = e.clientX
    const startOffset = x.get()

    const handleMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) {
        console.log("[SwipeRSVPControl] Move ignored - not dragging")
        return
      }
      if (moveEvent.pointerId !== pointerId) return
      
      moveEvent.preventDefault()
      moveEvent.stopPropagation()
      
      const deltaX = moveEvent.clientX - startX
      const trackWidth = trackRect.width - THUMB_SIZE
      const centerOffset = trackWidth / 2
      const newOffset = startOffset + deltaX
      
      // Clamp to track bounds
      const clampedOffset = Math.max(-centerOffset, Math.min(centerOffset, newOffset))
      x.set(clampedOffset)
    }

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      
      upEvent.preventDefault()
      upEvent.stopPropagation()
      
      try {
        if (target.releasePointerCapture && pointerId !== undefined) {
          target.releasePointerCapture(pointerId)
        }
      } catch (err) {
        // Ignore release errors
      }

      const trackWidth = trackRect.width - THUMB_SIZE
      const centerOffset = trackWidth / 2
      const threshold = centerOffset * THRESHOLD_PERCENT
      const currentX = x.get()

      // Determine if threshold was crossed (but don't commit in preview mode)
      if (!isPreviewMode) {
        if (currentX < -threshold && canAccept) {
          commitAction("accept")
        } else if (currentX > threshold && canDecline) {
          commitAction("decline")
        } else {
          // Snap back to center
          x.set(0)
        }
      } else {
        // In preview mode, just snap back to center without committing
        x.set(0)
      }

      setIsDragging(false)
      isDraggingRef.current = false
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleUp)
    }

    // Use window events (more reliable on iOS Safari)
    window.addEventListener("pointermove", handleMove, { passive: false })
    window.addEventListener("pointerup", handleUp, { passive: false })
    window.addEventListener("pointercancel", handleUp, { passive: false })
  }

  const commitAction = async (action: "accept" | "decline") => {
    if (isPending) return

    setIsPending(true)
    setCommittedAction(action)

    // Animate thumb to edge
    if (trackRef.current) {
      const trackWidth = trackRef.current.offsetWidth - THUMB_SIZE
      const centerOffset = trackWidth / 2
      const targetX = action === "accept" ? -centerOffset : centerOffset
      x.set(targetX)
    }

    try {
      if (action === "accept") {
        await onAccept()
      } else {
        await onDecline()
      }
    } catch (error) {
      console.error("[SwipeRSVPControl] Action failed:", error)
    } finally {
      setIsPending(false)
      setCommittedAction(null)
      // Reset to center after a brief delay
      setTimeout(() => {
        x.set(0)
      }, 500)
    }
  }

  // Reset position on state change
  useEffect(() => {
    if (!isDragging && !isPending) {
      x.set(0)
    }
  }, [state, isDragging, isPending, x])

  // Get status text based on state
  const getStatusText = () => {
    if (disabled) {
      return "Session closed"
    }
    switch (state) {
      case "joined":
        return "You're in ✅"
      case "declined":
        return "You're marked as not going"
      case "waitlisted":
        return "You're on the waitlist"
      default:
        return null
    }
  }

  // Get hint text
  const getHintText = () => {
    if (disabled) return ""
    
    switch (state) {
      case "joined":
        return "Slide right to decline"
      case "declined":
        return "Slide left to accept"
      case "waitlisted":
        return "Slide right to decline"
      default:
        return ""
    }
  }

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 backdrop-blur-sm"
    : "bg-white/70 border-black/10 backdrop-blur-sm"

  return (
    <div className="space-y-2">
      {/* Status text (if joined/declined/waitlisted) */}
      {getStatusText() && (
        <div className="text-center">
          <p className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
            {getStatusText()}
          </p>
          {getHintText() && (
            <p className={cn("text-xs mt-0.5", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              {getHintText()}
            </p>
          )}
        </div>
      )}

      {/* Swipe track */}
      <div
        ref={trackRef}
        className={cn(
          "relative rounded-full h-14 overflow-hidden touch-none select-none",
          glassCard,
          "border",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-grab active:cursor-grabbing"
        )}
        style={{
          WebkitUserSelect: "none",
          userSelect: "none",
          touchAction: "none",
          WebkitTouchCallout: "none",
        }}
        onPointerDown={handlePointerDown}
        role="slider"
        aria-label={getHintText() || "Swipe to accept or decline"}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled || isPending || isPreviewMode) return
          
          if (e.key === "ArrowLeft" && canAccept) {
            commitAction("accept")
          } else if (e.key === "ArrowRight" && canDecline) {
            commitAction("decline")
          }
        }}
      >
        {/* Left fill overlay (green) - grows from center to left */}
        {canAccept && leftIntensity > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/30 pointer-events-none rounded-l-full"
            style={{
              width: `${leftIntensity * 50}%`,
              left: `${50 - leftIntensity * 50}%`,
            }}
          />
        )}

        {/* Right fill overlay (red) - grows from center to right */}
        {canDecline && rightIntensity > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-red-500/30 pointer-events-none rounded-r-full"
            style={{
              width: `${rightIntensity * 50}%`,
              left: "50%",
            }}
          />
        )}

        {/* Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none z-0">
          <span
            className={cn(
              "text-sm font-medium transition-opacity duration-100",
              uiMode === "dark" ? "text-white" : "text-black"
            )}
            style={{ opacity: acceptLabelOpacity }}
          >
            Accept
          </span>
          <span
            className={cn(
              "text-sm font-medium transition-opacity duration-100",
              uiMode === "dark" ? "text-white" : "text-black"
            )}
            style={{ opacity: declineLabelOpacity }}
          >
            Decline
          </span>
        </div>

        {/* Thumb/Knob - draggable with larger hit area */}
        <motion.div
          ref={knobRef}
          className={cn(
            "absolute top-0 bottom-0 rounded-full flex items-center justify-center z-30 pointer-events-auto",
            "touch-none select-none cursor-grab active:cursor-grabbing"
          )}
          style={{
            width: 56, // Larger hit area (56px = track height)
            height: 56,
            x: springX,
            left: "50%",
            marginLeft: -28, // Center the larger hit area
            WebkitUserSelect: "none",
            userSelect: "none",
            touchAction: "none",
            WebkitTouchCallout: "none",
          }}
          onPointerDown={handlePointerDown}
        >
          {/* Visual knob (smaller than hit area) */}
          <motion.div
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center",
              "bg-white/90 backdrop-blur-sm border border-white/30 shadow-lg",
              uiMode === "light" && "bg-black/5 border-black/20"
            )}
            animate={{
              scale: isDragging ? 1.1 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
          >
            {isPending ? (
              <Loader2 className={cn("w-5 h-5 animate-spin", uiMode === "dark" ? "text-gray-600" : "text-gray-400")} />
            ) : (
              <>
                {committedAction === "accept" ? (
                  <Check className={cn("w-5 h-5", uiMode === "dark" ? "text-emerald-600" : "text-emerald-500")} />
                ) : committedAction === "decline" ? (
                  <X className={cn("w-5 h-5", uiMode === "dark" ? "text-red-600" : "text-red-500")} />
                ) : (
                  <div className={cn("w-2 h-2 rounded-full", uiMode === "dark" ? "bg-white/40" : "bg-black/30")} />
                )}
              </>
            )}
          </motion.div>
        </motion.div>

        {/* Hidden buttons for screen readers */}
        <div className="sr-only">
          {canAccept && (
            <button onClick={() => commitAction("accept")} disabled={disabled || isPending}>
              Accept session
            </button>
          )}
          {canDecline && (
            <button onClick={() => commitAction("decline")} disabled={disabled || isPending}>
              Decline session
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
