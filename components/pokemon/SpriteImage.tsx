// components/pokemon/SpriteImage.tsx
'use client'
import Image from 'next/image'
import { useState } from 'react'
import { spriteUrl, shinySpriteUrl } from '@/lib/constants'

interface Props { id: number; name: string; size?: number; showShinyToggle?: boolean }

export function SpriteImage({ id, name, size = 96, showShinyToggle = false }: Props) {
  const [shiny, setShiny] = useState(false)
  const src = shiny ? shinySpriteUrl(id) : spriteUrl(id)
  return (
    <div className="relative flex flex-col items-center gap-1">
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="pixelated"
        style={{ imageRendering: 'pixelated' }}
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
