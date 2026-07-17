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

/** Steam CDN capsule image for a game (no API key needed). */
export function capsuleImageUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`
}
