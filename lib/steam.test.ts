import { describe, expect, it } from 'vitest'
import { mapAchievementUnlocks, mapOwnedGame } from './steam'

describe('mapOwnedGame', () => {
  it('treats rtime_last_played of 0 as no last-played record', () => {
    const mapped = mapOwnedGame({
      appid: 10,
      name: 'CS',
      playtime_forever: 5,
      rtime_last_played: 0,
    })
    expect(mapped.lastPlayed).toBeNull()
  })

  it('treats missing rtime_last_played as no last-played record', () => {
    const mapped = mapOwnedGame({ appid: 10, name: 'CS', playtime_forever: 5 })
    expect(mapped.lastPlayed).toBeNull()
  })

  it('converts unix seconds to a Date', () => {
    const mapped = mapOwnedGame({
      appid: 10,
      name: 'CS',
      playtime_forever: 5,
      rtime_last_played: 1_751_500_000,
    })
    expect(mapped.lastPlayed?.getTime()).toBe(1_751_500_000_000)
  })

  it('falls back to an appid-based name when Steam omits the name', () => {
    const mapped = mapOwnedGame({ appid: 42, playtime_forever: 5 })
    expect(mapped.name).toBe('App 42')
  })
})

describe('mapAchievementUnlocks', () => {
  it('returns unlock dates only for earned achievements with real timestamps', () => {
    const unlocks = mapAchievementUnlocks({
      playerstats: {
        success: true,
        achievements: [
          { achieved: 1, unlocktime: 1_751_500_000 },
          { achieved: 0, unlocktime: 0 },
          { achieved: 1, unlocktime: 0 },
        ],
      },
    })
    expect(unlocks).toHaveLength(1)
    expect(unlocks[0]?.getTime()).toBe(1_751_500_000_000)
  })

  it('returns empty for unsuccessful responses (game without achievements)', () => {
    expect(mapAchievementUnlocks({ playerstats: { success: false } })).toEqual(
      [],
    )
    expect(mapAchievementUnlocks({})).toEqual([])
  })
})
