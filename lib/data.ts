import { getBaselineSnapshot, writeSnapshot } from './db'
import { computeYearStats } from './stats'
import { getOwnedGames } from './steam'
import type { YearStats } from './types'

export interface YearSoFar {
  stats: YearStats
  year: number
  /** ISO date (yyyy-mm-dd) of the baseline snapshot deltas are measured from. */
  baselineDate: string
  /** True if the baseline was taken after Jan 7 — the UI should flag partial-year tracking. */
  baselineIsPartial: boolean
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

  return {
    stats: computeYearStats(baseline.games, current),
    year,
    baselineDate: baseline.date,
    baselineIsPartial: baseline.date > `${year}-01-07`,
  }
}
