import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchMove } from '@/lib/api'
import { TypeBadge } from '@/components/pokemon/TypeBadge'
import { spriteUrl } from '@/lib/constants'
import Image from 'next/image'

interface Props { params: { name: string } }

export default async function MoveDetailPage({ params }: Props) {
  let move
  try { move = await fetchMove(params.name) } catch { notFound() }

  const englishEffect = move.effect_entries.find(e => e.language.name === 'en')
  const categoryColor = { physical: '#c03028', special: '#6890f0', status: '#a8a878' }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '16px', maxWidth: '600px' }}>
      <Link href="/" style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>
        ← BACK
      </Link>

      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: 'var(--gold)', marginTop: '12px', marginBottom: '8px' }}>
        {move.name.toUpperCase().replace(/-/g, ' ')}
      </h1>

      <div className="flex gap-2 mb-4">
        <TypeBadge type={move.type.name} />
        <span style={{
          fontFamily: 'var(--font-pixel)', fontSize: '7px',
          color: '#fff',
          background: categoryColor[move.damage_class.name as keyof typeof categoryColor] ?? '#888',
          padding: '3px 8px', borderRadius: '3px',
        }}>
          {move.damage_class.name.toUpperCase()}
        </span>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', padding: '12px', marginBottom: '12px' }}>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'POWER',    value: move.power    ?? '—' },
            { label: 'ACCURACY', value: move.accuracy != null ? `${move.accuracy}%` : '—' },
            { label: 'PP',       value: move.pp },
            { label: 'PRIORITY', value: move.priority },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: 'var(--text-muted)' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {englishEffect && (
        <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', lineHeight: '1.8', marginBottom: '16px' }}>
          {englishEffect.effect}
        </p>
      )}

      <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        LEARNED BY
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {move.learned_by_pokemon.slice(0, 30).map(p => {
          const id = parseInt(p.url.split('/pokemon/')[1])
          return (
            <Link key={p.name} href={`/pokemon/${id}`} className="flex flex-col items-center gap-1 hover:opacity-70">
              <Image src={spriteUrl(id)} alt={p.name} width={48} height={48} unoptimized style={{ imageRendering: 'pixelated' }} />
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: 'var(--text)' }}>
                {p.name.toUpperCase()}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
