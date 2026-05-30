// app/HomeSearch.tsx
'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { spriteUrl } from '@/lib/constants'

interface Props { allPokemon: { id: number; name: string }[] }

export function HomeSearch({ allPokemon }: Props) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const byId = q.match(/^\d+$/) ? allPokemon.filter(p => String(p.id).startsWith(q)) : []
    const byName = allPokemon.filter(p => p.name.includes(q))
    const combined = Array.from(new Map([...byId, ...byName].map(p => [p.id, p] as [number, typeof p])).values())
    return combined.slice(0, 8)
  }, [query, allPokemon])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const match = allPokemon.find(p => p.name === query.toLowerCase() || String(p.id) === query)
    if (match) router.push(`/pokemon/${match.id}`)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }} className="flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '14px', color: 'var(--header)', letterSpacing: '2px' }}>
          POKÉDEX
        </h1>
        <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginTop: '8px' }}>
          {allPokemon.length} POKÉMON
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md relative">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="SEARCH NAME OR #ID"
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'var(--font-pixel)',
            fontSize: '8px',
            padding: '10px 14px',
            borderRadius: '3px',
            outline: 'none',
          }}
          autoFocus
        />
        {suggestions.length > 0 && (
          <ul
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', marginTop: '2px' }}
            className="absolute w-full z-10"
          >
            {suggestions.map(p => (
              <li key={p.id}>
                <Link
                  href={`/pokemon/${p.id}`}
                  style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text)' }}
                  className="flex items-center gap-3 px-3 py-2 hover:opacity-70"
                >
                  <Image src={spriteUrl(p.id)} alt={p.name} width={32} height={32} unoptimized style={{ imageRendering: 'pixelated' }} />
                  <span>{p.name.toUpperCase()}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>#{String(p.id).padStart(4,'0')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="flex gap-4 mt-12 flex-wrap justify-center">
        {[
          { href: '/list', label: 'FULL LIST' },
          { href: '/collection', label: 'MY COLLECTION' },
          { href: '/team', label: 'MY TEAM' },
          { href: '/battle', label: 'BATTLE HUB' },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: '7px',
              color: 'var(--gold)',
              border: '1px solid var(--border)',
              padding: '8px 12px',
              borderRadius: '3px',
              background: 'var(--surface)',
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
