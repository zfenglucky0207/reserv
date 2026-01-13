export function getAuthAvatarUrl(user: any): string | null {
  const url =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.avatar ||
    null
  return typeof url === "string" && url.trim() ? url : null
}

export function getInitialLetter(nameOrEmail: string | null | undefined): string {
  const s = (nameOrEmail || "").trim()
  return s ? s[0]!.toUpperCase() : "U"
}

