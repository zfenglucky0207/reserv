"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Share2, Sparkles, CreditCard } from "lucide-react"
import { SwipeToJoinSlider } from "./swipe-to-join-slider"

interface SessionInviteRSVPDockProps {
  isEditMode: boolean
  isPreviewMode: boolean
  hasStarted: boolean
  rsvpState: "none" | "joined" | "waitlisted"
  uiMode: "dark" | "light"
  glassCard: string
  actualSessionId?: string
  demoMode?: boolean
  participantName?: string | null
  shouldCelebrate: boolean
  isFull: boolean
  publicCode?: string
  eventCapacity: number
  joinedCount: number
  onJoinClick?: () => void
  onMakePaymentClick?: () => void
  onShareInviteLink: () => void
}

export function SessionInviteRSVPDock({
  isEditMode,
  isPreviewMode,
  hasStarted,
  rsvpState,
  uiMode,
  glassCard,
  actualSessionId,
  demoMode = false,
  participantName,
  shouldCelebrate,
  isFull,
  publicCode,
  eventCapacity,
  joinedCount,
  onJoinClick,
  onMakePaymentClick,
  onShareInviteLink,
}: SessionInviteRSVPDockProps) {
  return (
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
                      onClick={onShareInviteLink}
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
                {/* Action buttons - top-right corner */}
                {actualSessionId && !demoMode && (
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    {/* Make Payment button - available anytime */}
                    {onMakePaymentClick && (
                      <Button
                        onClick={(e) => {
                          if (isPreviewMode) {
                            e.preventDefault()
                            return
                          }
                          onMakePaymentClick()
                          // Scroll to payment section after a short delay
                          setTimeout(() => {
                            const paymentSection = document.querySelector('[data-payment-section]')
                            if (paymentSection) {
                              paymentSection.scrollIntoView({ behavior: "smooth", block: "start" })
                            }
                          }, 300)
                        }}
                        variant="ghost"
                        size="icon"
                        disabled={isPreviewMode}
                        className={cn(
                          "h-11 w-11 rounded-full",
                          uiMode === "dark"
                            ? "text-white hover:bg-white/10"
                            : "text-black hover:bg-black/10",
                          isPreviewMode && "opacity-50 cursor-not-allowed"
                        )}
                        aria-label="Make payment"
                        title="Make payment"
                      >
                        <CreditCard className="h-5 w-5" />
                      </Button>
                    )}
                    <Button
                      onClick={(e) => {
                        if (isPreviewMode) {
                          e.preventDefault()
                          return
                        }
                        onShareInviteLink()
                      }}
                      variant="ghost"
                      size="icon"
                      disabled={isPreviewMode}
                      className={cn(
                        "h-11 w-11 rounded-full",
                        uiMode === "dark"
                          ? "text-white hover:bg-white/10"
                          : "text-black hover:bg-black/10",
                        isPreviewMode && "opacity-50 cursor-not-allowed"
                      )}
                      aria-label="Share invite link"
                    >
                      <Share2 className="h-5 w-5" />
                    </Button>
                  </div>
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
                {/* Title and action buttons - top row */}
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-base font-semibold ${uiMode === "dark" ? "text-white" : "text-black"}`}>
                    You're on the waitlist ✅
                  </p>
                  {actualSessionId && !demoMode && (
                    <div className="flex items-center gap-2">
                      {/* Make Payment button - available anytime */}
                      {onMakePaymentClick && (
                        <Button
                          onClick={(e) => {
                            if (isPreviewMode) {
                              e.preventDefault()
                              return
                            }
                            onMakePaymentClick()
                            // Scroll to payment section after a short delay
                            setTimeout(() => {
                              const paymentSection = document.querySelector('[data-payment-section]')
                              if (paymentSection) {
                                paymentSection.scrollIntoView({ behavior: "smooth", block: "start" })
                              }
                            }, 300)
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
                          aria-label="Make payment"
                          title="Make payment"
                        >
                          <CreditCard className="h-5 w-5" />
                        </Button>
                      )}
                      <Button
                        onClick={(e) => {
                          if (isPreviewMode) {
                            e.preventDefault()
                            return
                          }
                          onShareInviteLink()
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
                    </div>
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
                      // Log waitlist intent when session is full
                      if (isFull && publicCode) {
                        console.log("[waitlist] session full → user attempting waitlist join", {
                          publicCode,
                          capacity: eventCapacity,
                          joinedCount,
                        })
                      }
                      // Call the original join handler
                      if (onJoinClick) {
                        onJoinClick()
                      }
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
                    disabled={isPreviewMode || hasStarted}
                    uiMode={uiMode}
                    isPreviewMode={isPreviewMode}
                    label={hasStarted ? "Session Started" : isFull ? "Join waitlist" : "Join session"}
                    isJoined={String(rsvpState) === "joined"}
                  />
                  {actualSessionId && !demoMode && (
                    <>
                      {/* Make Payment button - available anytime */}
                      {onMakePaymentClick && (
                        <Button
                          onClick={() => {
                            if (isPreviewMode) return
                            onMakePaymentClick()
                            // Scroll to payment section after a short delay
                            setTimeout(() => {
                              const paymentSection = document.querySelector('[data-payment-section]')
                              if (paymentSection) {
                                paymentSection.scrollIntoView({ behavior: "smooth", block: "start" })
                              }
                            }, 300)
                          }}
                          variant="ghost"
                          size="icon"
                          disabled={isPreviewMode}
                          className={cn(
                            "h-12 w-12 rounded-full",
                            uiMode === "dark"
                              ? "text-white hover:bg-white/10"
                              : "text-black hover:bg-black/10",
                            isPreviewMode && "opacity-50 cursor-not-allowed"
                          )}
                          aria-label="Make payment"
                          title="Make payment"
                        >
                          <CreditCard className="h-5 w-5" />
                        </Button>
                      )}
                      <Button
                        onClick={onShareInviteLink}
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
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

