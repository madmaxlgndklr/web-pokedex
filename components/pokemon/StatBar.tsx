// components/pokemon/StatBar.tsx
import { STAT_COLORS } from '@/lib/constants'

interface Props { name: string; value: number; max?: number }

export function StatBar({ name, value, max = 255 }: Props) {
  const pct = Math.min(100, (value / max) * 100)
  const color = STAT_COLORS[name] ?? 'var(--blue)'
  const shortName: Record<string, string> = {
    hp: 'HP', attack: 'ATK', defense: 'DEF',
    'special-attack': 'SATK', 'special-defense': 'SDEF', speed: 'SPD',
  }
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', width: '36px', textAlign: 'right' }}>
        {shortName[name] ?? name.toUpperCase()}
      </span>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text)', width: '28px' }}>
        {value}
      </span>
      <div style={{ background: 'var(--border)' }} className="flex-1 h-2 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
      </div>
    </div>
  )
}
