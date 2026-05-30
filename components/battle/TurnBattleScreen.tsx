// components/battle/TurnBattleScreen.tsx
'use client'
import { useState, useCallback, useEffect } from 'react'
import { fetchPokemonDetail } from '@/lib/api'
import { SpriteImage } from '@/components/pokemon/SpriteImage'
import { useWildRecords, useTrainerRecords } from '@/lib/db'
import { resolvePlayerAttack, resolveEnemyAttack, buildBattlePokemon, type BattlePokemon, type BattleState } from '@/lib/battle/BattleEngine'
import { resolveStats } from '@/lib/battle/StatConfig'
import { Button } from '@/components/ui/Button'
import { type Trainer } from '@/lib/battle/TrainerRoster'

interface Props {
  teamIds: number[]
  trainer?: Trainer
  onBack?: () => void
}

const DEFAULT_STAT_CONFIG = { kind: 'gen3plus' as const, ivs: [31,31,31,31,31,31], evs: [0,0,0,0,0,0] }
const DEFAULT_NATURE = { name: 'Hardy', boosted: null, dropped: null }

export function TurnBattleScreen({ teamIds, trainer, onBack }: Props) {
  const [state, setState] = useState<BattleState>({ phase: 'setup' })
  const [player, setPlayer] = useState<BattlePokemon | null>(null)
  const [enemy, setEnemy] = useState<BattlePokemon | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [enemyIdInput, setEnemyIdInput] = useState('')
  const [typeChart, setTypeChart] = useState<Record<string, { double_damage_to: {name:string}[]; half_damage_to: {name:string}[]; no_damage_to: {name:string}[] }>>({})
  const { recordBattle: recordWild } = useWildRecords()
  const { recordBattle: recordTrainer } = useTrainerRecords()

  const buildPkmn = (detail: Awaited<ReturnType<typeof fetchPokemonDetail>>, level = 50) =>
    buildBattlePokemon(
      detail, level,
      detail.moves.slice(0, 4).map(m => ({ name: m.move.name, type: 'normal', category: 'physical' as const, power: 60, accuracy: 100, pp: 15, currentPp: 15 })),
      resolveStats(detail.stats.map(s => s.base_stat), DEFAULT_STAT_CONFIG, level, DEFAULT_NATURE)
    )

  // Auto-start when trainer prop is provided
  useEffect(() => {
    if (!trainer || teamIds.length === 0) return
    const trainerPkmn = trainer.rosters[0]?.[0]
    if (!trainerPkmn) return
    ;(async () => {
      const { fetchTypeChart } = await import('@/lib/api')
      const [enemyDetail, playerDetail, chart] = await Promise.all([
        fetchPokemonDetail(trainerPkmn.id),
        fetchPokemonDetail(teamIds[0]),
        fetchTypeChart(),
      ])
      setTypeChart(chart)
      setPlayer(buildPkmn(playerDetail))
      setEnemy(buildPkmn(enemyDetail, trainerPkmn.level))
      setLog([`${trainer.name.toUpperCase()} sent out ${trainerPkmn.name.toUpperCase()}!`])
      setState({ phase: 'player_turn' })
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer, teamIds])

  const startWildBattle = useCallback(async () => {
    const enemyId = parseInt(enemyIdInput)
    if (isNaN(enemyId) || teamIds.length === 0) return
    const [enemyDetail, playerDetail, { fetchTypeChart }] = await Promise.all([
      fetchPokemonDetail(enemyId),
      fetchPokemonDetail(teamIds[0]),
      import('@/lib/api'),
    ])
    const chart = await fetchTypeChart()
    setTypeChart(chart)
    setPlayer(buildPkmn(playerDetail))
    setEnemy(buildPkmn(enemyDetail))
    setLog([`A wild ${enemyDetail.name.toUpperCase()} appeared!`])
    setState({ phase: 'player_turn' })
  }, [enemyIdInput, teamIds])

  const playerAttack = useCallback((moveIdx: number) => {
    if (!player || !enemy || state.phase !== 'player_turn') return
    const { updatedEnemy, log: attackLog } = resolvePlayerAttack(player, enemy, moveIdx, typeChart)
    const newLog = [...log, attackLog]
    if (updatedEnemy.currentHp === 0) {
      setEnemy(updatedEnemy)
      setLog([...newLog, trainer ? `You defeated ${trainer.name.toUpperCase()}!` : 'You won!'])
      setState({ phase: 'won' })
      if (trainer) {
        recordTrainer({ trainerId: trainer.id, name: trainer.name, title: trainer.title, region: trainer.region, trainerClass: trainer.trainerClass, typeSpecialty: trainer.typeSpecialty }, true)
      } else {
        recordWild(enemy.id, enemy.name, true)
      }
      return
    }
    const { updatedPlayer, log: enemyLog } = resolveEnemyAttack(updatedEnemy, player, typeChart)
    setEnemy(updatedEnemy)
    setPlayer(updatedPlayer)
    setLog([...newLog, enemyLog])
    if (updatedPlayer.currentHp === 0) {
      setState({ phase: 'lost' })
      if (trainer) {
        recordTrainer({ trainerId: trainer.id, name: trainer.name, title: trainer.title, region: trainer.region, trainerClass: trainer.trainerClass, typeSpecialty: trainer.typeSpecialty }, false)
      } else {
        recordWild(enemy.id, enemy.name, false)
      }
    }
  }, [player, enemy, state, typeChart, log, recordWild, recordTrainer, trainer])

  const hpBar = (current: number, max: number, color = '#78c850') => (
    <div style={{ background: 'var(--border)', borderRadius: '3px', height: '8px', width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, (current / max) * 100)}%`, background: color, height: '100%', transition: 'width 0.3s' }} />
    </div>
  )

  if (state.phase === 'setup' && !trainer) return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)', marginBottom: '10px' }}>WILD BATTLE</div>
      <div className="flex gap-2 mb-4">
        <input value={enemyIdInput} onChange={e => setEnemyIdInput(e.target.value)} placeholder="ENEMY POKÉMON #ID"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '7px', padding: '6px 10px', borderRadius: '3px' }} />
        <Button onClick={startWildBattle}>START</Button>
      </div>
      {teamIds.length === 0 && (
        <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>Add Pokémon to your team first!</p>
      )}
    </div>
  )

  if (state.phase === 'setup' && trainer) return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>Loading trainer battle...</div>
    </div>
  )

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {enemy && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px' }}>
          <div className="flex items-center gap-3">
            <SpriteImage id={enemy.id} name={enemy.name} size={56} />
            <div className="flex-1">
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text)' }}>{enemy.name.toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>HP {enemy.currentHp}/{enemy.maxHp}</div>
              {hpBar(enemy.currentHp, enemy.maxHp)}
            </div>
          </div>
        </div>
      )}
      {player && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px' }}>
          <div className="flex items-center gap-3">
            <SpriteImage id={player.id} name={player.name} size={56} />
            <div className="flex-1">
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text)' }}>{player.name.toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>HP {player.currentHp}/{player.maxHp}</div>
              {hpBar(player.currentHp, player.maxHp, '#6890f0')}
            </div>
          </div>
        </div>
      )}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', padding: '8px', flex: 1, overflowY: 'auto', maxHeight: '120px' }}>
        {log.map((l, i) => (
          <div key={i} style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', lineHeight: '1.8' }}>{l}</div>
        ))}
      </div>
      {state.phase === 'player_turn' && player && (
        <div className="grid grid-cols-2 gap-2">
          {player.moves.slice(0, 4).map((m, i) => (
            <Button key={i} onClick={() => playerAttack(i)} variant="secondary" style={{ fontSize: '6px', padding: '6px' }}>
              {m.name.toUpperCase()}
            </Button>
          ))}
        </div>
      )}
      {(state.phase === 'won' || state.phase === 'lost') && (
        <Button onClick={() => {
          setState({ phase: 'setup' })
          setPlayer(null)
          setEnemy(null)
          setLog([])
          if (onBack) onBack()
        }}>
          {state.phase === 'won' ? 'VICTORY!' : 'DEFEAT'} — {trainer ? 'BACK' : 'RESET'}
        </Button>
      )}
    </div>
  )
}
