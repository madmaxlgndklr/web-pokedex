// components/battle/DamageCalcScreen.tsx
'use client'
import { useState, useEffect } from 'react'
import { fetchPokemonDetail, fetchTypeChart } from '@/lib/api'
import { TypeBadge } from '@/components/pokemon/TypeBadge'
import { calcDamageRange, getTypeEffectiveness } from '@/lib/battle/DamageEngine'
import { resolveStats } from '@/lib/battle/StatConfig'
import { NATURES } from '@/lib/constants'
import type { PokemonDetail } from '@/lib/types'
import type { StatConfig, NatureData } from '@/lib/battle/StatConfig'

interface Props { preloadId?: number }

const DEFAULT_CONFIG: StatConfig = {
  kind: 'gen3plus',
  ivs: [31, 31, 31, 31, 31, 31],
  evs: [0, 0, 0, 0, 0, 0],
}
const DEFAULT_NATURE: NatureData = { name: 'Hardy', boosted: null, dropped: null }

export function DamageCalcScreen({ preloadId }: Props) {
  const [attacker, setAttacker] = useState<PokemonDetail | null>(null)
  const [defender, setDefender] = useState<PokemonDetail | null>(null)
  const [attackerQuery, setAttackerQuery] = useState('')
  const [defenderQuery, setDefenderQuery] = useState('')
  const [level, setLevel] = useState(50)
  const [selectedMoveIdx, setSelectedMoveIdx] = useState(0)
  const [typeChart, setTypeChart] = useState<Awaited<ReturnType<typeof fetchTypeChart>> | null>(null)
  const [result, setResult] = useState<{ min: number; max: number } | null>(null)

  useEffect(() => {
    fetchTypeChart().then(setTypeChart)
    if (preloadId) fetchPokemonDetail(preloadId).then(setAttacker)
  }, [preloadId])

  useEffect(() => {
    if (!attacker || !defender || !typeChart) return
    const move = attacker.moves[selectedMoveIdx]
    if (!move) return
    const atkStats = resolveStats(attacker.stats.map(s => s.base_stat), DEFAULT_CONFIG, level, DEFAULT_NATURE)
    const defStats = resolveStats(defender.stats.map(s => s.base_stat), DEFAULT_CONFIG, level, DEFAULT_NATURE)
    const moveName = move.move.name
    // Power lookup would need move fetch; use 80 as placeholder
    const power = 80
    const atk = atkStats[1]
    const def = defStats[2]
    const stab = attacker.types.some(t => t.type.name === moveName.split('-')[0]) ? 1.5 : 1
    const type = getTypeEffectiveness(attacker.types[0]?.type.name ?? 'normal', defender.types.map(t => t.type.name), typeChart)
    setResult(calcDamageRange({ level, power, attack: atk, defense: def, stabMultiplier: stab, typeMultiplier: type, critMultiplier: 1 }))
  }, [attacker, defender, level, selectedMoveIdx, typeChart])

  const search = async (query: string, setSide: (p: PokemonDetail) => void) => {
    const id = parseInt(query)
    if (!isNaN(id)) { const d = await fetchPokemonDetail(id); setSide(d) }
  }

  const pane = (
    label: string,
    pokemon: PokemonDetail | null,
    query: string,
    setQuery: (s: string) => void,
    setSide: (p: PokemonDetail) => void
  ) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px', flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      <div className="flex gap-2 mb-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(query, setSide)}
          placeholder="NAME OR #ID"
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '6px', padding: '4px 8px', borderRadius: '3px' }}
        />
        <button onClick={() => search(query, setSide)} style={{ background: 'var(--header)', color: '#fff', fontFamily: 'var(--font-pixel)', fontSize: '6px', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer' }}>
          GO
        </button>
      </div>
      {pokemon && (
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)' }}>{pokemon.name.toUpperCase()}</div>
          <div className="flex gap-1 mt-1">
            {pokemon.types.map(t => <TypeBadge key={t.slot} type={t.type.name} small />)}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ padding: '12px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)', marginBottom: '10px' }}>DAMAGE CALC</div>

      <div className="flex gap-3 mb-4 flex-wrap">
        {pane('ATTACKER', attacker, attackerQuery, setAttackerQuery, setAttacker)}
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center' }}>VS</div>
        {pane('DEFENDER', defender, defenderQuery, setDefenderQuery, setDefender)}
      </div>

      <div className="flex gap-4 items-center mb-4 flex-wrap">
        <div>
          <label style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>LEVEL</label>
          <input type="number" min={1} max={100} value={level} onChange={e => setLevel(Number(e.target.value))}
            style={{ display: 'block', width: '64px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '8px', padding: '4px 6px', borderRadius: '3px', marginTop: '2px' }} />
        </div>
        <div>
          <label style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>NATURE</label>
          <select style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '6px', padding: '4px 6px', borderRadius: '3px', marginTop: '2px' }}>
            {NATURES.map(n => <option key={n.name}>{n.name}</option>)}
          </select>
        </div>
      </div>

      {result && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '12px', marginTop: '8px' }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)' }}>DAMAGE RANGE</div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '16px', color: 'var(--gold)', marginTop: '4px' }}>
            {result.min} – {result.max}
          </div>
          {defender && (
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {Math.round((result.min / (defender.stats[0]?.base_stat ?? 1)) * 100)}%–
              {Math.round((result.max / (defender.stats[0]?.base_stat ?? 1)) * 100)}% of base HP
            </div>
          )}
        </div>
      )}
    </div>
  )
}
