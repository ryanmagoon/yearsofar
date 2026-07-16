import { neon } from '@neondatabase/serverless'
import type { GameSnapshot } from './types'

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'Missing DATABASE_URL environment variable. See README for setup.',
    )
  }
  return neon(url)
}

/**
 * Creates the snapshots table if it doesn't exist. Idempotent and cheap, so
 * it's safe to call before every write (avoids a separate migration step).
 */
export async function ensureSchema(): Promise<void> {
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      snapshot_date date NOT NULL,
      appid integer NOT NULL,
      name text NOT NULL,
      playtime_minutes integer NOT NULL,
      last_played timestamptz,
      PRIMARY KEY (snapshot_date, appid)
    )
  `
}

/**
 * Writes one day's snapshot of the whole library. Upserts on
 * (snapshot_date, appid), so running twice in a day just refreshes the rows —
 * keeping the higher playtime so a partial re-run can't regress the data.
 */
export async function writeSnapshot(
  date: string,
  games: GameSnapshot[],
): Promise<void> {
  if (games.length === 0) return
  await ensureSchema()
  const sql = getSql()
  await sql`
    INSERT INTO snapshots (snapshot_date, appid, name, playtime_minutes, last_played)
    SELECT ${date}::date, appid, name, playtime_minutes, last_played
    FROM unnest(
      ${games.map((g) => g.appid)}::integer[],
      ${games.map((g) => g.name)}::text[],
      ${games.map((g) => g.playtimeMinutes)}::integer[],
      ${games.map((g) => g.lastPlayed?.toISOString() ?? null)}::timestamptz[]
    ) AS t(appid, name, playtime_minutes, last_played)
    ON CONFLICT (snapshot_date, appid) DO UPDATE SET
      name = EXCLUDED.name,
      playtime_minutes = GREATEST(snapshots.playtime_minutes, EXCLUDED.playtime_minutes),
      last_played = COALESCE(EXCLUDED.last_played, snapshots.last_played)
  `
}

interface SnapshotRow {
  snapshot_date: string
  appid: number
  name: string
  playtime_minutes: number
  last_played: string | null
}

/**
 * Returns the earliest snapshot taken within the given calendar year — the
 * baseline that year-to-date deltas are computed against — or null if no
 * snapshot exists for that year yet.
 */
export async function getBaselineSnapshot(
  year: number,
): Promise<{ date: string; games: GameSnapshot[] } | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT snapshot_date::text, appid, name, playtime_minutes, last_played
    FROM snapshots
    WHERE snapshot_date = (
      SELECT MIN(snapshot_date) FROM snapshots
      WHERE snapshot_date >= make_date(${year}, 1, 1)
        AND snapshot_date < make_date(${year + 1}, 1, 1)
    )
  `) as SnapshotRow[]

  if (rows.length === 0) return null
  return {
    date: rows[0].snapshot_date,
    games: rows.map((row) => ({
      appid: row.appid,
      name: row.name,
      playtimeMinutes: row.playtime_minutes,
      lastPlayed: row.last_played ? new Date(row.last_played) : null,
    })),
  }
}
