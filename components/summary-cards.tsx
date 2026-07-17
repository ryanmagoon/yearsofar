'use client'

import Image from 'next/image'
import { useState } from 'react'

export interface SummaryItem {
  label: string
  value: string
  detail?: string
  /** When set, the game's art renders as a blurred backdrop behind the tile. */
  artAppid?: number
}

/** Higher-res header art reads better as a backdrop than the tiny capsule. */
function backdropSources(appid: number): string[] {
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`,
  ]
}

/** Blurred, theme-dimmed game art used as a tile backdrop. */
function TileArt({ appid }: { appid: number }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const sources = backdropSources(appid)
  if (sourceIndex >= sources.length) return null

  return (
    <>
      <Image
        src={sources[sourceIndex]}
        alt=""
        fill
        unoptimized
        onError={() => setSourceIndex((index) => index + 1)}
        onLoad={() => setLoaded(true)}
        className={`scale-110 object-cover blur-[2px] transition-opacity duration-500 ease-(--ease-snappy) ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-surface/95 via-surface/75 to-surface/35"
      />
    </>
  )
}

export function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className="rise-in relative overflow-hidden bg-surface p-4"
          style={{ animationDelay: `${60 + index * 40}ms` }}
        >
          {item.artAppid !== undefined && <TileArt appid={item.artAppid} />}
          <div className="relative">
            <p className="text-xs text-muted">{item.label}</p>
            {item.artAppid !== undefined ? (
              <p
                className="mt-2 line-clamp-2 font-display text-base leading-snug"
                title={item.value}
              >
                {item.value}
              </p>
            ) : (
              <p
                className="mt-2 truncate font-display text-xl"
                title={item.value}
              >
                {item.value}
              </p>
            )}
            {item.detail && (
              <p className="mt-0.5 font-mono text-xs text-accent">
                {item.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
