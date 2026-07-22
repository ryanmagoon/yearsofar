# yearsofar

Steam Replay only covers last year. This shows the current one.

Live at [yearsofar.vercel.app](https://yearsofar.vercel.app).

## How

Steam's Web API only exposes lifetime playtime totals — no history. Year-to-date
hours are reconstructed from several sources, most authoritative first:

- Daily library snapshots (Vercel cron → Neon Postgres), diffed against the
  year's earliest snapshot.
- First-launch timestamps from `IPlayerService/ClientGetLastPlayedTimes` — a
  game first played this year counts its entire lifetime playtime.
- Achievement unlock dates, for games Steam has no first-launch record for.
- `playtime_2weeks`, once the rolling window sits fully inside the year.
- License acquisition dates (optional, scraped from the account's licenses
  page and loaded via `POST /api/admin/license-dates`), since the API exposes
  no purchase dates.

The headline number is a provable minimum. Deltas clamp at zero, duplicate
appids dedupe to the highest playtime, re-run snapshots never regress.

## Schema

Created automatically on first write:

```sql
CREATE TABLE snapshots (
  snapshot_date    date        NOT NULL,
  appid            integer     NOT NULL,
  name             text        NOT NULL,
  playtime_minutes integer     NOT NULL,
  last_played      timestamptz,
  PRIMARY KEY (snapshot_date, appid)
);

CREATE TABLE license_dates (
  appid    integer PRIMARY KEY,
  acquired date    NOT NULL
);
```

## Running it

| Variable        | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `STEAM_API_KEY` | [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) |
| `STEAM_ID`      | 64-bit SteamID                                                         |
| `DATABASE_URL`  | Postgres connection string (set by Vercel's Neon integration)          |
| `CRON_SECRET`   | Bearer token Vercel sends to the snapshot cron                         |
| `ADMIN_SECRET`  | Bearer token for the license-dates loader (optional)                   |

Deploy to Vercel, add the Neon integration, set the env vars, done — the cron
in `vercel.json` snapshots daily, and the first page visit bootstraps the
baseline. The profile's "Game details" privacy setting must be Public.

```sh
pnpm install
pnpm dev    # setup notice renders if env vars are missing
pnpm test
```
