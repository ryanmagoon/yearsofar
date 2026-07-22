import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { getYearSoFar } from '@/lib/data'
import { formatPlaytime } from '@/lib/format'
import { getPlayerSummary } from '@/lib/steam'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Steam year so far'

async function loadFont(file: string): Promise<Buffer> {
  return readFile(
    path.join(process.cwd(), 'node_modules/geist/dist/fonts/geist-mono', file),
  )
}

export default async function OpengraphImage() {
  const [mono, monoBold] = await Promise.all([
    loadFont('GeistMono-Regular.ttf'),
    loadFont('GeistMono-Bold.ttf'),
  ])

  let hours = null
  let gamesPlayed = null
  let topGame = null
  let year = new Date().getUTCFullYear()
  let playerName = null
  try {
    const [data, player] = await Promise.all([
      getYearSoFar(),
      getPlayerSummary(),
    ])
    year = data.year
    hours = formatPlaytime(data.stats.totalMinutesFloor)
    gamesPlayed = data.stats.gamesPlayedCount
    topGame = [...data.stats.games].sort(
      (a, b) => b.minutesThisYearFloor - a.minutesThisYearFloor,
    )[0]
    playerName = player?.name ?? null
  } catch {
    // Render the brand-only card if live data is unavailable.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#131210',
          color: '#ece8e1',
          padding: 72,
          fontFamily: 'Geist Mono',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 28,
            color: '#9b958a',
            letterSpacing: 6,
          }}
        >
          <span>STEAM · YEAR SO FAR</span>
          {playerName && <span>{playerName}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 190, fontWeight: 700, lineHeight: 1 }}>
            {year}
          </div>
          {hours && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 24,
                marginTop: 28,
              }}
            >
              <span style={{ fontSize: 76, fontWeight: 700, color: '#6cc5a1' }}>
                {hours}
              </span>
              <span style={{ fontSize: 34, color: '#9b958a' }}>
                played this year
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 30,
            color: '#9b958a',
          }}
        >
          <span>
            {gamesPlayed !== null ? `${gamesPlayed} games played` : 'yearsofar.vercel.app'}
          </span>
          {topGame && topGame.minutesThisYearFloor > 0 && (
            <span style={{ color: '#ece8e1' }}>{`most played: ${topGame.name}`}</span>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Geist Mono', data: mono, weight: 400 },
        { name: 'Geist Mono', data: monoBold, weight: 700 },
      ],
    },
  )
}
