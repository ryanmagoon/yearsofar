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
 * - "Played this year" is true when playtime grew since the baseline OR
 *   Steam's last-played timestamp falls within the year — the latter covers
 *   games played before tracking started, where the hour count is unknown.
 * - Games missing from the baseline are treated as new to the library and
 *   their full playtime counts as gained this year.
 * - Games present in the baseline but missing from the current snapshot
 *   (removed from the library) are dropped.
 */
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Applies Steam's authoritative per-game first-played timestamps (from
 * ClientGetLastPlayedTimes). Unlike heuristics, these override in both
 * directions: an in-year date proves first-played (and the game's whole
 * lifetime counts toward the year), a pre-year date disproves it even when a
 * heuristic said otherwise. Games without a record are left untouched.
 */
export function applyFirstPlayedTimes(
  stats: YearStats,
  firstPlayedByAppid: Map<number, Date>,
  year: number,
): YearStats {
  const games = stats.games.map((game) => {
    const firstPlayed = firstPlayedByAppid.get(game.appid)
    if (!firstPlayed) return game
    if (firstPlayed.getUTCFullYear() === year) {
      return {
        ...game,
        firstPlayedThisYear: true,
        playedThisYear: true,
        minutesThisYearFloor: Math.max(
          game.minutesThisYearFloor,
          game.totalMinutes,
        ),
      }
    }
    return { ...game, firstPlayedThisYear: false }
  })

  return {
    ...stats,
    games,
    totalMinutesFloor: games.reduce(
      (sum, g) => sum + g.minutesThisYearFloor,
      0,
    ),
    gamesPlayedCount: games.filter((g) => g.playedThisYear).length,
    firstPlayedCount: games.filter((g) => g.firstPlayedThisYear).length,
  }
}

/**
 * Upgrades firstPlayedThisYear using achievement unlock dates: a game whose
 * unlocks all fall within the year was, with near certainty, first played
 * this year — which also means its entire lifetime playtime happened this
 * year, so the year floor rises to the lifetime total. Evidence can only add
 * flags, never revoke proven ones; games with no evidence are left untouched.
 */
export function applyFirstPlayedEvidence(
  stats: YearStats,
  unlocksByAppid: Map<number, Date[]>,
  year: number,
): YearStats {
  const games = stats.games.map((game) => {
    if (game.firstPlayedThisYear) return game
    const unlocks = unlocksByAppid.get(game.appid)
    if (!unlocks || unlocks.length === 0) return game
    const anyBeforeYear = unlocks.some((date) => date.getUTCFullYear() < year)
    const anyInYear = unlocks.some((date) => date.getUTCFullYear() === year)
    if (!anyBeforeYear && anyInYear) {
      return {
        ...game,
        firstPlayedThisYear: true,
        minutesThisYearFloor: Math.max(
          game.minutesThisYearFloor,
          game.totalMinutes,
        ),
      }
    }
    return game
  })

  return {
    ...stats,
    games,
    totalMinutesFloor: games.reduce(
      (sum, g) => sum + g.minutesThisYearFloor,
      0,
    ),
    firstPlayedCount: games.filter((g) => g.firstPlayedThisYear).length,
  }
}

/**
 * Applies license acquisition dates (from the license_dates table, scraped
 * off the Steam account page). A known date decides newToLibrary in both
 * directions: acquired in-year marks a game new even when the baseline
 * already contained it (bought before tracking began), and a pre-year date
 * clears a false positive from a game re-appearing in the library. Games
 * without a date keep their baseline-derived flag. Playtime figures are
 * untouched.
 */
export function applyAcquiredDates(
  stats: YearStats,
  acquiredByAppid: Map<number, string>,
  year: number,
): YearStats {
  return {
    ...stats,
    games: stats.games.map((game) => {
      const acquired = acquiredByAppid.get(game.appid)
      if (!acquired) return game
      return { ...game, newToLibrary: acquired.startsWith(`${year}-`) }
    }),
  }
}

export function computeYearStats(
  baseline: GameSnapshot[],
  current: GameSnapshot[],
  year: number,
  now: Date = new Date(),
): YearStats {
  const baselineByAppid = dedupeByAppid(baseline)
  const currentByAppid = dedupeByAppid(current)

  // Steam's playtime_2weeks only proves in-year play once the whole rolling
  // window sits inside the year (i.e. from Jan 15 onward).
  const recentWindowInYear =
    now.getUTCFullYear() === year &&
    now.getTime() - TWO_WEEKS_MS >= Date.UTC(year, 0, 1)

  const games: GameYearRow[] = []
  for (const game of currentByAppid.values()) {
    const baselineGame = baselineByAppid.get(game.appid)
    const newToLibrary = baselineGame === undefined
    const baselineMinutes = baselineGame?.playtimeMinutes ?? 0
    const minutesGained = Math.max(0, game.playtimeMinutes - baselineMinutes)
    const lastPlayedThisYear = game.lastPlayed?.getUTCFullYear() === year
    const recentMinutes = game.recentMinutes ?? 0
    const provenRecentMinutes = recentWindowInYear ? recentMinutes : 0
    const minutesThisYearFloor = Math.max(minutesGained, provenRecentMinutes)

    games.push({
      appid: game.appid,
      name: game.name,
      totalMinutes: game.playtimeMinutes,
      minutesGained,
      lastPlayed: game.lastPlayed,
      newToLibrary,
      firstPlayedThisYear:
        (baselineMinutes === 0 && game.playtimeMinutes > 0) ||
        // Two-week playtime covering the whole lifetime proves the first
        // launch was this year, even when the baseline is same-day.
        (game.playtimeMinutes > 0 &&
          provenRecentMinutes >= game.playtimeMinutes),
      playedThisYear: minutesThisYearFloor > 0 || lastPlayedThisYear,
      recentMinutes,
      minutesThisYearFloor,
    })
  }

  return {
    games,
    totalMinutesGained: games.reduce((sum, g) => sum + g.minutesGained, 0),
    totalRecentMinutes: games.reduce((sum, g) => sum + g.recentMinutes, 0),
    totalMinutesFloor: games.reduce(
      (sum, g) => sum + g.minutesThisYearFloor,
      0,
    ),
    gamesPlayedCount: games.filter((g) => g.playedThisYear).length,
    firstPlayedCount: games.filter((g) => g.firstPlayedThisYear).length,
  }
}
