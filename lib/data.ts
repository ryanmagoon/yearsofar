import { getBaselineSnapshot, getLicenseDates, writeSnapshot } from './db'
import {
  applyAcquiredDates,
  applyFirstPlayedEvidence,
  applyFirstPlayedTimes,
  computeYearStats,
} from './stats'
import {
  getAchievementUnlocks,
  getFirstPlayedTimes,
  getOwnedGames,
} from './steam'
import type { YearStats } from './types'

/** Upper bound on per-request achievement lookups, to keep page latency sane. */
const MAX_ACHIEVEMENT_LOOKUPS = 200

export interface YearSoFar {
  stats: YearStats
  year: number
  /** ISO date (yyyy-mm-dd) of the baseline snapshot deltas are measured from. */
  baselineDate: string
  /** True if the baseline was taken after Jan 7 — the UI should flag partial-year tracking. */
  baselineIsPartial: boolean
  /**
   * True when license acquisition dates are loaded, i.e. "new to library" is
   * based on real purchase dates rather than absence from the baseline.
   */
  hasAcquiredDates: boolean
}

/** Current date in UTC as yyyy-mm-dd. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Fetches live Steam data and compares it against this year's baseline
 * snapshot. If no snapshot exists yet (first run), the live data is stored as
 * the baseline — deltas start accumulating from today.
 */
export async function getYearSoFar(): Promise<YearSoFar> {
  const today = todayUtc()
  const year = Number(today.slice(0, 4))
  const current = await getOwnedGames()

  let baseline = await getBaselineSnapshot(year)
  if (!baseline) {
    await writeSnapshot(today, current)
    baseline = { date: today, games: current }
  }

  let stats = computeYearStats(baseline.games, current, year)

  // License acquisition dates (when loaded) decide "new to library" from
  // real purchase dates instead of absence from the baseline snapshot.
  const acquiredDates = await getLicenseDates()
  stats = applyAcquiredDates(stats, acquiredDates, year)

  // Steam's own first-launch records are authoritative — apply them first.
  const firstPlayedTimes = await getFirstPlayedTimes()
  stats = applyFirstPlayedTimes(stats, firstPlayedTimes, year)

  // For games Steam has no first-launch record for, fall back to achievement
  // unlock dates (all unlocks in-year implies first played this year).
  const candidates = stats.games
    .filter(
      (game) =>
        game.playedThisYear &&
        !game.firstPlayedThisYear &&
        !firstPlayedTimes.has(game.appid),
    )
    .sort((a, b) => b.minutesThisYearFloor - a.minutesThisYearFloor)
    .slice(0, MAX_ACHIEVEMENT_LOOKUPS)
  const evidence = new Map<number, Date[]>()
  await Promise.all(
    candidates.map(async (game) => {
      evidence.set(game.appid, await getAchievementUnlocks(game.appid))
    }),
  )
  stats = applyFirstPlayedEvidence(stats, evidence, year)

  return {
    stats,
    year,
    baselineDate: baseline.date,
    baselineIsPartial: baseline.date > `${year}-01-07`,
    hasAcquiredDates: acquiredDates.size > 0,
  }
}
