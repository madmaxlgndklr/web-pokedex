// components/battle/TrainerSelectScreen.tsx
'use client'
import { useState, useEffect } from 'react'
import { loadTrainers, type Trainer } from '@/lib/battle/TrainerRoster'
import { TypeBadge } from '@/components/pokemon/TypeBadge'
import { Button } from '@/components/ui/Button'

interface Props {
  teamIds: number[]
  onStartBattle: (trainer: Trainer) => void
}

const CLASS_ORDER = ['CHAMPION', 'ELITE_FOUR', 'GYM_LEADER', 'RIVAL', 'TRAINER']
const CLASS_COLOR: Record<string, string> = {
  CHAMPION: '#f0c040', ELITE_FOUR: '#a040a0', GYM_LEADER: '#6890f0',
  RIVAL: '#f08030', TRAINER: '#a8a878',
}

export function TrainerSelectScreen({ teamIds, onStartBattle }: Props) {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selected, setSelected] = useState<Trainer | null>(null)

  useEffect(() => { loadTrainers().then(setTrainers) }, [])

  const grouped = CLASS_ORDER.map(cls => ({
    cls, trainers: trainers.filter(t => t.trainerClass === cls),
  })).filter(g => g.trainers.length > 0)

  return (
    <div style={{ padding: '12px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)', marginBottom: '10px' }}>TRAINERS</div>

      {selected ? (
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: CLASS_COLOR[selected.trainerClass] ?? 'var(--text)', marginBottom: '4px' }}>
            {selected.name.toUpperCase()}
          </div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {selected.title} • {selected.region.toUpperCase()} • {selected.typeSpecialty.toUpperCase()} TYPE
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onStartBattle(selected)}>BATTLE!</Button>
            <Button onClick={() => setSelected(null)} variant="secondary">BACK</Button>
          </div>
        </div>
      ) : (
        grouped.map(({ cls, trainers: group }) => (
          <div key={cls} style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: CLASS_COLOR[cls] ?? 'var(--text-muted)', marginBottom: '4px', letterSpacing: '1px' }}>
              {cls.replace('_', ' ')}
            </div>
            {group.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', marginBottom: '3px', cursor: 'pointer' }}
              >
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text)', flex: 1, textAlign: 'left' }}>
                  {t.name.toUpperCase()}
                </span>
                <TypeBadge type={t.typeSpecialty} small />
              </button>
            ))}
          </div>
        ))
      )}

      {teamIds.length === 0 && (
        <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Add Pokémon to your team to battle trainers.
        </p>
      )}
    </div>
  )
}
