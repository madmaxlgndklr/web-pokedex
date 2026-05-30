'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTeam } from '@/lib/db'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { spriteUrl } from '@/lib/constants'
import { fetchPokemonList } from '@/lib/api'

export default function TeamPage() {
  const { teamIds, add, remove } = useTeam()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allPokemon, setAllPokemon] = useState<{ id: number; name: string }[]>([])
  const [query, setQuery] = useState('')
  const router = useRouter()

  const openPicker = useCallback(async () => {
    if (allPokemon.length === 0) {
      const list = await fetchPokemonList()
      setAllPokemon(list)
    }
    setPickerOpen(true)
  }, [allPokemon])

  const suggestions = query
    ? allPokemon.filter(p => p.name.includes(query.toLowerCase())).slice(0, 8)
    : []

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '16px' }}>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--gold)', marginBottom: '16px' }}>
        MY TEAM ({teamIds.length}/6)
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 6 }, (_, i) => {
          const id = teamIds[i]
          if (id) {
            return (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
                <Link href={`/pokemon/${id}`}>
                  <Image src={spriteUrl(id)} alt={`slot ${i}`} width={64} height={64} unoptimized style={{ imageRendering: 'pixelated', margin: '0 auto' }} />
                </Link>
                <button onClick={() => remove(id)} style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  REMOVE
                </button>
              </div>
            )
          }
          return (
            <button
              key={i}
              onClick={openPicker}
              style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '4px', padding: '20px', cursor: 'pointer', fontFamily: 'var(--font-pixel)', fontSize: '20px', color: 'var(--text-muted)' }}
            >
              +
            </button>
          )
        })}
      </div>

      <Button onClick={() => router.push('/battle')} style={{ marginTop: '8px' }}>
        BATTLE HUB →
      </Button>

      <Modal open={pickerOpen} onClose={() => { setPickerOpen(false); setQuery('') }}>
        <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)', marginBottom: '12px' }}>ADD TO TEAM</h2>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="SEARCH POKÉMON"
          autoFocus
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '7px', padding: '8px 10px', borderRadius: '3px', marginBottom: '8px' }}
        />
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {suggestions.map(p => (
            <button
              key={p.id}
              onClick={() => { add(p.id); setPickerOpen(false); setQuery('') }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
              className="hover:opacity-70"
            >
              <Image src={spriteUrl(p.id)} alt={p.name} width={32} height={32} unoptimized style={{ imageRendering: 'pixelated' }} />
              {p.name.toUpperCase()}
              <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '5px' }}>#{p.id}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
