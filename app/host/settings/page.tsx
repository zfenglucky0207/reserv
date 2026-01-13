import { createClient, getUserId } from "@/lib/supabase/server/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { HostSettingsClient } from "@/components/host/host-settings-client"

// Force dynamic rendering
export const dynamic = "force-dynamic"

async function HostSettingsContent() {
  const supabase = await createClient()
  const userId = await getUserId(supabase)

  if (!userId) {
    // If the user signs out while on this page, default them back to home.
    redirect("/")
  }

  return <HostSettingsClient />
}

export default async function HostSettingsPage() {
  return (
    <main className="min-h-screen sporty-bg">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <HostSettingsContent />
      </Suspense>
    </main>
  )
}

