// components/pokemon/TypeBadge.tsx
import { TYPE_COLORS } from '@/lib/constants'

interface Props { type: string; small?: boolean }

export function TypeBadge({ type, small = false }: Props) {
  const bg = TYPE_COLORS[type] ?? '#888'
  return (
    <span
      style={{
        background: bg,
        color: '#fff',
        fontFamily: 'var(--font-pixel)',
        fontSize: small ? '5px' : '7px',
        padding: small ? '2px 5px' : '3px 8px',
        borderRadius: '3px',
        display: 'inline-block',
        letterSpacing: '0.5px',
      }}
    >
      {type.toUpperCase()}
    </span>
  )
}
