/** Formats minutes as a compact hours string: 38 → "38m", 90 → "1.5h", 7205 → "120.1h". */
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`
}

/** Formats an ISO date/datetime as "Jul 12" (same year) or "Dec 3, 2025" (other years). */
export function formatDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
}
