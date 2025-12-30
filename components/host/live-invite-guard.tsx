"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { LiveInviteGuardModal } from "./live-invite-guard-modal"
import { getHostLiveSessions } from "@/app/host/sessions/[id]/actions"
import { useAuth } from "@/lib/hooks/use-auth"

interface LiveInviteGuardProps {
  uiMode: "dark" | "light"
}

export function LiveInviteGuard({ uiMode }: LiveInviteGuardProps) {
  const [open, setOpen] = useState(false)
  const [liveSessions, setLiveSessions] = useState<
    Array<{
      id: string
      title: string
      start_at: string
      location: string | null
      capacity: number | null
      cover_url: string | null
      sport: "badminton" | "pickleball" | "volleyball" | "other"
      host_slug: string | null
      public_code: string | null
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)
  const { authUser } = useAuth()

  const checkLiveSessions = useCallback(async () => {
    if (!authUser?.id) {
      setLoading(false)
      return
    }

    // Check if user has opted out of seeing this modal
    const hideKey = `reserv_hide_live_invite_guard_${authUser.id}`
    const hideGuard = localStorage.getItem(hideKey) === "true"
    if (hideGuard) {
      setLoading(false)
      return
    }

    try {
      const result = await getHostLiveSessions()
      if (result.ok) {
        // Deduplicate by id (extra safety)
        const uniqueSessions = Array.from(
          new Map(result.sessions.map(s => [s.id, s])).values()
        ).slice(0, 2) // Hard cap at 2
        setLiveSessions(uniqueSessions)
        setCount(result.count)
        setError(null)
        // Only auto-open if there are live sessions (existing behavior)
        if (result.count > 0) {
          setOpen(true)
        }
      } else {
        setError(result.error || "Failed to load live sessions")
        setLiveSessions([])
        setCount(0)
      }
    } catch (error: any) {
      console.error("Failed to check live sessions:", error)
      setError(error?.message || "Failed to load live sessions")
      setLiveSessions([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [authUser?.id])

  useEffect(() => {
    // Prevent double-fetch in React Strict Mode (initial mount only)
    if (hasFetched.current) return

    hasFetched.current = true
    checkLiveSessions()
  }, [checkLiveSessions])

  // Handle unpublish success - reset guard and refetch
  const handleUnpublishSuccess = useCallback(() => {
    // Reset guard to allow refetch
    hasFetched.current = false
    checkLiveSessions()
  }, [checkLiveSessions])

  if (loading) {
    return null
  }

  return (
    <LiveInviteGuardModal
      open={open}
      onOpenChange={setOpen}
      liveSessions={liveSessions}
      uiMode={uiMode}
      onContinueCreating={() => {
        // Modal is closed, user can continue creating
      }}
      userId={authUser?.id || null}
      onSessionsUpdate={(updatedSessions) => {
        setLiveSessions(updatedSessions)
        setCount(updatedSessions.length)
        // Don't close modal when empty - show empty state instead
      }}
      onUnpublishSuccess={handleUnpublishSuccess}
      count={count}
      isLoading={loading}
      error={error}
      onRetry={checkLiveSessions}
    />
  )
}

