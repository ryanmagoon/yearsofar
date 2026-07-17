import { NextResponse } from 'next/server'
import { upsertLicenseDates } from '@/lib/db'
import { parseLicenseDatesPayload } from '@/lib/license-dates'

export const dynamic = 'force-dynamic'

/**
 * One-off admin loader for license acquisition dates (scraped from the Steam
 * account's licenses page). Requires `Authorization: Bearer ${ADMIN_SECRET}`.
 * Body: `{ dates: [{ appid, acquired: "yyyy-mm-dd" }, ...] }`. Upserts keep
 * the earliest date per appid, so re-posting is safe.
 */
export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET is not configured' },
      { status: 500 },
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Body is not valid JSON' },
      { status: 400 },
    )
  }

  const parsed = parseLicenseDatesPayload(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    await upsertLicenseDates(parsed.dates)
    return NextResponse.json({ ok: true, count: parsed.dates.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
