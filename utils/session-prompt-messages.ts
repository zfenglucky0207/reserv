import { format, parseISO } from "date-fns"

/**
 * Format session date and time for display in messages
 */
export function formatSessionDateTime(session: {
  title: string
  start_at: string
  end_at: string | null
  location: string | null
}): string {
  try {
    const start = parseISO(session.start_at)
    const end = session.end_at ? parseISO(session.end_at) : null

    const dayName = format(start, "EEE")
    const monthName = format(start, "MMM")
    const day = format(start, "d")
    const startTime = format(start, "h:mm a")
    const endTime = end ? format(end, "h:mm a") : null

    let dateTimeStr = `${dayName}, ${monthName} ${day} at ${startTime}`
    if (endTime) {
      dateTimeStr += ` - ${endTime}`
    }

    if (session.location) {
      dateTimeStr += `\n📍 ${session.location}`
    }

    return dateTimeStr
  } catch {
    return "Date TBD"
  }
}

/**
 * Generate attendance reminder message
 */
export function generateAttendanceReminderMessage(
  session: {
    title: string
    start_at: string
    end_at: string | null
    location: string | null
    sport: string
  },
  participants: Array<{ display_name: string }>,
  slotsRemaining: number
): string {
  const dateTime = formatSessionDateTime(session)
  
  // Get sport emoji
  const sportEmoji: Record<string, string> = {
    badminton: "🏸",
    pickleball: "🏓",
    volleyball: "🏐",
    futsal: "⚽",
    other: "🏃",
  }
  const emoji = sportEmoji[session.sport] || "🏃"

  let message = `${emoji} ${session.title} today\n\n`
  message += `${dateTime}\n\n`

  if (participants.length > 0) {
    message += `Going (${participants.length}${session.location ? "" : ""}):\n`
    participants.forEach((p, idx) => {
      message += `- ${p.display_name}`
      if (idx < participants.length - 1) message += "\n"
    })
    message += "\n\n"
  }

  if (slotsRemaining > 0) {
    message += `${slotsRemaining} slot${slotsRemaining > 1 ? "s" : ""} left — let me know if you're joining!`
  } else {
    message += "Session is full!"
  }

  return message
}

/**
 * Generate payment summary message
 */
export function generatePaymentSummaryMessage(
  session: {
    title: string
    price: number | null
  },
  paidParticipants: Array<{ display_name: string }>,
  pendingParticipants: Array<{ display_name: string }>
): string {
  // Get sport emoji (default to money emoji for payment)
  const emoji = "💰"

  let message = `${emoji} Payment summary for ${session.title}\n\n`

  if (paidParticipants.length > 0) {
    message += `✅ Paid:\n`
    paidParticipants.forEach((p, idx) => {
      message += `- ${p.display_name}`
      if (idx < paidParticipants.length - 1) message += "\n"
    })
    message += "\n\n"
  }

  if (pendingParticipants.length > 0) {
    message += `❌ Pending:\n`
    pendingParticipants.forEach((p, idx) => {
      message += `- ${p.display_name}`
      if (idx < pendingParticipants.length - 1) message += "\n"
    })
    message += "\n\n"
  }

  message += "Please settle when convenient, thanks 🙏"

  return message
}

/**
 * Get WhatsApp deep link URL
 */
export function getWhatsAppDeepLink(message: string): string {
  const encoded = encodeURIComponent(message)
  return `https://wa.me/?text=${encoded}`
}
