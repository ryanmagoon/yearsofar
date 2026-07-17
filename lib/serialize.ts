import type { GameYearRow } from './types'

/** GameYearRow with dates as ISO strings, safe to pass to client components. */
export interface GameRowJson {
  appid: number
  name: string
  totalMinutes: number
  minutesGained: number
  lastPlayed: string | null
  firstPlayedThisYear: boolean
  newToLibrary: boolean
  playedThisYear: boolean
  recentMinutes: number
}

export function toGameRowJson(row: GameYearRow): GameRowJson {
  return {
    ...row,
    lastPlayed: row.lastPlayed?.toISOString() ?? null,
  }
}
