'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { fetchPokemonDetail } from '@/lib/api'
import { TypeBadge } from '@/components/pokemon/TypeBadge'
import { StatBar } from '@/components/pokemon/StatBar'
import { spriteUrl } from '@/lib/constants'
import type { PokemonDetail } from '@/lib/types'

const STAT_ORDER = ['hp','attack','defense','special-attack','special-defense','speed']

interface Props {
  first: PokemonDetail
  allPokemon: { id: number; name: string }[]
}

export function CompareClient({ first, allPokemon }: Props) {
  const [query, setQuery] = useState('')
  const [second, setSecond] = useState<PokemonDetail | null>(null)
  const [suggestions, setSuggestions] = useState<typeof allPokemon>([])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    setSuggestions(q.length > 0 ? allPokemon.filter(p => p.name.includes(q)).slice(0, 5) : [])
  }, [query, allPokemon])

  const pickSecond = async (id: number) => {
    setQuery('')
    setSuggestions([])
    const detail = await fetchPokemonDetail(id)
    setSecond(detail)
  }

  const getStat = (p: PokemonDetail, name: string) =>
    p.stats.find(s => s.stat.name === name)?.base_stat ?? 0

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '16px' }}>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--gold)', marginBottom: '16px' }}>COMPARE</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* First Pokémon (fixed) */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
          <Image src={spriteUrl(first.id)} alt={first.name} width={80} height={80} unoptimized style={{ imageRendering: 'pixelated', margin: '0 auto' }} />
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)' }}>{first.name.toUpperCase()}</p>
          <div className="flex gap-1 justify-center mt-1">
            {first.types.map(t => <TypeBadge key={t.slot} type={t.type.name} small />)}
          </div>
        </div>

        {/* Second Pokémon (picker) */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '12px' }}>
          {second ? (
            <div className="text-center">
              <Image src={spriteUrl(second.id)} alt={second.name} width={80} height={80} unoptimized style={{ imageRendering: 'pixelated', margin: '0 auto' }} />
              <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)' }}>{second.name.toUpperCase()}</p>
              <div className="flex gap-1 justify-center mt-1">
                {second.types.map(t => <TypeBadge key={t.slot} type={t.type.name} small />)}
              </div>
              <button onClick={() => setSecond(null)} style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginTop: '6px' }}>
                CHANGE
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="SEARCH POKÉMON"
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '6px', padding: '6px 8px', borderRadius: '3px' }}
              />
              {suggestions.length > 0 && (
                <ul style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', marginTop: '2px', position: 'absolute', width: '100%', zIndex: 10 }}>
                  {suggestions.map(p => (
                    <li key={p.id}>
                      <button onClick={() => pickSecond(p.id)} style={{ width: '100%', textAlign: 'left', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', padding: '6px 8px' }}>
                        {p.name.toUpperCase()}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stat comparison */}
      {second && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '12px' }}>
          <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)', marginBottom: '10px' }}>STATS</h2>
          {STAT_ORDER.map(stat => {
            const a = getStat(first, stat)
            const b = getStat(second, stat)
            return (
              <div key={stat} className="flex items-center gap-2 mb-3">
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: a > b ? 'var(--gold)' : 'var(--text)', width: '28px', textAlign: 'right' }}>{a}</span>
                <StatBar name={stat} value={a} />
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: 'var(--text-muted)', width: '36px', textAlign: 'center' }}>{stat.slice(0,3).toUpperCase()}</span>
                <StatBar name={stat} value={b} />
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: b > a ? 'var(--gold)' : 'var(--text)', width: '28px' }}>{b}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
