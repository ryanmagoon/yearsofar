import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GameRowJson } from '@/lib/serialize'
import { GamesTable } from './games-table'

function game(
  overrides: Partial<GameRowJson> & { appid: number },
): GameRowJson {
  return {
    name: `Game ${overrides.appid}`,
    totalMinutes: 0,
    minutesGained: 0,
    lastPlayed: null,
    firstPlayedThisYear: false,
    newToLibrary: false,
    playedThisYear: true,
    recentMinutes: 0,
    minutesThisYearFloor: 0,
    ...overrides,
  }
}

/** Game names in the order they appear in the rendered list. */
function renderedOrder(html: string): string[] {
  return [
    ...html.matchAll(/<p class="truncate text-sm font-medium">([^<]+)<\/p>/g),
  ].map((match) => match[1])
}

describe('GamesTable default view', () => {
  const games = [
    game({
      appid: 1,
      name: 'Most hours',
      minutesThisYearFloor: 600,
      lastPlayed: '2026-03-01T00:00:00.000Z',
    }),
    game({
      appid: 2,
      name: 'Played yesterday',
      minutesThisYearFloor: 30,
      lastPlayed: '2026-10-08T00:00:00.000Z',
    }),
    game({
      appid: 3,
      name: 'Never played',
      lastPlayed: null,
      playedThisYear: false,
    }),
    game({
      appid: 4,
      name: 'Played last week',
      minutesThisYearFloor: 90,
      lastPlayed: '2026-10-01T00:00:00.000Z',
    }),
  ]

  it('opens sorted by most recently played, not by hours gained', () => {
    const html = renderToString(<GamesTable games={games} />)
    expect(renderedOrder(html)).toEqual([
      'Played yesterday',
      'Played last week',
      'Most hours',
    ])
  })

  it('preselects "Recently played" in the sort dropdown', () => {
    const html = renderToString(<GamesTable games={games} />)
    expect(html).toMatch(
      /<option value="recent" selected="">Recently played<\/option>/,
    )
  })
})
