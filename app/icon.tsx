import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  const yearSuffix = String(new Date().getUTCFullYear()).slice(2)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#131210',
          color: '#6cc5a1',
          fontSize: 18,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        {yearSuffix}
      </div>
    ),
    size,
  )
}
