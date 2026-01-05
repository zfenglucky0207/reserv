/**
 * Client-side utility for generating invite share URLs
 * Works without authentication or server calls
 */

interface InviteUrlParams {
  hostSlug?: string | null
  publicCode?: string | null
}

/**
 * Generate an invite share URL from hostSlug and publicCode
 * Falls back to parsing current URL if params are missing
 */
export function getInviteShareUrl(params?: InviteUrlParams): string | null {
  let hostSlug = params?.hostSlug
  let publicCode = params?.publicCode

  // If params are missing, try to parse from current URL
  if (typeof window !== "undefined" && (!hostSlug || !publicCode)) {
    const pathname = window.location.pathname
    // URL format: /{hostSlug}/{publicCode}
    const parts = pathname.split("/").filter(Boolean)
    
    if (parts.length >= 2) {
      // Assume format: [hostSlug, publicCode, ...]
      if (!hostSlug) hostSlug = parts[0]
      if (!publicCode) publicCode = parts[1]
    }
  }

  // If we still don't have both, can't generate URL
  if (!hostSlug || !publicCode) {
    return null
  }

  // Generate full URL using current origin (works in dev/staging/prod)
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/${hostSlug}/${publicCode}`
}

/**
 * Share an invite link using Web Share API (mobile) or clipboard fallback
 */
export async function shareInviteLink(
  url: string,
  title: string = "Join this session",
  text: string = "Check out this session invite!"
): Promise<{ success: boolean; method: "share" | "clipboard" | null; error?: string }> {
  if (typeof window === "undefined") {
    return { success: false, method: null, error: "Not in browser environment" }
  }

  // Try Web Share API first (mobile)
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url,
      })
      return { success: true, method: "share" }
    } catch (error: any) {
      // User cancelled or share failed, fall through to clipboard
      if (error.name === "AbortError") {
        return { success: false, method: null, error: "Share cancelled" }
      }
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(url)
    return { success: true, method: "clipboard" }
  } catch (error: any) {
    return { success: false, method: null, error: error?.message || "Failed to copy" }
  }
}

