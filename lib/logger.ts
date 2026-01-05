// lib/logger.ts
export type LogLevel = "debug" | "info" | "warn" | "error"

export function log(
  level: LogLevel,
  msg: string,
  meta?: Record<string, unknown>
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {}),
  }
  // Server + client safe
  // On Vercel you can filter logs by "traceId"
  console[level === "debug" ? "log" : level](JSON.stringify(payload))
}

export function newTraceId(prefix = "trace") {
  // Use crypto.randomUUID() if available, fallback to Date-based ID
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  // Fallback for environments without crypto.randomUUID
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

