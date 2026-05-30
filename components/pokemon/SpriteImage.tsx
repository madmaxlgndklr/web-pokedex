'use client'
import Image from 'next/image'
import { useState } from 'react'
import { shinySpriteUrl } from '@/lib/constants'
import { getSpriteUrl, getFallbackUrl, type SpriteMode } from '@/lib/spriteMode'
import { useSetting } from '@/lib/db'

interface Props { id: number; name: string; size?: number; showShinyToggle?: boolean }

export function SpriteImage({ id, name, size = 96, showShinyToggle = false }: Props) {
  const [shiny, setShiny] = useState(false)
  const [errored, setErrored] = useState(false)
  const [spriteModeRaw] = useSetting('sprite_mode', 'modern')
  const mode = (spriteModeRaw ?? 'modern') as SpriteMode

  const src = shiny
    ? shinySpriteUrl(id)
    : errored
      ? getFallbackUrl(id)
      : getSpriteUrl(id, name, mode)

  return (
    <div className="relative flex flex-col items-center gap-1">
      <Image
        key={src}
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="pixelated"
        style={{ imageRendering: 'pixelated' }}
        onError={() => setErrored(true)}
      />
      {showShinyToggle && (
        <button
          onClick={() => setShiny(s => !s)}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: '5px',
            color: shiny ? 'var(--gold)' : 'var(--text-muted)',
          }}
        >
          {shiny ? '★ SHINY' : '☆ SHINY'}
        </button>
      )}
    </div>
  )
}
