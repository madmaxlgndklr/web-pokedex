// components/pokemon/PokemonCard.tsx
'use client'
import Link from 'next/link'
import Image from 'next/image'
import { TypeBadge } from './TypeBadge'
import { spriteUrl } from '@/lib/constants'

interface Props {
  id: number
  name: string
  types: string[]
  caught?: boolean
  onToggleCaught?: () => void
}

export function PokemonCard({ id, name, types, caught = false, onToggleCaught }: Props) {
  return (
    <div
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px' }}
      className="flex items-center gap-3 p-2 hover:opacity-80 transition-opacity"
    >
      <Image
        src={spriteUrl(id)}
        alt={name}
        width={48}
        height={48}
        unoptimized
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="flex-1 min-w-0">
        <Link href={`/pokemon/${id}`}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text)' }}>
            {name.toUpperCase()}
          </div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: 'var(--text-muted)' }}>
            #{String(id).padStart(4, '0')}
          </div>
        </Link>
        <div className="flex gap-1 mt-1">
          {types.map(t => <TypeBadge key={t} type={t} small />)}
        </div>
      </div>
      {onToggleCaught && (
        <button
          onClick={onToggleCaught}
          style={{ color: caught ? 'var(--gold)' : 'var(--text-muted)', fontSize: '16px' }}
          aria-label={caught ? 'Uncatch' : 'Catch'}
        >
          {caught ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}
