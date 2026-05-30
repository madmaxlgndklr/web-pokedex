// components/battle/RecordScreen.tsx
'use client'
import Image from 'next/image'
import { useTrainerRecords, useWildRecords } from '@/lib/db'
import { spriteUrl } from '@/lib/constants'

export function RecordScreen() {
  const { records: trainerRecords } = useTrainerRecords()
  const { records: wildRecords } = useWildRecords()

  const totalBattles = trainerRecords.reduce((s, r) => s + r.wins + r.losses, 0)
    + wildRecords.reduce((s, r) => s + r.wins + r.losses, 0)

  if (totalBattles === 0) return (
    <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)' }}>NO BATTLES YET</p>
    </div>
  )

  const recordRow = (name: string, wins: number, losses: number, key: string | number, spriteId?: number) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
      {spriteId && <Image src={spriteUrl(spriteId)} alt={name} width={32} height={32} unoptimized style={{ imageRendering: 'pixelated' }} />}
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', flex: 1 }}>{name.toUpperCase()}</span>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: '#78c850' }}>{wins}W</span>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: '#c03028' }}>{losses}L</span>
    </div>
  )

  return (
    <div style={{ padding: '12px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)', marginBottom: '10px' }}>
        BATTLE LOG — {totalBattles} BATTLES
      </div>

      {trainerRecords.length > 0 && (
        <section style={{ marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)', marginBottom: '6px' }}>TRAINERS</h3>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            {trainerRecords.map(r => recordRow(`${r.name} (${r.trainerClass})`, r.wins, r.losses, r.trainerId))}
          </div>
        </section>
      )}

      {wildRecords.length > 0 && (
        <section>
          <h3 style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)', marginBottom: '6px' }}>WILD</h3>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            {wildRecords.map(r => recordRow(r.pokemonName, r.wins, r.losses, r.pokemonId, r.pokemonId))}
          </div>
        </section>
      )}
    </div>
  )
}
