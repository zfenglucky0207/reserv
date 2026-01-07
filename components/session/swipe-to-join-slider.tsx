"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

// Swipe to Join Slider Component (iPhone-style)
const DEBUG_SWIPE = false // Set to true for debugging console logs

export function SwipeToJoinSlider({
  onJoin,
  onPayment,
  disabled = false,
  uiMode,
  isPreviewMode = false,
  label = "Join session",
  isJoined = false,
}: {
  onJoin: () => void
  onPayment?: () => void
  disabled?: boolean
  uiMode: "dark" | "light"
  isPreviewMode?: boolean
  label?: string
  isJoined?: boolean
}) {
  const sliderRef = useRef<HTMLDivElement>(null)

  const HANDLE_W = 56
  const threshold = 0.85

  const [isDragging, setIsDragging] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [maxX, setMaxX] = useState(0)

  const x = useMotionValue(0)

  // Measure width and keep maxX updated
  useLayoutEffect(() => {
    if (!sliderRef.current) {
      DEBUG_SWIPE && console.warn("[SwipeToJoin] sliderRef is null on mount")
      return
    }

    const el = sliderRef.current

    const compute = () => {
      const w = el.offsetWidth || 0
      const computedMaxX = Math.max(0, w - HANDLE_W)

      DEBUG_SWIPE && console.log("[SwipeToJoin] measure", {
        width: w,
        HANDLE_W,
        maxX: computedMaxX,
      })

      setMaxX(computedMaxX)
    }

    compute()

    const ro = new ResizeObserver(() => compute())
    ro.observe(el)

    return () => ro.disconnect()
  }, [])

  const progress = useTransform(x, (latest) => {
    if (maxX <= 0) return 0
    const clamped = Math.min(Math.max(latest, 0), maxX)
    return clamped / maxX
  })

  const progressWidth = useTransform(progress, (p) => `${p * 100}%`)

  // Allow interaction if payment handler exists (even if disabled for join)
  const canInteract = (!disabled || onPayment) && !isPreviewMode && !isCompleted && maxX > 0

  DEBUG_SWIPE && console.log("[SwipeToJoin] interaction check", {
    canInteract,
    disabled,
    isPreviewMode,
    isJoined,
    isCompleted,
    maxX,
  })

  const handleDragEnd = async () => {
    const p = progress.get()

    DEBUG_SWIPE && console.log("[SwipeToJoin] drag end", {
      progress: p,
      threshold,
      canInteract,
    })

    setIsDragging(false)

    if (p >= threshold && canInteract) {
      setIsCompleted(true)

      // Smooth animate to end
      animate(x, maxX, { type: "tween", duration: 0.18, ease: [0.16, 1, 0.3, 1] })

      // Trigger join or payment after tiny delay for "snap" feel
      setTimeout(() => {
        DEBUG_SWIPE && console.log("[SwipeToJoin] ACTION TRIGGERED", { hasPayment: !!onPayment })
        if (onPayment) {
          onPayment()
          // Reset slider after payment action (payment doesn't lock the slider)
          setTimeout(() => {
            setIsCompleted(false)
            animate(x, 0, { type: "tween", duration: 0.22, ease: [0.16, 1, 0.3, 1] })
          }, 500)
        } else {
          onJoin()
        }
      }, 150)

      // DO NOT reset - wait for parent to set isJoined=true, which will lock the slider
      // The slider will stay at maxX until isJoined prop changes (only for join, not payment)
      return
    }

    // Not far enough → return to start
    animate(x, 0, { type: "tween", duration: 0.22, ease: [0.16, 1, 0.3, 1] })
  }

  // Log drag movement
  useEffect(() => {
    const unsub = x.on("change", (latest) => {
      DEBUG_SWIPE &&
        console.log("[SwipeToJoin] dragging", {
          x: latest,
          progress: progress.get(),
        })
    })

    return () => unsub()
  }, [x, progress])

  // Log prop changes
  useEffect(() => {
    DEBUG_SWIPE && console.log("[SwipeToJoin] props changed", {
      disabled,
      isPreviewMode,
      isJoined,
    })
  }, [disabled, isPreviewMode, isJoined])

  // If joined, lock slider at the end position permanently
  useEffect(() => {
    if (isJoined) {
      setIsCompleted(true)
      // Animate to end and lock it there (don't reset)
      animate(x, maxX, { type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] })
    } else if (disabled || isPreviewMode) {
      // Only reset if disabled/preview (not if joined)
      setIsCompleted(false)
      animate(x, 0, { type: "tween", duration: 0.18, ease: [0.16, 1, 0.3, 1] })
    }
  }, [disabled, isJoined, isPreviewMode, x, maxX])

  return (
    <div
      ref={sliderRef}
      className={cn(
        "relative flex-1 h-[56px] rounded-full overflow-hidden",
        uiMode === "dark"
          ? "bg-white/10 border border-white/20"
          : "bg-black/10 border border-black/20"
      )}
      style={{ maxWidth: "calc(100% - 80px)" }}
    >
      {/* progress fill */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full",
          isCompleted ? "bg-gradient-to-r from-lime-500 to-emerald-500" : "bg-transparent"
        )}
        style={{ width: progressWidth }}
      />

      {/* label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span
          className={cn(
            "text-sm font-semibold transition-colors",
            isCompleted
              ? "text-black"
              : (disabled || isPreviewMode || isJoined)
                ? (uiMode === "dark" ? "text-white/60" : "text-black/60")
                : (uiMode === "dark" ? "text-white/90" : "text-black/90")
          )}
        >
          {isCompleted ? "Joined!" : isJoined ? "Joined" : label}
        </span>
      </div>

      {/* hint chevron */}
      {!isDragging && !isCompleted && !isJoined && (
        <motion.div
          className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-0"
          animate={{ opacity: [0.35, 0.75, 0.35], x: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronRight className={cn("w-4 h-4", uiMode === "dark" ? "text-white/60" : "text-black/60")} />
        </motion.div>
      )}

      {/* handle */}
      <motion.div
        drag={canInteract ? "x" : false}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0.08}
        onDragStart={() => {
          DEBUG_SWIPE && console.log("[SwipeToJoin] drag start", {
            canInteract,
            maxX,
          })
          setIsDragging(true)
        }}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-14 rounded-full flex items-center justify-center z-10 shadow-lg",
          "bg-white text-black",
          canInteract ? "cursor-grab active:cursor-grabbing" : "opacity-50 cursor-not-allowed"
        )}
        whileDrag={{ scale: 1.04 }}
        aria-label="Swipe to join session"
      >
        <ChevronRight className="w-5 h-5" />
      </motion.div>
    </div>
  )
}

