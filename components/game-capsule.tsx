'use client'

import Image from 'next/image'
import { useState } from 'react'

/**
 * Steam hosts artwork under two CDN roots depending on the game's age, and
 * some titles have no capsule at all — try each source, then fall back to a
 * typographic placeholder instead of a broken-image icon.
 */
function artSources(appid: number): string[] {
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`,
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/capsule_231x87.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
  ]
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.replace(/[^0-9A-Za-z]/g, '')[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function GameCapsule({ appid, name }: { appid: number; name: string }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const sources = artSources(appid)

  return (
    <div
      aria-hidden
      className="hidden h-[35px] w-[92px] shrink-0 overflow-hidden rounded-sm border border-line bg-line/40 sm:block"
    >
      {sourceIndex < sources.length ? (
        <Image
          src={sources[sourceIndex]}
          alt=""
          width={92}
          height={35}
          unoptimized
          onError={() => setSourceIndex((index) => index + 1)}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-[opacity,filter] duration-300 ease-(--ease-snappy) ${
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-[6px]'
          }`}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-xs text-faint">
          {initials(name)}
        </span>
      )}
    </div>
  )
}
