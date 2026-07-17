import { GamesTable } from '@/components/games-table'
import { ThemeToggle } from '@/components/theme-toggle'
import { getYearSoFar } from '@/lib/data'
import { formatDate, formatPlaytime } from '@/lib/format'
import { toGameRowJson } from '@/lib/serialize'

// Depends on live Steam data + the database, so never prerender at build time.
export const dynamic = 'force-dynamic'

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl">Steam Year So Far</h1>
      <div className="mt-6 rounded-lg border border-line bg-surface p-5">
        <p className="text-sm font-medium">Not ready yet</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
        <p className="mt-4 text-xs text-faint">
          Set the environment variables described in the README, then reload.
        </p>
      </div>
    </main>
  )
}

export default async function Home() {
  let data
  try {
    data = await getYearSoFar()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return <SetupNotice message={message} />
  }

  const { stats, year, baselineDate, baselineIsPartial } = data
  const rows = stats.games.map(toGameRowJson)
  // Fall back to two-week playtime before snapshot deltas have accumulated.
  const topGame = [...stats.games].sort(
    (a, b) =>
      b.minutesGained - a.minutesGained || b.recentMinutes - a.recentMinutes,
  )[0]
  const topGamePlaytime =
    topGame &&
    (topGame.minutesGained > 0
      ? `+${formatPlaytime(topGame.minutesGained)}`
      : topGame.recentMinutes > 0
        ? `${formatPlaytime(topGame.recentMinutes)} past two weeks`
        : undefined)
  const lastPlayedGame = [...stats.games]
    .filter((g) => g.lastPlayed !== null)
    .sort(
      (a, b) => (b.lastPlayed?.getTime() ?? 0) - (a.lastPlayed?.getTime() ?? 0),
    )[0]
  const newToLibraryCount = stats.games.filter(
    (g) => g.newToLibrary && g.playedThisYear,
  ).length

  const summary = [
    { label: 'Games played', value: String(stats.gamesPlayedCount) },
    { label: 'First played this year', value: String(stats.firstPlayedCount) },
    { label: 'New to library & played', value: String(newToLibraryCount) },
    {
      label: 'Most played',
      value: topGamePlaytime && topGame ? topGame.name : '—',
      detail: topGamePlaytime,
    },
    {
      label: 'Last played',
      value: lastPlayedGame?.name ?? '—',
      detail: lastPlayedGame?.lastPlayed
        ? formatDate(lastPlayedGame.lastPlayed.toISOString())
        : undefined,
    },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Steam · Year So Far
        </p>
        <ThemeToggle />
      </header>

      <section className="rise-in mt-12 sm:mt-16">
        <h1 className="font-display text-[clamp(3.5rem,12vw,7rem)] leading-none tracking-tight">
          {year}
        </h1>
        <p className="mt-6 font-display text-4xl text-accent sm:text-5xl">
          {formatPlaytime(stats.totalMinutesGained)}
          <span className="ml-3 font-sans text-base text-muted">
            tracked this year
          </span>
        </p>
        {stats.totalRecentMinutes > 0 && (
          <p className="mt-2 font-mono text-sm text-muted">
            {formatPlaytime(stats.totalRecentMinutes)} in the past two weeks
          </p>
        )}
        <p className="mt-3 text-sm text-muted">
          Hours are measured against a snapshot from {formatDate(baselineDate)}.
          {baselineIsPartial && (
            <span className="text-foreground">
              {` Tracking started mid-year, so earlier ${year} hours aren't counted — but every game you touched in ${year} still shows as played.`}
            </span>
          )}
        </p>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
        {summary.map((item, index) => (
          <div
            key={item.label}
            className="rise-in bg-surface p-4"
            style={{ animationDelay: `${60 + index * 40}ms` }}
          >
            <p className="text-xs text-muted">{item.label}</p>
            <p
              className="mt-2 truncate font-display text-xl"
              title={item.value}
            >
              {item.value}
            </p>
            {item.detail && (
              <p className="mt-0.5 font-mono text-xs text-accent">
                {item.detail}
              </p>
            )}
          </div>
        ))}
      </section>

      <div className="rise-in mt-14 [animation-delay:180ms]">
        <GamesTable games={rows} />
      </div>

      <footer className="mt-16 border-t border-line pt-5 text-xs text-faint">
        Playtime totals come from the Steam Web API. Yearly gains are measured
        against daily snapshots taken by this site.
      </footer>
    </main>
  )
}
