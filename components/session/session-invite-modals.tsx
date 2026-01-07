"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Upload, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { MobileCalendar } from "@/components/ui/mobile-calendar"
import { TimePickerWheels } from "@/components/ui/time-picker-wheels"
import { DEFAULT_COVER_BG, SPORT_COVER_MAP } from "@/constants/session-invite-constants"
import { getCoverOptions } from "@/utils/session-invite-helpers"

interface SessionInviteModalsProps {
  // Modal state
  isDateModalOpen: boolean
  onDateModalOpenChange: (open: boolean) => void
  isLocationModalOpen: boolean
  onLocationModalOpenChange: (open: boolean) => void
  isCourtModalOpen: boolean
  onCourtModalOpenChange: (open: boolean) => void
  isCoverPickerOpen: boolean
  onCoverPickerOpenChange: (open: boolean) => void
  
  // Date modal state
  selectedDateDraft: Date | null
  selectedTimeDraft: { hour: number; minute: number; ampm: "AM" | "PM" }
  selectedDurationDraft: number
  onDateDraftChange: (date: Date | null) => void
  onTimeDraftChange: (time: { hour: number; minute: number; ampm: "AM" | "PM" }) => void
  onDurationDraftChange: (duration: number) => void
  onDateSave: () => void
  
  // Location modal state
  locationDraft: string
  mapUrlDraft: string
  onLocationDraftChange: (value: string) => void
  onMapUrlDraftChange: (value: string) => void
  onLocationSave: () => void
  
  // Court modal state
  courtDraft: string
  onCourtDraftChange: (value: string) => void
  onCourtSave: () => void
  
  // Cover picker state
  selectedSport: string
  pendingCoverUrl: string | null
  optimisticCoverUrl: string | null
  onPendingCoverUrlChange: (url: string | null) => void
  onCoverConfirm: () => void
  onCoverImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  
  // UI
  uiMode: "dark" | "light"
}

export function SessionInviteModals({
  isDateModalOpen,
  onDateModalOpenChange,
  isLocationModalOpen,
  onLocationModalOpenChange,
  isCourtModalOpen,
  onCourtModalOpenChange,
  isCoverPickerOpen,
  onCoverPickerOpenChange,
  selectedDateDraft,
  selectedTimeDraft,
  selectedDurationDraft,
  onDateDraftChange,
  onTimeDraftChange,
  onDurationDraftChange,
  onDateSave,
  locationDraft,
  mapUrlDraft,
  onLocationDraftChange,
  onMapUrlDraftChange,
  onLocationSave,
  courtDraft,
  onCourtDraftChange,
  onCourtSave,
  selectedSport,
  pendingCoverUrl,
  optimisticCoverUrl,
  onPendingCoverUrlChange,
  onCoverConfirm,
  onCoverImageUpload,
  uiMode,
}: SessionInviteModalsProps) {
  return (
    <>
      {/* Date/Time Modal */}
      <Dialog open={isDateModalOpen} onOpenChange={onDateModalOpenChange}>
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
                  onChange={onDateDraftChange}
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
                onHourChange={(hour) => onTimeDraftChange({ ...selectedTimeDraft, hour })}
                onMinuteChange={(minute) => onTimeDraftChange({ ...selectedTimeDraft, minute })}
                onAmpmChange={(ampm) => onTimeDraftChange({ ...selectedTimeDraft, ampm })}
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
                        onClick={() => onDurationDraftChange(duration)}
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
                onClick={() => onDateModalOpenChange(false)}
                className={`flex-1 ${uiMode === "dark" ? "border-white/20 bg-white/5 hover:bg-white/10 text-white" : "border-black/20 bg-black/5 hover:bg-black/10 text-black"}`}
              >
                Cancel
              </Button>
              <Button
                onClick={onDateSave}
                disabled={!selectedDateDraft}
                className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Modal */}
      <Dialog open={isLocationModalOpen} onOpenChange={onLocationModalOpenChange}>
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
                onChange={(e) => onLocationDraftChange(e.target.value)}
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
                onChange={(e) => onMapUrlDraftChange(e.target.value)}
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
              onClick={() => onLocationModalOpenChange(false)}
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
              onClick={onLocationSave}
              className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Courts Booked Modal */}
      <Dialog open={isCourtModalOpen} onOpenChange={onCourtModalOpenChange}>
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
                onChange={(e) => onCourtDraftChange(e.target.value)}
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
              onClick={() => onCourtModalOpenChange(false)}
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
              onClick={onCourtSave}
              className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cover Picker Modal */}
      <Dialog open={isCoverPickerOpen} onOpenChange={onCoverPickerOpenChange}>
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
                  onChange={onCoverImageUpload}
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
                onClick={() => onPendingCoverUrlChange(null)}
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
              {getCoverOptions(selectedSport).map((option) => (
                <motion.button
                  key={option.id}
                  onClick={() => onPendingCoverUrlChange(option.path)}
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
              onClick={onCoverConfirm}
              disabled={pendingCoverUrl === optimisticCoverUrl}
              className="w-full rounded-full h-12 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium shadow-lg shadow-lime-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

