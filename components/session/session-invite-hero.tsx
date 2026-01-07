"use client"

import * as React from "react"
import { motion, LayoutGroup } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  MapPin,
  DollarSign,
  Users,
  Grid3x3,
  Upload,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DEFAULT_COVER_BG, HERO_TITLE_SHADOW, HERO_META_SHADOW, HERO_ICON_SHADOW, TITLE_FONTS } from "@/constants/session-invite-constants"
import { formatCourtDisplay } from "@/utils/session-invite-helpers"

interface SessionInviteHeroProps {
  // State
  isEditMode: boolean
  isPreviewMode: boolean
  scrolled: boolean
  optimisticCoverUrl: string | null
  selectedSport: string
  effects: { grain: boolean; glow: boolean; vignette: boolean }
  containerOverlayEnabled: boolean
  uiMode: "dark" | "light"
  eventTitle: string
  titleFont: keyof typeof TITLE_FONTS
  eventDate: string
  eventLocation: string
  eventCourt: string
  eventPrice: number | null
  eventCapacity: number | null
  hostNameInput: string
  displayHostName: string
  fieldErrors: Record<"title" | "date" | "location" | "price" | "capacity" | "host", boolean>
  isHostNameSaving: boolean
  hasStarted: boolean
  isFull: boolean
  demoMode: boolean
  
  // Refs
  titleRef: React.RefObject<HTMLDivElement>
  dateRef: React.RefObject<HTMLDivElement>
  locationRef: React.RefObject<HTMLDivElement>
  priceRef: React.RefObject<HTMLDivElement>
  capacityRef: React.RefObject<HTMLDivElement>
  hostRef: React.RefObject<HTMLDivElement>
  
  // Handlers
  onSportChange: (sport: string) => void
  onCoverPickerOpen: () => void
  onTitleChange: (value: string) => void
  onTitleFontChange: (font: keyof typeof TITLE_FONTS) => void
  onDateModalOpen: () => void
  onLocationModalOpen: () => void
  onCourtModalOpen: () => void
  onPriceChange: (value: number) => void
  onPriceBlur?: () => void
  onPriceFocus?: () => void
  onCapacityChange: (value: number) => void
  onCapacityBlur?: () => void
  onCapacityFocus?: () => void
  onHostNameInputChange: (value: string) => void
  onHostNameFocus: () => void
  onHostNameSave: () => void
  onHostNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onContainerOverlayToggle: (enabled: boolean) => void
  onMakePaymentClick?: () => void
  
  // Style helpers
  glassCard: string
  glassPill: string
  mutedText: string
  strongText: string
  inputBg: string
  inputBorder: string
  inputPlaceholder: string
  errorRing: string
  
  // User profile
  getUserProfileName: () => string | null
  
  // Session info
  sessionId?: string
  router: any
}

export function SessionInviteHero({
  isEditMode,
  isPreviewMode,
  scrolled,
  optimisticCoverUrl,
  selectedSport,
  effects,
  containerOverlayEnabled,
  uiMode,
  eventTitle,
  titleFont,
  eventDate,
  eventLocation,
  eventCourt,
  eventPrice,
  eventCapacity,
  hostNameInput,
  displayHostName,
  fieldErrors,
  isHostNameSaving,
  hasStarted,
  isFull,
  demoMode,
  titleRef,
  dateRef,
  locationRef,
  priceRef,
  capacityRef,
  hostRef,
  onSportChange,
  onCoverPickerOpen,
  onTitleChange,
  onTitleFontChange,
  onDateModalOpen,
  onLocationModalOpen,
  onCourtModalOpen,
  onPriceChange,
  onPriceBlur,
  onPriceFocus,
  onCapacityChange,
  onCapacityBlur,
  onCapacityFocus,
  onHostNameInputChange,
  onHostNameFocus,
  onHostNameSave,
  onHostNameKeyDown,
  onContainerOverlayToggle,
  onMakePaymentClick,
  glassCard,
  glassPill,
  mutedText,
  strongText,
  inputBg,
  inputBorder,
  inputPlaceholder,
  errorRing,
  getUserProfileName,
  sessionId,
  router,
}: SessionInviteHeroProps) {
  return (
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
                      onContainerOverlayToggle(newValue)
                      
                      // Save preference to database if session exists
                      if (sessionId && sessionId !== "new" && sessionId !== "edit") {
                        try {
                          const { updateSessionContainerOverlay } = await import("@/app/host/sessions/[id]/actions")
                          await updateSessionContainerOverlay(sessionId, newValue)
                          router.refresh() // Refresh to sync with server state
                        } catch (error) {
                          console.error("[ContainerOverlayToggle] Error saving preference:", error)
                          // Revert on error
                          onContainerOverlayToggle(!newValue)
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
                          onClick={() => onSportChange("Badminton")}
                          className="text-white focus:bg-[var(--theme-accent)]/20 focus:text-[var(--theme-accent-light)]"
                        >
                          Badminton
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onSportChange("Pickleball")}
                          className="text-white focus:bg-[var(--theme-accent)]/20 focus:text-[var(--theme-accent-light)]"
                        >
                          Pickleball
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onSportChange("Volleyball")}
                          className="text-white focus:bg-[var(--theme-accent)]/20 focus:text-[var(--theme-accent-light)]"
                        >
                          Volleyball
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onSportChange("Futsal")}
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
                      onClick={onCoverPickerOpen}
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
                            onChange={(e) => onTitleChange(e.target.value)}
                            onFocus={() => {
                              // Field error clearing handled by parent
                            }}
                            className={`bg-transparent border-none text-4xl font-bold ${uiMode === "dark" ? "text-white" : "text-black"} w-full focus:outline-none focus:ring-0 p-0 text-center ${TITLE_FONTS[titleFont]} ${inputPlaceholder}`}
                            placeholder="Enter title here"
                          />
                        </div>
                        {/* Font picker */}
                        <div className="flex items-center justify-center gap-2">
                          {(Object.keys(TITLE_FONTS) as Array<keyof typeof TITLE_FONTS>).map((font) => (
                            <button
                              key={font}
                              onClick={() => onTitleFontChange(font)}
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
                              onClick={onDateModalOpen}
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
                              onClick={onLocationModalOpen}
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
                            onClick={onCourtModalOpen}
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
                                  onChange={(e) => onPriceChange(Number(e.target.value) || 0)}
                                  onBlur={onPriceBlur}
                                  onFocus={onPriceFocus}
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
                                  onChange={(e) => onCapacityChange(Number(e.target.value) || 0)}
                                  onBlur={onCapacityBlur}
                                  onFocus={onCapacityFocus}
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
                              onHostNameInputChange(value)
                            }
                          }}
                          onFocus={() => {
                            onHostNameFocus()
                            // Field error clearing handled by parent
                          }}
                          onBlur={onHostNameSave}
                          onKeyDown={onHostNameKeyDown}
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
      </div>
    </LayoutGroup>
  )
}

