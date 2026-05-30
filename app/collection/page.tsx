// app/collection/page.tsx
'use client'
import { useMemo, CSSProperties } from 'react'
import Link from 'next/link'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { List } = require('react-window') as { List: React.ComponentType<{
  rowCount: number
  rowHeight: number
  rowComponent: React.ComponentType<{ index: number; style: CSSProperties }>
  rowProps: Record<string, unknown>
  defaultHeight?: number
  style?: CSSProperties
}> }
import { PokemonCard } from '@/components/pokemon/PokemonCard'
import { useCaughtPokemon } from '@/lib/db'
import { POKEMON_COUNT } from '@/lib/constants'

const ALL_IDS = Array.from({ length: POKEMON_COUNT }, (_, i) => i + 1)

export default function CollectionPage() {
  const { caught, toggle } = useCaughtPokemon()
  const caughtIds = useMemo(() => ALL_IDS.filter(id => caught.has(id)), [caught])

  function Row({ index, style }: { index: number; style: CSSProperties }) {
    const id = caughtIds[index]
    return (
      <div style={{ ...style, paddingBottom: '4px' }}>
        <PokemonCard
          id={id}
          name={`#${String(id).padStart(4,'0')}`}
          types={[]}
          caught
          onToggleCaught={() => toggle(id)}
        />
      </div>
    )
  }

  if (caughtIds.length === 0) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text-muted)' }}>
          NO POKÉMON CAUGHT YET
        </p>
        <Link href="/list" style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--gold)' }}>
          BROWSE POKÉDEX →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '16px' }}>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--gold)', marginBottom: '16px' }}>
        MY COLLECTION — {caughtIds.length}/{POKEMON_COUNT}
      </h1>
      <List
        rowCount={caughtIds.length}
        rowHeight={68}
        rowComponent={Row}
        rowProps={{}}
        defaultHeight={600}
        style={{ height: 600 }}
      />
    </div>
  )
}
