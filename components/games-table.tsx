'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { formatDate, formatPlaytime } from '@/lib/format'
import type { GameRowJson } from '@/lib/serialize'

type SortKey = 'gained' | 'total' | 'name' | 'recent'
type Filter = 'all' | 'played' | 'first-played'

const SORT_LABELS: Record<SortKey, string> = {
  gained: 'Hours gained this year',
  total: 'Total hours',
  name: 'Name',
  recent: 'Recently played',
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All games',
  played: 'Played this year',
  'first-played': 'First played this year',
}

function capsuleUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`
}

function sortGames(games: GameRowJson[], sort: SortKey): GameRowJson[] {
  const sorted = [...games]
  switch (sort) {
    case 'gained':
      return sorted.sort((a, b) => b.minutesGained - a.minutesGained)
    case 'total':
      return sorted.sort((a, b) => b.totalMinutes - a.totalMinutes)
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'recent':
      return sorted.sort((a, b) =>
        (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? ''),
      )
  }
}

export function GamesTable({ games }: { games: GameRowJson[] }) {
  const [sort, setSort] = useState<SortKey>('gained')
  const [filter, setFilter] = useState<Filter>('played')
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    let rows = games
    if (filter === 'played') rows = rows.filter((g) => g.playedThisYear)
    if (filter === 'first-played')
      rows = rows.filter((g) => g.firstPlayedThisYear)
    const query = search.trim().toLowerCase()
    if (query) rows = rows.filter((g) => g.name.toLowerCase().includes(query))
    return sortGames(rows, sort)
  }, [games, sort, filter, search])

  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-[color,background-color,border-color,transform] duration-150 ease-(--ease-snappy) active:scale-[0.97] ${
                filter === key
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line text-muted hover:border-faint hover:text-foreground'
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games"
            className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none sm:w-44"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort games"
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-muted focus:border-accent focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          No games match.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {visible.map((game) => (
            <li
              key={game.appid}
              className="flex items-center gap-4 px-4 py-3 sm:gap-5"
            >
              <Image
                src={capsuleUrl(game.appid)}
                alt=""
                width={92}
                height={35}
                unoptimized
                className="hidden h-[35px] w-[92px] shrink-0 rounded-sm border border-line object-cover sm:block"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{game.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {game.lastPlayed ? (
                    <span>Last played {formatDate(game.lastPlayed)}</span>
                  ) : (
                    <span className="text-faint">No last-played record</span>
                  )}
                  {game.firstPlayedThisYear && (
                    <span className="rounded-full bg-accent-soft px-2 py-px text-accent">
                      {game.newToLibrary
                        ? 'New this year'
                        : 'First played this year'}
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right font-mono text-sm">
                {game.minutesGained > 0 ? (
                  <p className="text-accent">
                    +{formatPlaytime(game.minutesGained)}
                  </p>
                ) : (
                  <p className="text-faint">—</p>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  {formatPlaytime(game.totalMinutes)} total
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-right text-xs text-faint">
        {visible.length} of {games.length} games
      </p>
    </section>
  )
}
