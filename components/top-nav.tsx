"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserCircle, LogOut } from "lucide-react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"

interface TopNavProps {
  showCreateNow?: boolean
  onContinueAsGuest?: (name: string) => void
}

export function TopNav({ showCreateNow = false, onContinueAsGuest }: TopNavProps) {
  const { authUser, logOut } = useAuth()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const pathname = usePathname()

  const handleSignOut = async () => {
    await logOut()
    // Refresh to update UI state
    window.location.href = "/"
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
  const userInitial = displayName?.[0]?.toUpperCase() || authUser?.email?.[0]?.toUpperCase() || "U"

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/40 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="text-gray-900 dark:text-white font-semibold tracking-widest text-sm hover:text-gray-700 dark:hover:text-white/80 transition-colors">
            RESERV
          </Link>
          <div className="flex items-center gap-2">
            {showCreateNow && (
              <Link
                href="/host/sessions/new/edit"
                className="text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors"
              >
                Create Now
              </Link>
            )}
            {authUser ? (
              <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors">
                    <Avatar className="h-7 w-7 border border-gray-300 dark:border-white/20">
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
                    onClick={handleSignOut}
                      className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer focus:bg-gray-100 dark:focus:bg-white/10"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
                <ThemeToggle />
              </>
            ) : (
              <>
              <button
                onClick={() => setLoginDialogOpen(true)}
                  className="text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors"
              >
                Login
              </button>
                <ThemeToggle />
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
    </>
  )
}

