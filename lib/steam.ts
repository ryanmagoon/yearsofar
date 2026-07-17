import type { GameSnapshot } from './types'

/** Shape of a game entry from IPlayerService/GetOwnedGames. */
interface SteamOwnedGame {
  appid: number
  name?: string
  playtime_forever: number
  /** Minutes played in the last two weeks; omitted by Steam when zero. */
  playtime_2weeks?: number
  /** Unix seconds; 0 or missing means Steam has no last-played record. */
  rtime_last_played?: number
}

interface SteamOwnedGamesResponse {
  response: {
    game_count?: number
    games?: SteamOwnedGame[]
  }
}

/** Converts a raw GetOwnedGames entry into our snapshot shape. */
export function mapOwnedGame(game: SteamOwnedGame): GameSnapshot {
  return {
    appid: game.appid,
    name: game.name ?? `App ${game.appid}`,
    playtimeMinutes: game.playtime_forever,
    lastPlayed:
      game.rtime_last_played && game.rtime_last_played > 0
        ? new Date(game.rtime_last_played * 1000)
        : null,
    recentMinutes: game.playtime_2weeks ?? 0,
  }
}

/**
 * Fetches the full owned-games list (with playtime) for a Steam account.
 * Requires the profile's "Game details" privacy setting to be Public.
 */
export async function getOwnedGames(): Promise<GameSnapshot[]> {
  const apiKey = process.env.STEAM_API_KEY
  const steamId = process.env.STEAM_ID
  if (!apiKey || !steamId) {
    throw new Error(
      'Missing STEAM_API_KEY or STEAM_ID environment variable. See README for setup.',
    )
  }

  const url = new URL(
    'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/',
  )
  url.searchParams.set('key', apiKey)
  url.searchParams.set('steamid', steamId)
  url.searchParams.set('include_appinfo', '1')
  url.searchParams.set('include_played_free_games', '1')

  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) {
    throw new Error(
      `Steam API returned ${res.status} ${res.statusText}. ` +
        'Check that STEAM_API_KEY is valid and STEAM_ID is a 64-bit SteamID.',
    )
  }

  const data = (await res.json()) as SteamOwnedGamesResponse
  if (!data.response?.games) {
    throw new Error(
      'Steam returned no games. This usually means the profile\'s "Game details" ' +
        'privacy setting is not Public, or the SteamID is wrong.',
    )
  }

  return data.response.games.map(mapOwnedGame)
}

interface SteamLastPlayedTimesEntry {
  appid: number
  /** Unix seconds; 0 or missing when Steam has no first-launch record. */
  first_playtime?: number
}

interface SteamLastPlayedTimesResponse {
  response?: {
    games?: SteamLastPlayedTimesEntry[]
  }
}

/** Extracts per-appid first-launch dates from a ClientGetLastPlayedTimes response. */
export function mapFirstPlayedTimes(
  data: SteamLastPlayedTimesResponse,
): Map<number, Date> {
  const byAppid = new Map<number, Date>()
  for (const entry of data.response?.games ?? []) {
    if (entry.first_playtime !== undefined && entry.first_playtime > 0) {
      byAppid.set(entry.appid, new Date(entry.first_playtime * 1000))
    }
  }
  return byAppid
}

/**
 * Fetches Steam's authoritative first-launch timestamps for every game on
 * the account that owns STEAM_API_KEY (the endpoint takes no steamid — it is
 * scoped to the key's own account). Returns an empty map on any failure so
 * the heuristic fallbacks still apply.
 */
export async function getFirstPlayedTimes(): Promise<Map<number, Date>> {
  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) return new Map()

  const url = new URL(
    'https://api.steampowered.com/IPlayerService/ClientGetLastPlayedTimes/v1/',
  )
  url.searchParams.set('key', apiKey)

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return new Map()
    return mapFirstPlayedTimes(
      (await res.json()) as SteamLastPlayedTimesResponse,
    )
  } catch {
    return new Map()
  }
}

interface SteamAchievement {
  achieved: number
  /** Unix seconds; 0 when the achievement is locked. */
  unlocktime?: number
}

interface SteamPlayerAchievementsResponse {
  playerstats?: {
    success?: boolean
    achievements?: SteamAchievement[]
  }
}

/** Extracts unlock dates for earned achievements from a GetPlayerAchievements response. */
export function mapAchievementUnlocks(
  data: SteamPlayerAchievementsResponse,
): Date[] {
  if (!data.playerstats?.success || !data.playerstats.achievements) return []
  return data.playerstats.achievements.flatMap((achievement) =>
    achievement.achieved === 1 &&
    achievement.unlocktime !== undefined &&
    achievement.unlocktime > 0
      ? [new Date(achievement.unlocktime * 1000)]
      : [],
  )
}

/**
 * Fetches achievement unlock dates for one game. Returns [] for games without
 * achievements, private stats, or any API failure — achievement evidence is
 * best-effort and must never break the page.
 */
export async function getAchievementUnlocks(appid: number): Promise<Date[]> {
  const apiKey = process.env.STEAM_API_KEY
  const steamId = process.env.STEAM_ID
  if (!apiKey || !steamId) return []

  const url = new URL(
    'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/',
  )
  url.searchParams.set('key', apiKey)
  url.searchParams.set('steamid', steamId)
  url.searchParams.set('appid', String(appid))

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    return mapAchievementUnlocks(
      (await res.json()) as SteamPlayerAchievementsResponse,
    )
  } catch {
    return []
  }
}
