import { DEFAULT_COVER_BG, SPORT_COVER_MAP, TITLE_FONTS } from "@/constants/session-invite-constants"

// Helper function to format court display
export function formatCourtDisplay(courtValue: string): string {
  if (!courtValue) return ""
  const trimmed = courtValue.trim()
  // If already starts with "Court" or "Courts", return as is
  if (/^Courts?/i.test(trimmed)) {
    return trimmed
  }
  // Check if it contains commas (multiple courts)
  if (trimmed.includes(",")) {
    return `Courts ${trimmed}`
  }
  // Single court, add "Court" prefix
  return `Court ${trimmed}`
}

// Initialize sport from prop or default to "Badminton"
// Normalize to capitalized form for UI consistency
export function getSportDisplayName(sport: string | null | undefined): string {
  if (!sport) return "Badminton"
  const lower = sport.toLowerCase()
  if (lower === "badminton") return "Badminton"
  if (lower === "pickleball") return "Pickleball"
  if (lower === "volleyball") return "Volleyball"
  if (lower === "futsal" || lower === "other") return "Futsal"
  return "Badminton" // Default fallback
}

// Get cover options for current sport
export function getCoverOptions(selectedSport: string) {
  const sportCovers = SPORT_COVER_MAP[selectedSport] || SPORT_COVER_MAP["Badminton"]
  return [
    { id: "cyberpunk", label: "Cyberpunk", path: sportCovers.cyberpunk },
    { id: "ghibli", label: "Ghibli Style", path: sportCovers.ghibli },
  ]
}

// Parse eventDate string to extract date and time
export function parseEventDate(dateString: string): { date: Date; hour: number; minute: number; ampm: "AM" | "PM"; durationHours: number } | null {
  try {
    // Format: "Sat, Jan 25 • 9:00 AM - 11:00 AM"
    const parts = dateString.split("•")
    if (parts.length < 2) return null
    
    const datePart = parts[0].trim()
    const timePart = parts[1].trim()
    
    // Parse date: "Sat, Jan 25"
    const dateMatch = datePart.match(/(\w{3}),\s+(\w{3})\s+(\d{1,2})/)
    if (!dateMatch) return null
    
    const monthName = dateMatch[2]
    const day = parseInt(dateMatch[3], 10)
    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    }
    const month = monthMap[monthName]
    if (month === undefined) return null
    
    const currentYear = new Date().getFullYear()
    const date = new Date(currentYear, month, day)
    
    // Parse time: "9:00 AM - 11:00 AM" (take first part)
    const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s+(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s+(AM|PM)/)
    if (!timeMatch) {
      // Try single time format
      const singleTimeMatch = timePart.match(/(\d{1,2}):(\d{2})\s+(AM|PM)/)
      if (singleTimeMatch) {
        let hour = parseInt(singleTimeMatch[1], 10)
        const minute = parseInt(singleTimeMatch[2], 10)
        const meridiem = singleTimeMatch[3] as "AM" | "PM"
        if (hour > 12) hour = 12
        if (hour === 0) hour = 12
        return { date, hour, minute, ampm: meridiem, durationHours: 2 } // Default 2 hours
      }
      return { date, hour: 9, minute: 0, ampm: "AM" as const, durationHours: 2 }
    }
    
    let hour = parseInt(timeMatch[1], 10)
    const minute = parseInt(timeMatch[2], 10)
    const meridiem = timeMatch[3] as "AM" | "PM"
    let endHour = parseInt(timeMatch[4], 10)
    const endMinute = parseInt(timeMatch[5], 10)
    const endMeridiem = timeMatch[6] as "AM" | "PM"
    
    // Convert to 24h for duration calculation
    let startHour24 = hour
    if (meridiem === "AM" && hour === 12) startHour24 = 0
    else if (meridiem === "PM" && hour !== 12) startHour24 = hour + 12
    
    let endHour24 = endHour
    if (endMeridiem === "AM" && endHour === 12) endHour24 = 0
    else if (endMeridiem === "PM" && endHour !== 12) endHour24 = endHour + 12
    
    const startMinutes = startHour24 * 60 + minute
    const endMinutes = endHour24 * 60 + endMinute
    let durationHours = (endMinutes - startMinutes) / 60
    if (durationHours < 0) durationHours += 24 // Handle day wrap
    
    if (hour > 12) hour = 12
    if (hour === 0) hour = 12
    
    return { date, hour, minute, ampm: meridiem, durationHours }
  } catch {
    return null
  }
}

// Format Date + time to eventDate string
export function formatEventDate(date: Date, hour: number, minute: number, ampm: "AM" | "PM", durationHours: number = 2): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  
  const dayName = dayNames[date.getDay()]
  const monthName = monthNames[date.getMonth()]
  const day = date.getDate()
  
  // Format start time
  const startTime = `${hour}:${String(minute).padStart(2, "0")} ${ampm}`
  
  // Calculate end time (start + durationHours)
  let startHour24 = hour
  if (ampm === "AM" && hour === 12) startHour24 = 0
  else if (ampm === "PM" && hour !== 12) startHour24 = hour + 12
  
  let totalMinutes = startHour24 * 60 + minute + (durationHours * 60)
  if (totalMinutes >= 1440) totalMinutes -= 1440 // Wrap to next day
  
  const endHour24 = Math.floor(totalMinutes / 60) % 24
  const endMinute = totalMinutes % 60
  
  // Convert to 12h
  let endHour = endHour24
  let endMeridiem: "AM" | "PM" = "AM"
  if (endHour24 === 0) {
    endHour = 12
    endMeridiem = "AM"
  } else if (endHour24 === 12) {
    endHour = 12
    endMeridiem = "PM"
  } else if (endHour24 < 12) {
    endHour = endHour24
    endMeridiem = "AM"
  } else {
    endHour = endHour24 - 12
    endMeridiem = "PM"
  }
  
  const endTime = `${endHour}:${String(endMinute).padStart(2, "0")} ${endMeridiem}`
  
  return `${dayName}, ${monthName} ${day} • ${startTime} - ${endTime}`
}

// Helper function to validate if a string is a valid Google Maps URL
export function isValidGoogleMapsUrl(value: string | null | undefined): boolean {
  if (!value || !value.trim()) {
    return false
  }

  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase()
    
    // Check if hostname is a Google Maps domain
    const isGoogleMapsDomain = 
      hostname.includes("google.com") ||
      hostname.includes("maps.app.goo.gl") ||
      hostname.includes("goo.gl") ||
      hostname === "maps.google.com"
    
    if (!isGoogleMapsDomain) {
      return false
    }
    
    // Check if pathname indicates maps (for google.com domains)
    if (hostname.includes("google.com") && !url.pathname.includes("/maps")) {
      return false
    }
    
    return true
  } catch {
    // Not a valid URL
    return false
  }
}

// Helper function to get the Google Maps URL to embed (checks both eventMapUrl and eventLocation)
export function getValidGoogleMapsUrl(eventMapUrl: string, eventLocation: string): string | null {
  // First check eventMapUrl (dedicated map URL field)
  if (eventMapUrl && isValidGoogleMapsUrl(eventMapUrl)) {
    return eventMapUrl.trim()
  }
  
  // Then check eventLocation (might contain a Google Maps URL)
  if (eventLocation && isValidGoogleMapsUrl(eventLocation)) {
    return eventLocation.trim()
  }
  
  return null
}

// Helper function to convert map URL to embed URL
export function getMapEmbedSrc(mapUrl: string): string {
  try {
    // Check if it's already an embed URL
    if (mapUrl.includes("/embed")) {
      return mapUrl
    }
    // Convert to embed URL
    return `https://www.google.com/maps?q=${encodeURIComponent(mapUrl)}&output=embed`
  } catch {
    // Fallback
    return `https://www.google.com/maps?q=${encodeURIComponent(mapUrl)}&output=embed`
  }
}

// Validation helper functions
export function isBlank(v?: string | null): boolean {
  return !v || v.trim().length === 0
}

export function isPlaceholder(v: string, placeholder: string): boolean {
  return v.trim().toLowerCase() === placeholder.trim().toLowerCase()
}

// Placeholder constants for validation
export const PLACEHOLDERS = {
  title: "Enter title here",
  date: "Choose date",
  location: "Enter location",
  host: "Your name",
}

// Validation functions
export function isTitleValid(eventTitle: string): boolean {
  return !isBlank(eventTitle) && !isPlaceholder(eventTitle, PLACEHOLDERS.title)
}

export function isDateValid(eventDate: string): boolean {
  return !isBlank(eventDate) && !isPlaceholder(eventDate, PLACEHOLDERS.date)
}

export function isLocationValid(eventLocation: string): boolean {
  return !isBlank(eventLocation) && !isPlaceholder(eventLocation, PLACEHOLDERS.location)
}

export function isPriceValid(eventPrice: number | null | undefined): boolean {
  return typeof eventPrice === "number" && !Number.isNaN(eventPrice) && eventPrice >= 0
}

export function isCapacityValid(eventCapacity: number | null | undefined): boolean {
  return Number.isInteger(eventCapacity) && eventCapacity >= 1
}

export function isHostValid(displayHostName: string): boolean {
  return !isBlank(displayHostName) && !isPlaceholder(displayHostName, PLACEHOLDERS.host)
}

// Helper to check if string is valid UUID
export function isValidUUID(str: string | undefined): boolean {
  if (!str) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

