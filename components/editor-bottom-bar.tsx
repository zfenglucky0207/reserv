"use client"

import { useState, useEffect as ReactUseEffect } from "react"
import * as React from "react"
import { motion } from "framer-motion"
import { Palette, Eye, Sun, Moon, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface EditorBottomBarProps {
  onPreview: () => void
  onPublish?: () => void
  onSaveDraft?: () => void
  onDrafts?: () => void
  theme?: string
  onThemeChange?: (theme: string) => void
  uiMode: "dark" | "light"
  onUiModeChange: (mode: "dark" | "light") => void
}

export function EditorBottomBar({
  onPreview,
  onPublish,
  onSaveDraft,
  onDrafts,
  theme,
  onThemeChange,
  uiMode,
  onUiModeChange,
}: EditorBottomBarProps) {
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false)
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

  return (
    <>
      {/* Bottom Editor Bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-40 pb-safe"
      >
        <div className="mx-auto max-w-md px-4 pb-4">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
            {/* Icon Buttons Row */}
            <div className="flex items-center justify-around mb-3">
              {/* Theme Button */}
              <button onClick={() => setThemeDrawerOpen(true)} className="flex flex-col items-center gap-1.5 group">
                <div className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                  <Palette className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">Theme</span>
              </button>

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
              {onSaveDraft && (
                <Button
                  onClick={handleSaveDraftClick}
                  variant="outline"
                  className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium rounded-full h-12"
                >
                  Save draft
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
              Save draft
            </Button>
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

    </>
  )
}
