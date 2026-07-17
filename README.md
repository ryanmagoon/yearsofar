# Steam Year So Far

A live "year in review, so far" for a Steam account. Steam Replay only covers
the _previous_ year — this app shows what you've played in the _current_
calendar year, updated continuously from the Steam Web API.

## How it works

- A daily [Vercel cron](https://vercel.com/docs/cron-jobs) hits
  `/api/cron/snapshot`, which fetches your full library (with lifetime playtime
  per game) from Steam and stores it as a dated snapshot in Postgres (Neon).
- The dashboard fetches your library live from Steam on each visit and diffs it
  against the **earliest snapshot of the current year** (the baseline).
  The difference per game is "hours played this year."
- If the baseline was taken after early January (e.g. you deployed the app in
  July), the UI labels the numbers as partial-year tracking. Next January 1st
  onward the baseline will naturally be a Jan 1 snapshot and the numbers become
  true year-to-date.

### Edge cases handled

- **Games bought this year**: absent from the baseline → flagged "New this
  year", full playtime counts as gained.
- **Games first played this year**: owned at baseline with 0 minutes → flagged
  "First played this year".
- **Missing last-played dates**: shown as "No last-played record".
- **Shrinking totals** (family sharing quirks): deltas are clamped to ≥ 0, and
  snapshot re-runs keep the higher playtime per (day, game).
- **Duplicate appids** in a snapshot: deduplicated, keeping the highest
  playtime.

## Database schema

Two tables, created automatically on first write:

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

`license_dates` holds per-game license acquisition dates (the Steam Web API
doesn't expose purchase dates, so these are scraped once from the account's
[licenses page](https://store.steampowered.com/account/licenses/) and loaded
via `POST /api/admin/license-dates` with `Authorization: Bearer $ADMIN_SECRET`
and body `{ "dates": [{ "appid": 440, "acquired": "2011-06-24" }] }`). When
present, they make "new to library" mean _acquired this calendar year_ instead
of _appeared after the baseline snapshot_.

## Environment variables

| Variable        | What it is                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `STEAM_API_KEY` | Steam Web API key from <https://steamcommunity.com/dev/apikey>                                    |
| `STEAM_ID`      | Your 64-bit SteamID (e.g. from <https://steamid.io>)                                              |
| `DATABASE_URL`  | Postgres connection string (the Neon integration on Vercel sets this automatically)               |
| `CRON_SECRET`   | Any random string; Vercel sends it as a bearer token to the cron route so outsiders can't spam it |
| `ADMIN_SECRET`  | Any random string; bearer token for the one-off license-dates loader route (optional otherwise)   |

Your Steam profile's **Game details** privacy setting must be **Public** for
the API to return playtime.

## Local development

```sh
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev
```

Without env vars the app renders a setup notice instead of crashing.

```sh
pnpm test        # vitest
pnpm lint
pnpm typecheck
pnpm format
```

## Deploying

1. Deploy the repo to [Vercel](https://vercel.com).
2. Add the **Neon** integration (Storage → Create Database → Neon) — this sets
   `DATABASE_URL`.
3. Set `STEAM_API_KEY`, `STEAM_ID`, and `CRON_SECRET` in Project → Settings →
   Environment Variables.
4. Redeploy. The cron in `vercel.json` (daily at 06:17 UTC) starts taking
   snapshots; the first page visit also takes an initial snapshot so the
   baseline exists immediately.
