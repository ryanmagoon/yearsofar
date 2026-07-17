import Image from 'next/image'
import { GamesTable } from '@/components/games-table'
import { SummaryCards, type SummaryItem } from '@/components/summary-cards'
import { ThemeToggle } from '@/components/theme-toggle'
import { getYearSoFar } from '@/lib/data'
import { formatDate, formatPlaytime } from '@/lib/format'
import { toGameRowJson } from '@/lib/serialize'
import { getPlayerSummary } from '@/lib/steam'

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
  let player
  try {
    ;[data, player] = await Promise.all([getYearSoFar(), getPlayerSummary()])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return <SetupNotice message={message} />
  }

  const { stats, year, baselineDate, baselineIsPartial, hasAcquiredDates } =
    data
  const rows = stats.games.map(toGameRowJson)
  const topGame = [...stats.games].sort(
    (a, b) => b.minutesThisYearFloor - a.minutesThisYearFloor,
  )[0]
  const topGamePlaytime =
    topGame && topGame.minutesThisYearFloor > 0
      ? `${
          !topGame.firstPlayedThisYear &&
          topGame.minutesGained < topGame.minutesThisYearFloor
            ? '≥'
            : '+'
        }${formatPlaytime(topGame.minutesThisYearFloor)}`
      : undefined
  const totalIsFloorOnly = stats.totalMinutesGained < stats.totalMinutesFloor
  const lastPlayedGame = [...stats.games]
    .filter((g) => g.lastPlayed !== null)
    .sort(
      (a, b) => (b.lastPlayed?.getTime() ?? 0) - (a.lastPlayed?.getTime() ?? 0),
    )[0]
  const newToLibraryCount = stats.games.filter(
    (g) => g.newToLibrary && g.playedThisYear,
  ).length

  const summary: SummaryItem[] = [
    { label: 'Games played', value: String(stats.gamesPlayedCount) },
    { label: 'First played this year', value: String(stats.firstPlayedCount) },
    {
      // With license dates loaded, "new" means acquired this calendar year;
      // otherwise it can only mean "appeared after the baseline snapshot".
      label: hasAcquiredDates
        ? `New to library in ${year}`
        : `New since ${formatDate(baselineDate)}`,
      value: String(newToLibraryCount),
    },
    {
      label: 'Most played',
      value: topGamePlaytime && topGame ? topGame.name : '—',
      detail: topGamePlaytime,
      artAppid: topGamePlaytime ? topGame?.appid : undefined,
    },
    {
      label: 'Last played',
      value: lastPlayedGame?.name ?? '—',
      detail: lastPlayedGame?.lastPlayed
        ? formatDate(lastPlayedGame.lastPlayed.toISOString())
        : undefined,
      artAppid: lastPlayedGame?.appid,
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
        {player && (
          <div className="mb-5 flex items-center gap-3">
            {player.avatarUrl && (
              <Image
                src={player.avatarUrl}
                alt=""
                width={44}
                height={44}
                unoptimized
                className="rounded-full border border-line"
              />
            )}
            <p className="text-sm font-medium">
              {player.name}
              <span className="block text-xs font-normal text-muted">
                year in games
              </span>
            </p>
          </div>
        )}
        <h1 className="font-display text-[clamp(3.5rem,12vw,7rem)] leading-none tracking-tight">
          {year}
        </h1>
        <p className="mt-6 font-display text-4xl text-accent sm:text-5xl">
          {formatPlaytime(stats.totalMinutesFloor)}
          <span className="ml-3 font-sans text-base text-muted">
            played this year
          </span>
        </p>
        {stats.totalRecentMinutes > 0 && (
          <p className="mt-2 font-mono text-sm text-muted">
            {formatPlaytime(stats.totalRecentMinutes)} in the past two weeks
          </p>
        )}
        <p className="mt-3 text-xs text-faint">
          {totalIsFloorOnly && baselineIsPartial
            ? `Live from Steam · tracking since ${formatDate(baselineDate)} · hours shown are a minimum`
            : `Live from Steam · tracking since ${formatDate(baselineDate)}`}
        </p>
      </section>

      <div className="mt-12">
        <SummaryCards items={summary} />
      </div>

      <div className="rise-in mt-14 [animation-delay:180ms]">
        <GamesTable games={rows} />
      </div>

      <footer className="mt-16 border-t border-line pt-5 text-xs text-faint">
        Playtime totals come from the Steam Web API. Yearly gains are measured
        against daily snapshots taken by this site. First-played detection also
        uses achievement unlock dates, so games without achievements may be
        missed.
      </footer>
    </main>
  )
}
