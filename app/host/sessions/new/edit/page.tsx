"use client"

import { SessionInvite } from "@/components/session-invite"
import { LiveInviteGuard } from "@/components/host/live-invite-guard"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useState, useEffect } from "react"

function HostSessionNewContent() {
  const searchParams = useSearchParams()
  const isPreviewMode = searchParams.get("mode") === "preview"
  const [uiMode, setUiMode] = useState<"dark" | "light">("dark")

  // Sync uiMode from localStorage or default to dark
  useEffect(() => {
    const savedUiMode = localStorage.getItem("reserv-ui-mode") as "dark" | "light" | null
    if (savedUiMode === "dark" || savedUiMode === "light") {
      setUiMode(savedUiMode)
    }
  }, [])

  return (
    <main className="min-h-screen sporty-bg">
      <LiveInviteGuard uiMode={uiMode} />
      <SessionInvite initialEditMode={true} initialPreviewMode={isPreviewMode} />
    </main>
  )
}

export default function HostSessionNewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HostSessionNewContent />
    </Suspense>
  )
}

