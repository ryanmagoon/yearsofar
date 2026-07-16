/** One game's state at a point in time (either a stored snapshot row or live Steam data). */
export interface GameSnapshot {
  appid: number
  name: string
  /** Total lifetime playtime in minutes, as reported by Steam. */
  playtimeMinutes: number
  /** When the game was last launched, if Steam reports it. */
  lastPlayed: Date | null
}

/** Per-game year-to-date stats derived from comparing a baseline snapshot to current data. */
export interface GameYearRow {
  appid: number
  name: string
  totalMinutes: number
  /** Minutes played since the baseline snapshot (clamped to >= 0). */
  minutesGained: number
  lastPlayed: Date | null
  /** True if the game had zero recorded playtime at the baseline and has playtime now. */
  firstPlayedThisYear: boolean
  /** True if the game wasn't in the library at the baseline snapshot. */
  newToLibrary: boolean
  /** True if any playtime was gained since the baseline. */
  playedThisYear: boolean
}

export interface YearStats {
  games: GameYearRow[]
  totalMinutesGained: number
  gamesPlayedCount: number
  firstPlayedCount: number
}
