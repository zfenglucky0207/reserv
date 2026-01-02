"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Upload, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadAvatar, removeAvatar } from "@/app/host/settings/actions"
import { useRouter } from "next/navigation"

interface ProfileAvatarUploaderProps {
  currentAvatarUrl: string | null
  googleAvatarUrl: string | null
  displayName: string | null
  uiMode: "dark" | "light"
}

/**
 * Helper to get initials from display name
 */
function getInitials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name[0].toUpperCase()
}

/**
 * Get the avatar URL to display (priority: uploaded > Google > null)
 */
function getDisplayAvatarUrl(avatarUrl: string | null, googleAvatarUrl: string | null): string | null {
  return avatarUrl || googleAvatarUrl || null
}

export function ProfileAvatarUploader({
  currentAvatarUrl,
  googleAvatarUrl,
  displayName,
  uiMode,
}: ProfileAvatarUploaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const displayAvatarUrl = previewUrl || getDisplayAvatarUrl(currentAvatarUrl, googleAvatarUrl)
  const initials = getInitials(displayName)

  const glassCard = uiMode === "dark"
    ? "bg-black/30 border-white/20 text-white backdrop-blur-sm"
    : "bg-white/70 border-black/10 text-black backdrop-blur-sm"

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      })
      return
    }

    // Validate file size (3MB max)
    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 3MB",
        variant: "destructive",
      })
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Compress and upload
    await handleUpload(file)
  }

  const handleUpload = async (file: File) => {
    try {
      setUploading(true)

      // Compress image if needed (using canvas)
      const compressedFile = await compressImage(file)

      // Convert to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(compressedFile)
      })

      const base64Data = await base64Promise

      // Upload to server
      const result = await uploadAvatar(base64Data, file.name, file.type)

      if (!result.ok) {
        throw new Error(result.error || "Failed to upload avatar")
      }

      toast({
        title: "Profile photo updated",
        description: "Your avatar has been updated successfully",
        variant: "success",
      })

      // Clear preview and refresh
      setPreviewUrl(null)
      router.refresh()
    } catch (error: any) {
      console.error("[ProfileAvatarUploader] Upload error:", error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload avatar. Please try again.",
        variant: "destructive",
      })
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemove = async () => {
    try {
      setRemoving(true)

      const result = await removeAvatar()

      if (!result.ok) {
        throw new Error(result.error || "Failed to remove avatar")
      }

      toast({
        title: "Avatar removed",
        description: "Your profile photo has been removed",
        variant: "default",
      })

      router.refresh()
    } catch (error: any) {
      console.error("[ProfileAvatarUploader] Remove error:", error)
      toast({
        title: "Failed to remove",
        description: error.message || "Failed to remove avatar. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Avatar display */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {displayAvatarUrl ? (
            <img
              src={displayAvatarUrl}
              alt={displayName || "Profile"}
              className="h-16 w-16 rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[var(--theme-accent-light)] to-[var(--theme-accent-dark)] flex items-center justify-center border-2 border-white/20">
              <span className="text-xl font-semibold text-black">{initials}</span>
            </div>
          )}
          {(uploading || removing) && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className={cn("text-sm font-medium", uiMode === "dark" ? "text-white" : "text-black")}>
            Profile photo
          </p>
          <p className={cn("text-xs", uiMode === "dark" ? "text-white/60" : "text-black/60")}>
            {currentAvatarUrl
              ? "Uploaded photo"
              : googleAvatarUrl
              ? "Using Google profile photo"
              : "No photo set"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || removing}
          className={cn(
            "h-11 flex-1 rounded-full",
            uiMode === "dark"
              ? "border-white/20 bg-white/5 hover:bg-white/10 text-white"
              : "border-black/20 bg-black/5 hover:bg-black/10 text-black",
            "border"
          )}
          variant="outline"
        >
          <Upload className="w-4 h-4 mr-2" />
          {currentAvatarUrl ? "Change photo" : "Upload photo"}
        </Button>
        {currentAvatarUrl && (
          <Button
            type="button"
            onClick={handleRemove}
            disabled={uploading || removing}
            className={cn(
              "h-11 px-4 rounded-full",
              uiMode === "dark"
                ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/15 text-red-200"
                : "border-red-300 bg-red-50 hover:bg-red-100 text-red-700",
              "border"
            )}
            variant="outline"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

/**
 * Compress image to reduce file size (max 1024x1024, quality 0.85)
 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        // Calculate dimensions (max 1024px on longest side)
        const maxSize = 1024
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"))
              return
            }
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          file.type,
          0.85 // quality
        )
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}


