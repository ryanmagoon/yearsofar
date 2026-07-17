import { describe, expect, it } from 'vitest'
import {
  applyAcquiredDates,
  applyFirstPlayedEvidence,
  applyFirstPlayedTimes,
  computeYearStats,
} from './stats'
import type { GameSnapshot } from './types'

const YEAR = 2026

function game(
  overrides: Partial<GameSnapshot> & { appid: number },
): GameSnapshot {
  return {
    name: `Game ${overrides.appid}`,
    playtimeMinutes: 0,
    lastPlayed: null,
    ...overrides,
  }
}

describe('computeYearStats', () => {
  it('returns empty stats when both snapshots are empty', () => {
    const stats = computeYearStats([], [], YEAR)
    expect(stats.games).toEqual([])
    expect(stats.totalMinutesGained).toBe(0)
    expect(stats.totalRecentMinutes).toBe(0)
    expect(stats.gamesPlayedCount).toBe(0)
    expect(stats.firstPlayedCount).toBe(0)
  })

  it('clamps negative deltas to zero (Steam totals can shrink, e.g. family sharing)', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 500 })],
      [game({ appid: 1, playtimeMinutes: 400 })],
      YEAR,
    )
    expect(stats.games[0]?.minutesGained).toBe(0)
    expect(stats.games[0]?.playedThisYear).toBe(false)
    expect(stats.totalMinutesGained).toBe(0)
  })

  it('deduplicates repeated appids within a snapshot, keeping the highest playtime', () => {
    const stats = computeYearStats(
      [
        game({ appid: 1, playtimeMinutes: 100 }),
        game({ appid: 1, playtimeMinutes: 90 }),
      ],
      [
        game({ appid: 1, playtimeMinutes: 150 }),
        game({ appid: 1, playtimeMinutes: 160 }),
      ],
      YEAR,
    )
    expect(stats.games).toHaveLength(1)
    expect(stats.games[0]?.minutesGained).toBe(60)
  })

  it('keeps zero-playtime games in the list but never counts them as played', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 0 })],
      [game({ appid: 1, playtimeMinutes: 0 })],
      YEAR,
    )
    expect(stats.games).toHaveLength(1)
    expect(stats.games[0]?.playedThisYear).toBe(false)
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
    expect(stats.gamesPlayedCount).toBe(0)
  })

  it('handles missing lastPlayed dates', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 10 })],
      [game({ appid: 1, playtimeMinutes: 30, lastPlayed: null })],
      YEAR,
    )
    expect(stats.games[0]?.lastPlayed).toBeNull()
    expect(stats.games[0]?.minutesGained).toBe(20)
  })

  it('ignores games that were in the baseline but are gone from the current snapshot', () => {
    const stats = computeYearStats(
      [
        game({ appid: 1, playtimeMinutes: 100 }),
        game({ appid: 2, playtimeMinutes: 50 }),
      ],
      [game({ appid: 1, playtimeMinutes: 120 })],
      YEAR,
    )
    expect(stats.games).toHaveLength(1)
    expect(stats.games[0]?.appid).toBe(1)
  })

  it('marks a game absent from the baseline as new to library, counting its full playtime as gained', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 100 })],
      [
        game({ appid: 1, playtimeMinutes: 100 }),
        game({ appid: 2, playtimeMinutes: 300 }),
      ],
      YEAR,
    )
    const newGame = stats.games.find((g) => g.appid === 2)
    expect(newGame?.newToLibrary).toBe(true)
    expect(newGame?.minutesGained).toBe(300)
    expect(newGame?.firstPlayedThisYear).toBe(true)
    expect(newGame?.playedThisYear).toBe(true)
  })

  it('marks a new-to-library game with zero playtime as unplayed, not first-played', () => {
    const stats = computeYearStats(
      [],
      [game({ appid: 2, playtimeMinutes: 0 })],
      YEAR,
    )
    const newGame = stats.games[0]
    expect(newGame?.newToLibrary).toBe(true)
    expect(newGame?.firstPlayedThisYear).toBe(false)
    expect(newGame?.playedThisYear).toBe(false)
  })

  it('marks a game owned at baseline with zero playtime, played since, as first played this year', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 0 })],
      [game({ appid: 1, playtimeMinutes: 45 })],
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(true)
    expect(stats.games[0]?.newToLibrary).toBe(false)
    expect(stats.games[0]?.minutesGained).toBe(45)
  })

  it('does not mark a game with prior playtime as first played this year', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 200 })],
      [game({ appid: 1, playtimeMinutes: 260 })],
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
    expect(stats.games[0]?.playedThisYear).toBe(true)
  })

  it('marks a game with no delta but a last-played date within the year as played this year', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 900 })],
      [
        game({
          appid: 1,
          playtimeMinutes: 900,
          lastPlayed: new Date('2026-03-15T20:00:00Z'),
        }),
      ],
      YEAR,
    )
    expect(stats.games[0]?.playedThisYear).toBe(true)
    expect(stats.games[0]?.minutesGained).toBe(0)
    expect(stats.gamesPlayedCount).toBe(1)
  })

  it('does not mark a game last played in a previous year as played this year', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 900 })],
      [
        game({
          appid: 1,
          playtimeMinutes: 900,
          lastPlayed: new Date('2025-12-31T23:00:00Z'),
        }),
      ],
      YEAR,
    )
    expect(stats.games[0]?.playedThisYear).toBe(false)
    expect(stats.gamesPlayedCount).toBe(0)
  })

  it('uses in-year two-week playtime as a floor for year minutes', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 3000 })],
      [game({ appid: 1, playtimeMinutes: 3010, recentMinutes: 200 })],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
    expect(stats.games[0]?.minutesThisYearFloor).toBe(200)
    expect(stats.games[0]?.playedThisYear).toBe(true)
    expect(stats.totalMinutesFloor).toBe(200)
  })

  it('prefers the snapshot delta once it exceeds the two-week floor', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 3000 })],
      [game({ appid: 1, playtimeMinutes: 3500, recentMinutes: 200 })],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
    expect(stats.games[0]?.minutesThisYearFloor).toBe(500)
    expect(stats.totalMinutesFloor).toBe(500)
  })

  it('ignores the two-week floor in early January when the window straddles the year boundary', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 3000 })],
      [game({ appid: 1, playtimeMinutes: 3000, recentMinutes: 200 })],
      YEAR,
      new Date('2026-01-05T12:00:00Z'),
    )
    expect(stats.games[0]?.minutesThisYearFloor).toBe(0)
    expect(stats.totalMinutesFloor).toBe(0)
  })

  it('marks a game as first played this year when two-week playtime covers its whole lifetime, even against a same-day baseline', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 19 })],
      [game({ appid: 1, playtimeMinutes: 19, recentMinutes: 19 })],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(true)
    expect(stats.firstPlayedCount).toBe(1)
  })

  it('does not infer first-played when lifetime playtime exceeds the two-week window', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 480 })],
      [game({ appid: 1, playtimeMinutes: 480, recentMinutes: 360 })],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
  })

  it('passes through two-week playtime and sums it', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 100 })],
      [
        game({ appid: 1, playtimeMinutes: 130, recentMinutes: 30 }),
        game({ appid: 2, playtimeMinutes: 45, recentMinutes: 45 }),
      ],
      YEAR,
    )
    expect(stats.games.find((g) => g.appid === 1)?.recentMinutes).toBe(30)
    expect(stats.totalRecentMinutes).toBe(75)
  })

  it('defaults missing two-week playtime to zero (stored snapshots have none)', () => {
    const stats = computeYearStats(
      [],
      [game({ appid: 1, playtimeMinutes: 10 })],
      YEAR,
    )
    expect(stats.games[0]?.recentMinutes).toBe(0)
    expect(stats.totalRecentMinutes).toBe(0)
  })

  it('aggregates totals across multiple games', () => {
    const lastPlayed = new Date('2026-07-01T12:00:00Z')
    const stats = computeYearStats(
      [
        game({ appid: 1, playtimeMinutes: 100 }),
        game({ appid: 2, playtimeMinutes: 0 }),
        game({ appid: 3, playtimeMinutes: 500 }),
      ],
      [
        game({ appid: 1, playtimeMinutes: 160, lastPlayed }),
        game({ appid: 2, playtimeMinutes: 90, lastPlayed }),
        game({ appid: 3, playtimeMinutes: 500 }),
        game({ appid: 4, playtimeMinutes: 30, lastPlayed }),
      ],
      YEAR,
    )
    expect(stats.totalMinutesGained).toBe(60 + 90 + 30)
    expect(stats.gamesPlayedCount).toBe(3)
    expect(stats.firstPlayedCount).toBe(2)
    expect(stats.games).toHaveLength(4)
  })

  it('uses current snapshot name when baseline and current names differ', () => {
    const stats = computeYearStats(
      [game({ appid: 1, name: 'Old Name', playtimeMinutes: 10 })],
      [game({ appid: 1, name: 'New Name', playtimeMinutes: 20 })],
      YEAR,
    )
    expect(stats.games[0]?.name).toBe('New Name')
  })
})

describe('applyFirstPlayedEvidence', () => {
  function statsWith(overrides: Partial<GameSnapshot> & { appid: number }) {
    return computeYearStats(
      [game({ appid: overrides.appid, playtimeMinutes: 500 })],
      [game({ playtimeMinutes: 500, ...overrides })],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
  }

  it('marks a game first-played when all achievement unlocks are in-year', () => {
    const stats = applyFirstPlayedEvidence(
      statsWith({ appid: 1, lastPlayed: new Date('2026-03-01') }),
      new Map([[1, [new Date('2026-02-01'), new Date('2026-03-01')]]]),
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(true)
    expect(stats.firstPlayedCount).toBe(1)
  })

  it('leaves a game unmarked when any unlock predates the year', () => {
    const stats = applyFirstPlayedEvidence(
      statsWith({ appid: 1, lastPlayed: new Date('2026-03-01') }),
      new Map([[1, [new Date('2024-11-20'), new Date('2026-03-01')]]]),
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
  })

  it('leaves a game unmarked when there is no achievement evidence', () => {
    const stats = applyFirstPlayedEvidence(
      statsWith({ appid: 1, lastPlayed: new Date('2026-03-01') }),
      new Map([[1, []]]),
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
  })

  it('never revokes an already-proven first-played flag', () => {
    const proven = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 0 })],
      [game({ appid: 1, playtimeMinutes: 45 })],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
    const stats = applyFirstPlayedEvidence(
      proven,
      new Map([[1, [new Date('2024-01-01')]]]),
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(true)
  })
})

describe('first-played games count their full lifetime toward the year', () => {
  it('raises the floor to lifetime playtime when evidence flips first-played', () => {
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 3048 })],
      [
        game({
          appid: 1,
          playtimeMinutes: 3048,
          recentMinutes: 2244,
          lastPlayed: new Date('2026-07-04'),
        }),
      ],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
    expect(base.games[0]?.minutesThisYearFloor).toBe(2244)

    const stats = applyFirstPlayedEvidence(
      base,
      new Map([[1, [new Date('2026-06-20'), new Date('2026-07-01')]]]),
      YEAR,
    )
    expect(stats.games[0]?.minutesThisYearFloor).toBe(3048)
    expect(stats.totalMinutesFloor).toBe(3048)
  })

  it('leaves the floor untouched when evidence does not flip the flag', () => {
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 1000 })],
      [
        game({
          appid: 1,
          playtimeMinutes: 1000,
          recentMinutes: 900,
          lastPlayed: new Date('2026-07-04'),
        }),
      ],
      YEAR,
      new Date('2026-07-16T12:00:00Z'),
    )
    const stats = applyFirstPlayedEvidence(
      base,
      new Map([[1, [new Date('2024-05-05'), new Date('2026-07-01')]]]),
      YEAR,
    )
    expect(stats.games[0]?.minutesThisYearFloor).toBe(900)
    expect(stats.totalMinutesFloor).toBe(900)
  })
})

describe('applyAcquiredDates', () => {
  const now = new Date('2026-07-16T12:00:00Z')

  it('flags a baseline-present game as new when its license was acquired in-year', () => {
    // Bought in February, tracking began in July: the baseline already
    // contains the game, so the diff heuristic alone would miss it.
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 300 })],
      [game({ appid: 1, playtimeMinutes: 300 })],
      YEAR,
      now,
    )
    expect(base.games[0]?.newToLibrary).toBe(false)

    const stats = applyAcquiredDates(base, new Map([[1, '2026-02-14']]), YEAR)
    expect(stats.games[0]?.newToLibrary).toBe(true)
  })

  it('unflags a baseline-absent game when its license predates the year', () => {
    // A game can drop out of a snapshot and reappear (family sharing quirks);
    // the acquired date proves it is not actually new.
    const base = computeYearStats(
      [],
      [game({ appid: 1, playtimeMinutes: 300 })],
      YEAR,
      now,
    )
    expect(base.games[0]?.newToLibrary).toBe(true)

    const stats = applyAcquiredDates(base, new Map([[1, '2019-11-02']]), YEAR)
    expect(stats.games[0]?.newToLibrary).toBe(false)
  })

  it('leaves games without an acquired date untouched', () => {
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 10 })],
      [game({ appid: 1, playtimeMinutes: 10 }), game({ appid: 2 })],
      YEAR,
      now,
    )
    const stats = applyAcquiredDates(base, new Map([[99, '2026-01-05']]), YEAR)
    expect(stats.games.find((g) => g.appid === 1)?.newToLibrary).toBe(false)
    expect(stats.games.find((g) => g.appid === 2)?.newToLibrary).toBe(true)
  })

  it('treats the year boundaries inclusively', () => {
    const base = computeYearStats(
      [
        game({ appid: 1, playtimeMinutes: 1 }),
        game({ appid: 2, playtimeMinutes: 1 }),
        game({ appid: 3, playtimeMinutes: 1 }),
        game({ appid: 4, playtimeMinutes: 1 }),
      ],
      [
        game({ appid: 1, playtimeMinutes: 1 }),
        game({ appid: 2, playtimeMinutes: 1 }),
        game({ appid: 3, playtimeMinutes: 1 }),
        game({ appid: 4, playtimeMinutes: 1 }),
      ],
      YEAR,
      now,
    )
    const stats = applyAcquiredDates(
      base,
      new Map([
        [1, '2025-12-31'],
        [2, '2026-01-01'],
        [3, '2026-12-31'],
        [4, '2027-01-01'],
      ]),
      YEAR,
    )
    expect(stats.games.map((g) => g.newToLibrary)).toEqual([
      false,
      true,
      true,
      false,
    ])
  })

  it('does not change playtime floors or totals', () => {
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 100 })],
      [game({ appid: 1, playtimeMinutes: 250 })],
      YEAR,
      now,
    )
    const stats = applyAcquiredDates(base, new Map([[1, '2026-03-03']]), YEAR)
    expect(stats.games[0]?.minutesThisYearFloor).toBe(150)
    expect(stats.totalMinutesFloor).toBe(base.totalMinutesFloor)
    expect(stats.totalMinutesGained).toBe(base.totalMinutesGained)
    expect(stats.gamesPlayedCount).toBe(base.gamesPlayedCount)
  })
})

describe('applyFirstPlayedTimes', () => {
  const now = new Date('2026-07-16T12:00:00Z')

  it('flags a game whose authoritative first-played date is in-year and counts its lifetime', () => {
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 8 })],
      [
        game({
          appid: 1,
          playtimeMinutes: 8,
          lastPlayed: new Date('2026-06-30'),
        }),
      ],
      YEAR,
      now,
    )
    expect(base.games[0]?.firstPlayedThisYear).toBe(false)

    const stats = applyFirstPlayedTimes(
      base,
      new Map([[1, new Date('2026-06-30T20:00:00Z')]]),
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(true)
    expect(stats.games[0]?.minutesThisYearFloor).toBe(8)
    expect(stats.games[0]?.playedThisYear).toBe(true)
    expect(stats.firstPlayedCount).toBe(1)
    expect(stats.totalMinutesFloor).toBe(8)
  })

  it('overrides a heuristic first-played flag when the authoritative date predates the year', () => {
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 19 })],
      [game({ appid: 1, playtimeMinutes: 19, recentMinutes: 19 })],
      YEAR,
      now,
    )
    expect(base.games[0]?.firstPlayedThisYear).toBe(true)

    const stats = applyFirstPlayedTimes(
      base,
      new Map([[1, new Date('2024-03-03')]]),
      YEAR,
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
    expect(stats.firstPlayedCount).toBe(0)
    expect(stats.games[0]?.minutesThisYearFloor).toBe(19)
  })

  it('leaves games without an authoritative record untouched', () => {
    const base = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 100 })],
      [game({ appid: 1, playtimeMinutes: 100 })],
      YEAR,
      now,
    )
    const stats = applyFirstPlayedTimes(base, new Map(), YEAR)
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
    expect(stats.games[0]?.playedThisYear).toBe(false)
  })
})
