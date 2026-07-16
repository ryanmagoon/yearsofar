import type { GameSnapshot, GameYearRow, YearStats } from './types'

/**
 * Collapses duplicate appids into a single entry, keeping the row with the
 * highest playtime (the most complete record if a snapshot was written twice).
 */
function dedupeByAppid(games: GameSnapshot[]): Map<number, GameSnapshot> {
  const byAppid = new Map<number, GameSnapshot>()
  for (const game of games) {
    const existing = byAppid.get(game.appid)
    if (!existing || game.playtimeMinutes > existing.playtimeMinutes) {
      byAppid.set(game.appid, game)
    }
  }
  return byAppid
}

/**
 * Computes year-to-date stats by comparing a baseline snapshot (ideally taken
 * near Jan 1) against the current library state.
 *
 * - Deltas are clamped to >= 0 (Steam totals can shrink, e.g. family sharing).
 * - Games missing from the baseline are treated as new to the library and
 *   their full playtime counts as gained this year.
 * - Games present in the baseline but missing from the current snapshot
 *   (removed from the library) are dropped.
 */
export function computeYearStats(
  baseline: GameSnapshot[],
  current: GameSnapshot[],
): YearStats {
  const baselineByAppid = dedupeByAppid(baseline)
  const currentByAppid = dedupeByAppid(current)

  const games: GameYearRow[] = []
  for (const game of currentByAppid.values()) {
    const baselineGame = baselineByAppid.get(game.appid)
    const newToLibrary = baselineGame === undefined
    const baselineMinutes = baselineGame?.playtimeMinutes ?? 0
    const minutesGained = Math.max(0, game.playtimeMinutes - baselineMinutes)

    games.push({
      appid: game.appid,
      name: game.name,
      totalMinutes: game.playtimeMinutes,
      minutesGained,
      lastPlayed: game.lastPlayed,
      newToLibrary,
      firstPlayedThisYear: baselineMinutes === 0 && game.playtimeMinutes > 0,
      playedThisYear: minutesGained > 0,
    })
  }

  return {
    games,
    totalMinutesGained: games.reduce((sum, g) => sum + g.minutesGained, 0),
    gamesPlayedCount: games.filter((g) => g.playedThisYear).length,
    firstPlayedCount: games.filter((g) => g.firstPlayedThisYear).length,
  }
}
