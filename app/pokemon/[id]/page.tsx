export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchPokemonDetail, fetchPokemonSpecies, fetchEvolutionChain } from '@/lib/api'
import { TypeBadge } from '@/components/pokemon/TypeBadge'
import { StatBar } from '@/components/pokemon/StatBar'
import { SpriteImage } from '@/components/pokemon/SpriteImage'
import { DetailActions } from './DetailActions'
import { POKEMON_COUNT } from '@/lib/constants'

interface Props { params: { id: string } }

function getIdFromChain(url: string): string {
  return url.split('/evolution-chain/')[1].replace('/', '')
}

function flattenChain(link: import('@/lib/types').ChainLink): { name: string; id: number }[] {
  const parts = link.species.url.split('/pokemon-species/')
  const id = parts[1] ? parseInt(parts[1]) : NaN
  if (isNaN(id)) return []
  const rest = link.evolves_to.flatMap(flattenChain)
  return [{ name: link.species.name, id }, ...rest]
}

export default async function PokemonDetailPage({ params }: Props) {
  const id = parseInt(params.id)
  if (isNaN(id) || id < 1 || id > POKEMON_COUNT) notFound()

  const [detail, species] = await Promise.all([
    fetchPokemonDetail(id),
    fetchPokemonSpecies(id),
  ])

  let evolutions: { name: string; id: number }[] = []
  try {
    const evoChainId = getIdFromChain(species.evolution_chain.url)
    const evoChain = await fetchEvolutionChain(evoChainId)
    evolutions = flattenChain(evoChain.chain)
  } catch {
    // Evolution chain unavailable for some Pokémon — render without it
  }

  const flavorText = species.flavor_text_entries
    .filter(e => e.language.name === 'en')
    .at(-1)
    ?.flavor_text.replace(/\f/g, ' ') ?? ''

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '16px', maxWidth: '700px' }}>
      {/* Prev/Next */}
      <div className="flex justify-between mb-4">
        {id > 1 ? (
          <Link href={`/pokemon/${id - 1}`} style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)' }}>
            ← #{id - 1}
          </Link>
        ) : <span />}
        {id < POKEMON_COUNT ? (
          <Link href={`/pokemon/${id + 1}`} style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)' }}>
            #{id + 1} →
          </Link>
        ) : <span />}
      </div>

      {/* Header */}
      <div className="flex items-center gap-6 mb-6">
        <SpriteImage id={id} name={detail.name} size={120} showShinyToggle />
        <div>
          <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: 'var(--gold)' }}>
            {detail.name.toUpperCase()}
          </h1>
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginTop: '4px' }}>
            #{String(id).padStart(4, '0')}
          </p>
          <div className="flex gap-2 mt-2">
            {detail.types.map(t => <TypeBadge key={t.slot} type={t.type.name} />)}
          </div>
        </div>
      </div>

      {/* Flavour text */}
      <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', lineHeight: '1.8', marginBottom: '16px', background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px', borderRadius: '3px' }}>
        {flavorText}
      </p>

      {/* Stats */}
      <section style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>BASE STATS</h2>
        <div className="flex flex-col gap-2">
          {detail.stats.map(s => (
            <StatBar key={s.stat.name} name={s.stat.name} value={s.base_stat} />
          ))}
        </div>
      </section>

      {/* Evolution chain */}
      {evolutions.length > 1 && (
        <section style={{ marginBottom: '16px' }}>
          <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>EVOLUTION</h2>
          <div className="flex gap-4 flex-wrap">
            {evolutions.map((e) => (
              <Link key={e.id} href={`/pokemon/${e.id}`} className="flex flex-col items-center gap-1">
                <SpriteImage id={e.id} name={e.name} size={64} />
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: e.id === id ? 'var(--gold)' : 'var(--text-muted)' }}>
                  {e.name.toUpperCase()}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Moves */}
      <section style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>MOVES</h2>
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '3px' }}>
          {detail.moves
            .flatMap(m => m.version_group_details.map(vg => ({
              name: m.move.name,
              level: vg.level_learned_at,
              method: vg.move_learn_method.name,
            })))
            .sort((a, b) => a.level - b.level)
            .slice(0, 40)
            .map((m, i) => (
              <Link
                key={`${m.name}-${i}`}
                href={`/move/${m.name}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--border)',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '6px',
                  color: 'var(--text)',
                }}
                className="hover:opacity-70"
              >
                <span>{m.name.toUpperCase()}</span>
                <span style={{ color: 'var(--text-muted)' }}>{m.level > 0 ? `LV ${m.level}` : m.method.toUpperCase()}</span>
              </Link>
            ))}
        </div>
      </section>

      {/* Caught / Team / Compare / Battle actions */}
      <DetailActions pokemonId={id} />
    </div>
  )
}
