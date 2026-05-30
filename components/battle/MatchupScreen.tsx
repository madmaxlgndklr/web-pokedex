// components/battle/MatchupScreen.tsx
'use client'
import { useState, useEffect } from 'react'
import { fetchTypeChart } from '@/lib/api'
import { TypeBadge } from '@/components/pokemon/TypeBadge'
import { getTypeEffectiveness } from '@/lib/battle/DamageEngine'
import { TYPE_COLORS } from '@/lib/constants'

const ALL_TYPES = Object.keys(TYPE_COLORS)

export function MatchupScreen(_props: { teamIds: number[] }) {
  const [chart, setChart] = useState<Awaited<ReturnType<typeof fetchTypeChart>> | null>(null)
  const [selectedType, setSelectedType] = useState('fire')

  useEffect(() => { fetchTypeChart().then(setChart) }, [])

  const effectivenessColor = (mult: number) => {
    if (mult === 0) return '#555'
    if (mult >= 2) return '#c03028'
    if (mult < 1) return '#78c850'
    return 'var(--text)'
  }

  return (
    <div style={{ padding: '12px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)', marginBottom: '10px' }}>TYPE MATCHUP</div>

      <div className="flex flex-wrap gap-1 mb-4">
        {ALL_TYPES.map(t => (
          <button key={t} onClick={() => setSelectedType(t)} style={{ opacity: selectedType === t ? 1 : 0.5 }}>
            <TypeBadge type={t} small />
          </button>
        ))}
      </div>

      {chart && (
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            ATTACKING WITH {selectedType.toUpperCase()}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_TYPES.map(defType => {
              const mult = getTypeEffectiveness(selectedType, [defType], chart)
              return (
                <div key={defType} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 8px' }}>
                  <TypeBadge type={defType} small />
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: effectivenessColor(mult), marginLeft: 'auto' }}>
                    {mult === 0 ? '✕' : `${mult}×`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
