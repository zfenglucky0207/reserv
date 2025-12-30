"use client"

import { useState, useEffect as ReactUseEffect } from "react"
import * as React from "react"
import { motion } from "framer-motion"
import { Palette, Eye, Sun, Moon, FileText, Edit, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface EditorBottomBarProps {
  onPreview: () => void
  onPublish?: () => void
  onEdit?: () => void // New prop for Edit action when published
  onUnpublish?: () => void // New prop for Unpublish action
  onSaveDraft?: () => void
  onDrafts?: () => void
  theme?: string
  onThemeChange?: (theme: string) => void
  uiMode: "dark" | "light"
  onUiModeChange: (mode: "dark" | "light") => void
  isPublished?: boolean // New prop to indicate if session is published
  saveDraftLabel?: string // Label for save draft button (e.g., "Update draft" or "Save draft")
}

export function EditorBottomBar({
  onPreview,
  onPublish,
  onEdit,
  onUnpublish,
  onSaveDraft,
  onDrafts,
  theme,
  onThemeChange,
  uiMode,
  onUiModeChange,
  isPublished = false,
  saveDraftLabel = "Save draft",
}: EditorBottomBarProps) {
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false)
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [isUnpublishing, setIsUnpublishing] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState(theme || "badminton")
  const { toast } = useToast()

  // Sync with parent state if provided
  ReactUseEffect(() => {
    if (theme) setSelectedTheme(theme)
  }, [theme])

  const themes = [
    { id: "badminton", name: "Lime Green", color: "bg-lime-500" },
    { id: "pickleball", name: "Sunset Orange", color: "bg-orange-500" },
    { id: "midnight", name: "Midnight Blue", color: "bg-indigo-900" },
    { id: "clean", name: "Clean Light", color: "bg-gray-100" },
  ]

  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId)
    setThemeDrawerOpen(false)
    if (onThemeChange) {
      onThemeChange(themeId)
    }
    toast({
      description: "Theme updated",
      variant: "success",
    })
  }


  const handleSaveDraftClick = () => {
    if (onSaveDraft) {
      onSaveDraft()
    } else {
    toast({
      description: "Draft saved",
        variant: "success",
    })
    }
  }

  const handleUnpublishConfirm = async () => {
    if (!onUnpublish) return
    
    setIsUnpublishing(true)
    try {
      await onUnpublish()
      setUnpublishDialogOpen(false)
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsUnpublishing(false)
    }
  }

  return (
    <>
      {/* Bottom Editor Bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-40 pb-safe"
      >
        <div className="mx-auto max-w-md px-4 pb-4 relative">
          {/* LIVE Indicator Badge */}
          {isPublished && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="absolute -top-2 left-6 z-50"
            >
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/90 backdrop-blur-sm rounded-full border border-red-400/50 shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-white">LIVE</span>
              </div>
            </motion.div>
          )}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
            {/* Icon Buttons Row */}
            <div className="flex items-center justify-around mb-3">
              {/* Unpublish Button (when published) or Theme Button (when not published) */}
              {isPublished && onUnpublish ? (
                <button
                  onClick={() => setUnpublishDialogOpen(true)}
                  disabled={isUnpublishing}
                  className="flex flex-col items-center gap-1.5 group"
                  aria-label="Unpublish invite"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full transition-colors flex items-center justify-center",
                    "bg-red-500/20 hover:bg-red-500/30 border border-red-500/30",
                    "group-hover:shadow-lg group-hover:shadow-red-500/20",
                    isUnpublishing && "opacity-50 cursor-not-allowed"
                  )}>
                    <Ban className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
                  </div>
                  <span className="text-xs text-red-400/80 group-hover:text-red-300 transition-colors">Unpublish</span>
                </button>
              ) : (
                <button onClick={() => setThemeDrawerOpen(true)} className="flex flex-col items-center gap-1.5 group">
                  <div className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                    <Palette className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">Theme</span>
                </button>
              )}

              {/* Light/Dark Mode Toggle */}
              <button
                onClick={() => onUiModeChange(uiMode === "dark" ? "light" : "dark")}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                  {uiMode === "dark" ? (
                    <Sun className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                  ) : (
                    <Moon className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                  )}
                </div>
                <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                  {uiMode === "dark" ? "Light" : "Dark"}
                </span>
              </button>

              {/* Drafts Button */}
              {onDrafts && (
                <button onClick={onDrafts} className="flex flex-col items-center gap-1.5 group">
                  <div className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">Drafts</span>
                </button>
              )}

              {/* Preview Button */}
              <button onClick={onPreview} className="flex flex-col items-center gap-1.5 group">
                <div className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">Preview</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isPublished && onEdit ? (
                <Button
                  onClick={onEdit}
                  className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-white font-medium rounded-full h-12 shadow-lg shadow-lime-500/20"
                  aria-label="Edit session"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <>
                  {onSaveDraft && (
                    <Button
                      onClick={handleSaveDraftClick}
                      variant="outline"
                      className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium rounded-full h-12"
                    >
                      {saveDraftLabel}
                    </Button>
                  )}
                  {onPublish && (
                    <Button
                      onClick={onPublish}
                      className="flex-1 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full h-12 shadow-lg shadow-lime-500/20"
                    >
                      Publish
                    </Button>
                  )}
                  {!onPublish && !onSaveDraft && (
            <Button
                      onClick={handleSaveDraftClick}
              className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium rounded-full h-12 shadow-lg shadow-lime-500/20"
            >
              {saveDraftLabel}
            </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Theme Drawer */}
      <Drawer open={themeDrawerOpen} onOpenChange={setThemeDrawerOpen}>
        <DrawerContent className="bg-black/95 backdrop-blur-xl border-white/10">
          <DrawerHeader>
            <DrawerTitle className="text-white">Choose Theme</DrawerTitle>
            <DrawerDescription className="text-white/60">Select a theme for your event</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-8 space-y-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  selectedTheme === theme.id
                    ? "border-lime-500 bg-lime-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${theme.color}`} />
                <span className="text-white font-medium">{theme.name}</span>
                {selectedTheme === theme.id && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-lime-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-black" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Unpublish Confirmation Dialog */}
      <Dialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <DialogContent
          className={cn(
            "max-w-md rounded-2xl",
            uiMode === "dark"
              ? "bg-slate-900 text-white border border-white/10"
              : "bg-white text-black border border-black/10"
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn("text-xl font-semibold", uiMode === "dark" ? "text-white" : "text-black")}>
              Unpublish this invite?
            </DialogTitle>
            <DialogDescription className={cn(uiMode === "dark" ? "text-white/60" : "text-black/60")}>
              This will take the invite offline. You can publish again anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-4">
            <Button
              onClick={() => setUnpublishDialogOpen(false)}
              variant="outline"
              disabled={isUnpublishing}
              className={cn(
                "flex-1 rounded-full h-12",
                uiMode === "dark"
                  ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
                  : "border-black/20 bg-black/5 hover:bg-black/10 text-black"
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnpublishConfirm}
              disabled={isUnpublishing}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full h-12 shadow-lg shadow-red-500/20"
            >
              {isUnpublishing ? "Unpublishing..." : "Unpublish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
