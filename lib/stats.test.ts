import { describe, expect, it } from 'vitest'
import { computeYearStats } from './stats'
import type { GameSnapshot } from './types'

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
    const stats = computeYearStats([], [])
    expect(stats.games).toEqual([])
    expect(stats.totalMinutesGained).toBe(0)
    expect(stats.gamesPlayedCount).toBe(0)
    expect(stats.firstPlayedCount).toBe(0)
  })

  it('clamps negative deltas to zero (Steam totals can shrink, e.g. family sharing)', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 500 })],
      [game({ appid: 1, playtimeMinutes: 400 })],
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
    )
    expect(stats.games).toHaveLength(1)
    expect(stats.games[0]?.minutesGained).toBe(60)
  })

  it('keeps zero-playtime games in the list but never counts them as played', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 0 })],
      [game({ appid: 1, playtimeMinutes: 0 })],
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
    )
    const newGame = stats.games.find((g) => g.appid === 2)
    expect(newGame?.newToLibrary).toBe(true)
    expect(newGame?.minutesGained).toBe(300)
    expect(newGame?.firstPlayedThisYear).toBe(true)
    expect(newGame?.playedThisYear).toBe(true)
  })

  it('marks a new-to-library game with zero playtime as unplayed, not first-played', () => {
    const stats = computeYearStats([], [game({ appid: 2, playtimeMinutes: 0 })])
    const newGame = stats.games[0]
    expect(newGame?.newToLibrary).toBe(true)
    expect(newGame?.firstPlayedThisYear).toBe(false)
    expect(newGame?.playedThisYear).toBe(false)
  })

  it('marks a game owned at baseline with zero playtime, played since, as first played this year', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 0 })],
      [game({ appid: 1, playtimeMinutes: 45 })],
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(true)
    expect(stats.games[0]?.newToLibrary).toBe(false)
    expect(stats.games[0]?.minutesGained).toBe(45)
  })

  it('does not mark a game with prior playtime as first played this year', () => {
    const stats = computeYearStats(
      [game({ appid: 1, playtimeMinutes: 200 })],
      [game({ appid: 1, playtimeMinutes: 260 })],
    )
    expect(stats.games[0]?.firstPlayedThisYear).toBe(false)
    expect(stats.games[0]?.playedThisYear).toBe(true)
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
    )
    expect(stats.games[0]?.name).toBe('New Name')
  })
})
