// app/list/PokemonListClient.tsx
'use client'
import { useState, useMemo, CSSProperties } from 'react'
import { List, RowComponentProps } from 'react-window'
import { PokemonCard } from '@/components/pokemon/PokemonCard'
import { useCaughtPokemon } from '@/lib/db'
import { GENERATIONS } from '@/lib/constants'

interface Summary { id: number; name: string }
interface Props { allPokemon: Summary[] }

export function PokemonListClient({ allPokemon }: Props) {
  const { caught, toggle } = useCaughtPokemon()
  const [genFilter, setGenFilter] = useState<number | null>(null)
  const [showCaughtOnly, setShowCaughtOnly] = useState(false)

  const filtered = useMemo(() => {
    let list = allPokemon
    if (genFilter !== null) {
      const gen = GENERATIONS[genFilter]
      list = list.filter(p => p.id >= gen.min && p.id <= gen.max)
    }
    if (showCaughtOnly) list = list.filter(p => caught.has(p.id))
    return list
  }, [allPokemon, genFilter, showCaughtOnly, caught])

  function Row({ index, style }: RowComponentProps) {
    const p = filtered[index]
    return (
      <div style={{ ...style, paddingBottom: '4px' } as CSSProperties}>
        <PokemonCard
          id={p.id}
          name={p.name}
          types={[]}
          caught={caught.has(p.id)}
          onToggleCaught={() => toggle(p.id)}
        />
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '16px' }}>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--gold)', marginBottom: '16px' }}>
        POKÉDEX — {filtered.length} POKÉMON
      </h1>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        <select
          value={genFilter ?? ''}
          onChange={e => setGenFilter(e.target.value === '' ? null : Number(e.target.value))}
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'var(--font-pixel)', fontSize: '6px', padding: '4px 8px', borderRadius: '3px' }}
        >
          <option value="">ALL GENS</option>
          {GENERATIONS.map((g, i) => (
            <option key={i} value={i}>{g.label.toUpperCase()}</option>
          ))}
        </select>

        <button
          onClick={() => setShowCaughtOnly(v => !v)}
          style={{
            background: showCaughtOnly ? 'var(--gold)' : 'var(--surface)',
            color: showCaughtOnly ? 'var(--surface)' : 'var(--text-muted)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-pixel)',
            fontSize: '6px',
            padding: '4px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          ★ CAUGHT ONLY
        </button>
      </div>

      {/* Virtualized list */}
      <List<object>
        rowCount={filtered.length}
        rowHeight={68}
        rowComponent={Row}
        rowProps={{}}
        defaultHeight={600}
        style={{ height: 600 }}
      />
    </div>
  )
}
