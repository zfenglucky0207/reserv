// Text shadow utilities for hero overlay text (preview + public invite only)
export const HERO_TITLE_SHADOW = "[text-shadow:0_2px_18px_rgba(0,0,0,0.65),0_1px_2px_rgba(0,0,0,0.35)]"
export const HERO_META_SHADOW = "[text-shadow:0_1px_10px_rgba(0,0,0,0.55)]"
export const HERO_ICON_SHADOW = "drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]"

// Default cover background colors by sport (when no cover image is set)
export const DEFAULT_COVER_BG: Record<string, string> = {
  Badminton: "#ECFCCB",   // light green (lime-100, matches badminton lime green theme)
  Futsal: "#EAF2FF",      // light blue (matches futsal blue vibe)
  Volleyball: "#F3F4F6",  // light gray (clean neutral)
  Pickleball: "#FFF1E6",  // light orange/peach (matches pickleball orange vibe)
}

// Sport to cover image mapping
export const SPORT_COVER_MAP: Record<string, { cyberpunk: string; ghibli: string }> = {
  Badminton: {
    cyberpunk: "/cyberpunk/badminton.png",
    ghibli: "/ghibli style/bird-badminton.png",
  },
  Pickleball: {
    cyberpunk: "/cyberpunk/pickleball.png",
    ghibli: "/ghibli style/bird-pickleball.png",
  },
  Volleyball: {
    cyberpunk: "/cyberpunk/volleyball.png",
    ghibli: "/ghibli style/bird-volleyball.png",
  },
  Futsal: {
    cyberpunk: "/cyberpunk/futsal.png",
    ghibli: "/ghibli style/bird-football.png",
  },
}

// Sport to theme mapping
export const SPORT_THEME_MAP: Record<string, string> = {
  Badminton: "badminton",
  Pickleball: "pickleball",
  Volleyball: "clean", // Using clean theme for volleyball
  Futsal: "midnight", // Using midnight theme for futsal
}

export const TITLE_FONTS = {
  Classic: "font-sans",
  Eclectic: "font-mono",
  Fancy: "font-serif",
  Literary: "font-serif italic",
}

