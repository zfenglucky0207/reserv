"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { UserCircle, LogOut, Radio, Plus, Settings } from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LoginDialog } from "@/components/login-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAuthAvatarUrl, getInitialLetter } from "@/lib/avatar"
import { StardustButton } from "@/components/ui/stardust-button"
import { LiveInviteGuardModal } from "@/components/host/live-invite-guard-modal"
import { getHostLiveSessions } from "@/app/host/sessions/[id]/actions"
import { getCurrentReturnTo, setPostAuthRedirect } from "@/lib/post-auth-redirect"
import { useToast } from "@/hooks/use-toast"

interface TopNavProps {
  showCreateNow?: boolean
  onContinueAsGuest?: (name: string) => void
}

export function TopNav({ showCreateNow = false, onContinueAsGuest }: TopNavProps) {
  const { authUser, logOut } = useAuth()
  const { toast } = useToast()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [liveInvitesModalOpen, setLiveInvitesModalOpen] = useState(false)
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
  const [isLoadingLiveSessions, setIsLoadingLiveSessions] = useState(false)
  const [liveSessionsError, setLiveSessionsError] = useState<string | null>(null)
  const [liveSessionsCount, setLiveSessionsCount] = useState<number | undefined>(undefined)
  const [uiMode, setUiMode] = useState<"dark" | "light">("dark")
  const pathname = usePathname()
  const router = useRouter()

  // Sync uiMode from localStorage
  useEffect(() => {
    const savedUiMode = localStorage.getItem("reserv-ui-mode") as "dark" | "light" | null
    if (savedUiMode === "dark" || savedUiMode === "light") {
      setUiMode(savedUiMode)
    }
  }, [])

  const handleSignOut = async () => {
    try {
    await logOut()
      toast({ title: "Signed out" })
      // Stay on current page, refresh server components if needed
      router.refresh()
    } catch (error: any) {
      toast({ 
        title: "Sign out failed", 
        description: error?.message || "Failed to sign out",
        variant: "destructive"
      })
    }
  }

  const refetchLiveSessions = async () => {
    if (!authUser?.id) return

    try {
      const result = await getHostLiveSessions()
      if (result.ok) {
        // Deduplicate by id (extra safety)
        const uniqueSessions = Array.from(
          new Map(result.sessions.map(s => [s.id, s])).values()
        ).slice(0, 2) // Hard cap at 2
        setLiveSessions(uniqueSessions)
        setLiveSessionsCount(result.count)
        setLiveSessionsError(null)
      } else {
        setLiveSessionsError(result.error || "Failed to load live invites")
        setLiveSessionsCount(0)
        setLiveSessions([])
      }
    } catch (error: any) {
      console.error("Failed to refetch live sessions:", error)
      setLiveSessionsError(error?.message || "Failed to load live invites")
      setLiveSessionsCount(0)
      setLiveSessions([])
    }
  }

  const handleLiveInvitesClick = async () => {
    if (!authUser?.id) return

    setIsLoadingLiveSessions(true)
    setLiveSessionsError(null)

    try {
      const result = await getHostLiveSessions()
      if (result.ok) {
        // Deduplicate by id (extra safety)
        const uniqueSessions = Array.from(
          new Map(result.sessions.map(s => [s.id, s])).values()
        ).slice(0, 2)
        setLiveSessions(uniqueSessions)
        setLiveSessionsCount(result.count)
        setLiveInvitesModalOpen(true)
      } else {
        setLiveSessionsError(result.error || "Failed to load live invites")
        setLiveSessionsCount(0)
        setLiveSessions([])
        setLiveInvitesModalOpen(true) // Open modal to show error state
      }
    } catch (error: any) {
      console.error("Failed to fetch live sessions:", error)
      setLiveSessionsError(error?.message || "Failed to load live invites")
      setLiveSessionsCount(0)
      setLiveSessions([])
      setLiveInvitesModalOpen(true) // Open modal to show error state
    } finally {
      setIsLoadingLiveSessions(false)
    }
  }

  const handleRetryLiveSessions = async () => {
    await handleLiveInvitesClick()
  }

  // Get user display name
  const getUserDisplayName = () => {
    if (!authUser) return null
    const fullName = authUser.user_metadata?.full_name
    if (fullName) return fullName
    const email = authUser.email || ""
    return email.split("@")[0]
  }

  const displayName = getUserDisplayName()
  const userInitial = getInitialLetter(displayName || authUser?.email)
  const avatarUrl = getAuthAvatarUrl(authUser)

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/40 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="text-gray-900 dark:text-white font-semibold tracking-widest text-sm hover:text-gray-700 dark:hover:text-white/80 transition-colors">
            RESERV
          </Link>
          <div className="flex items-center gap-2">
            {showCreateNow && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="w-auto"
              >
                <StardustButton
                  onClick={() => router.push("/host/sessions/new/edit")}
                  className="!w-auto min-w-[10px] px-1 py-1.5 text-sm"
                >
                  Create now
                </StardustButton>
              </motion.div>
            )}
            {authUser ? (
              <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors">
                    <Avatar className="h-7 w-7 border border-gray-300 dark:border-white/20">
                      {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName || "Profile"} /> : null}
                      <AvatarFallback className="bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white text-xs font-medium">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                      <span className="text-sm font-medium hidden sm:inline-block max-w-[120px] truncate text-gray-900 dark:text-white">
                      {displayName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white min-w-[180px]">
                    <DropdownMenuItem disabled className="text-gray-500 dark:text-white/60 cursor-default">
                    Profile
                  </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-200 dark:bg-white/10" />
                    <DropdownMenuItem
                      onClick={() => router.push("/host/sessions/new/edit")}
                      className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer focus:bg-gray-100 dark:focus:bg-white/10"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create session
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLiveInvitesClick}
                      className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer focus:bg-gray-100 dark:focus:bg-white/10"
                    >
                      <Radio className="mr-2 h-4 w-4" />
                      Live invites
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push("/host/settings")}
                      className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer focus:bg-gray-100 dark:focus:bg-white/10"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-200 dark:bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                      className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer focus:bg-gray-100 dark:focus:bg-white/10"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
                    </>
            ) : (
                    <>
              <button
                onClick={() => {
                  // Capture current URL before opening login dialog
                  const returnTo = getCurrentReturnTo()
                  console.log("[AUTH] Navbar login clicked", { returnTo, currentPath: window.location.pathname })
                  // Set post-auth redirect
                  setPostAuthRedirect(returnTo)
                  setLoginDialogOpen(true)
                }}
                        className="text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors"
              >
                Login
              </button>
                    </>
            )}
          </div>
        </div>
      </nav>
      {!authUser && (
        <LoginDialog
          open={loginDialogOpen}
          onOpenChange={setLoginDialogOpen}
          onContinueAsGuest={onContinueAsGuest}
        />
      )}
          {authUser && (
            <LiveInviteGuardModal
              open={liveInvitesModalOpen}
              onOpenChange={setLiveInvitesModalOpen}
              liveSessions={liveSessions}
              uiMode={uiMode}
              onContinueCreating={() => {
                setLiveInvitesModalOpen(false)
              }}
              userId={authUser.id || null}
              onSessionsUpdate={(updatedSessions) => {
                setLiveSessions(updatedSessions)
                setLiveSessionsCount(updatedSessions.length)
                // Don't close modal when empty - show empty state instead
              }}
              onUnpublishSuccess={refetchLiveSessions}
              count={liveSessionsCount}
              isLoading={isLoadingLiveSessions}
              error={liveSessionsError}
              onRetry={handleRetryLiveSessions}
            />
          )}
    </>
  )
}

