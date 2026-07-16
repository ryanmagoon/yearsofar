import { NextResponse } from 'next/server'
import { writeSnapshot } from '@/lib/db'
import { todayUtc } from '@/lib/data'
import { getOwnedGames } from '@/lib/steam'

export const dynamic = 'force-dynamic'

/**
 * Daily cron target (see vercel.json). Fetches the current library state from
 * Steam and stores it as today's snapshot. Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const games = await getOwnedGames()
    const date = todayUtc()
    await writeSnapshot(date, games)
    return NextResponse.json({ ok: true, date, games: games.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
