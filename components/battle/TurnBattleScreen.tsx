// components/battle/TurnBattleScreen.tsx
'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { fetchPokemonDetail, fetchPokemonList } from '@/lib/api'
import { SpriteImage } from '@/components/pokemon/SpriteImage'
import { useWildRecords, useTrainerRecords } from '@/lib/db'
import {
  buildBattlePokemon, startBattle, resolveTurn, confirmSwitch, aiPickAction,
  type BattlePokemon, type BattleState, type TurnAction,
} from '@/lib/battle/BattleEngine'
import { Natures } from '@/lib/battle/StatConfig'
import type { StatConfig, Nature } from '@/lib/battle/StatConfig'
import { learnableMoves, resolveMoves, defaultSetup, HELD_ITEM_LIST, type BattleSetup, type LearnableMove } from '@/lib/battle/BattleSetup'
import { Button } from '@/components/ui/Button'
import type { PokemonDetail, HeldItem } from '@/lib/types'
import type { Trainer } from '@/lib/battle/TrainerRoster'

interface Props {
  teamIds: number[]
  trainer?: Trainer
  onBack?: () => void
}

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// ── Setup View ──────────────────────────────────────────────────────────────

function SetupView({
  teamIds, trainer, setup, onSetupChange, onStart, onBack, loadingStart,
}: {
  teamIds: number[]
  trainer?: Trainer
  setup: BattleSetup
  onSetupChange: (s: BattleSetup) => void
  onStart: () => void
  onBack?: () => void
  loadingStart: boolean
}) {
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [slotDetails, setSlotDetails] = useState<Record<number, PokemonDetail>>({})
  const [loadingSlot, setLoadingSlot] = useState(false)
  const [moves, setMoves] = useState<LearnableMove[]>([])

  const slotLevel = selectedSlot === 0
    ? setup.level
    : (setup.teamOverrides[selectedSlot]?.level ?? setup.level)
  const slotNature = selectedSlot === 0
    ? setup.nature
    : (setup.teamOverrides[selectedSlot]?.nature ?? setup.nature)
  const slotConfig = selectedSlot === 0
    ? setup.statConfig
    : (setup.teamOverrides[selectedSlot]?.statConfig ?? setup.statConfig)
  const slotHeldItem = selectedSlot === 0
    ? (setup.heldItem ?? null)
    : (setup.teamOverrides[selectedSlot]?.heldItem ?? setup.heldItem ?? null)
  const slotMoveNames = selectedSlot === 0
    ? setup.selectedMoveNames
    : (setup.teamOverrides[selectedSlot]?.selectedMoveNames
        ?? learnableMoves(slotDetails[selectedSlot] ?? slotDetails[0]!, slotLevel).filter(m => m.available).slice(0, 4).map(m => m.name))

  // Fetch detail for selected slot
  useEffect(() => {
    if (teamIds.length === 0) return
    const id = teamIds[selectedSlot]
    if (!id || slotDetail) return
    setLoadingSlot(true)
    fetchPokemonDetail(id).then(d => {
      setSlotDetails(prev => ({ ...prev, [selectedSlot]: d }))
    }).finally(() => setLoadingSlot(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot, teamIds])

  // Recompute learnable moves when slot detail or level changes
  const slotDetail = slotDetails[selectedSlot]
  useEffect(() => {
    if (!slotDetail) return
    const all = learnableMoves(slotDetail, slotLevel)
    setMoves(all)
    // If no moves selected yet for slot 0, auto-pick first 4 available
    if (selectedSlot === 0 && setup.selectedMoveNames.length === 0) {
      const defaults = all.filter(m => m.available).slice(0, 4).map(m => m.name)
      onSetupChange({ ...setup, selectedMoveNames: defaults })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotDetail, slotLevel])

  function setSlotLevel(level: number) {
    const clamped = Math.max(1, Math.min(100, level))
    if (selectedSlot === 0) {
      onSetupChange({ ...setup, level: clamped })
    } else {
      const ov = setup.teamOverrides[selectedSlot] ?? {}
      onSetupChange({ ...setup, teamOverrides: { ...setup.teamOverrides, [selectedSlot]: { ...ov, level: clamped } } })
    }
  }

  function toggleMove(name: string) {
    if (selectedSlot === 0) {
      const cur = setup.selectedMoveNames
      const next = cur.includes(name)
        ? cur.filter(m => m !== name)
        : cur.length < 4 ? [...cur, name] : cur
      onSetupChange({ ...setup, selectedMoveNames: next })
    } else {
      const ov = setup.teamOverrides[selectedSlot] ?? {}
      const cur = ov.selectedMoveNames ?? learnableMoves(slotDetails[selectedSlot]!, slotLevel).filter(m => m.available).slice(0, 4).map(m => m.name)
      const next = cur.includes(name)
        ? cur.filter(m => m !== name)
        : cur.length < 4 ? [...cur, name] : cur
      onSetupChange({ ...setup, teamOverrides: { ...setup.teamOverrides, [selectedSlot]: { ...ov, selectedMoveNames: next } } })
    }
  }

  function setNature(nature: Nature) {
    if (selectedSlot === 0) {
      onSetupChange({ ...setup, nature })
    } else {
      const ov = setup.teamOverrides[selectedSlot] ?? {}
      onSetupChange({ ...setup, teamOverrides: { ...setup.teamOverrides, [selectedSlot]: { ...ov, nature } } })
    }
  }

  function setHeldItem(item: HeldItem | null) {
    if (selectedSlot === 0) {
      onSetupChange({ ...setup, heldItem: item })
    } else {
      const ov = setup.teamOverrides[selectedSlot] ?? {}
      onSetupChange({ ...setup, teamOverrides: { ...setup.teamOverrides, [selectedSlot]: { ...ov, heldItem: item } } })
    }
  }

  function setStatConfig(config: StatConfig) {
    if (selectedSlot === 0) {
      onSetupChange({ ...setup, statConfig: config })
    } else {
      const ov = setup.teamOverrides[selectedSlot] ?? {}
      onSetupChange({ ...setup, teamOverrides: { ...setup.teamOverrides, [selectedSlot]: { ...ov, statConfig: config } } })
    }
  }

  const pxFont = { fontFamily: 'var(--font-pixel)' } as const
  const detail = slotDetails[selectedSlot]

  const canStart = teamIds.length > 0 && (
    selectedSlot !== 0 || setup.selectedMoveNames.length > 0
  )

  return (
    <div style={{ padding: '12px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{ ...pxFont, fontSize: '8px', color: 'var(--gold)' }}>
        {trainer ? `VS ${trainer.name.toUpperCase()}` : 'BATTLE SETUP'}
      </div>

      {/* Gen selector */}
      <div>
        <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>GENERATION</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {GENS.map(g => (
            <button key={g} onClick={() => onSetupChange({ ...setup, gen: g })}
              style={{ ...pxFont, fontSize: '6px', padding: '3px 6px', borderRadius: '3px', cursor: 'pointer',
                background: setup.gen === g ? 'var(--blue)' : 'var(--surface)',
                color: setup.gen === g ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border)' }}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Team slot tabs */}
      {teamIds.length > 1 && (
        <div>
          <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>TEAM SLOT</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {teamIds.map((id, i) => (
              <button key={i} onClick={() => setSelectedSlot(i)}
                style={{ ...pxFont, fontSize: '6px', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: selectedSlot === i ? 'var(--header)' : 'var(--surface)',
                  color: selectedSlot === i ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)' }}>
                #{id}
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingSlot && (
        <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)' }}>Loading...</div>
      )}

      {detail && (
        <>
          {/* Level */}
          <div>
            <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              LEVEL {selectedSlot > 0 && setup.teamOverrides[selectedSlot]?.level != null ? '(OVERRIDE)' : '(GLOBAL)'}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="range" min={1} max={100} value={slotLevel}
                onChange={e => setSlotLevel(parseInt(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={1} max={100} value={slotLevel}
                onChange={e => setSlotLevel(parseInt(e.target.value) || 1)}
                style={{ width: '48px', ...pxFont, fontSize: '7px', background: 'var(--surface)',
                  border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: '3px' }} />
            </div>
          </div>

          {/* Nature */}
          <div>
            <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>NATURE</div>
            <select value={slotNature.name} onChange={e => {
              const n = Natures.ALL.find(n => n.name === e.target.value) ?? Natures.HARDY
              setNature(n)
            }} style={{ ...pxFont, fontSize: '6px', background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', padding: '4px 8px', borderRadius: '3px', width: '100%' }}>
              {Natures.ALL.map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
            </select>
          </div>

          {/* Stat Config */}
          <div>
            <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>STAT CONFIG</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setStatConfig({ kind: 'gen3plus', ivs: [31,31,31,31,31,31], evs: [0,0,0,0,0,0] })}
                style={{ ...pxFont, fontSize: '6px', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: slotConfig.kind === 'gen3plus' && slotConfig.ivs[0] === 31 && slotConfig.evs[0] === 0 ? 'var(--blue)' : 'var(--surface)',
                  color: slotConfig.kind === 'gen3plus' && slotConfig.ivs[0] === 31 && slotConfig.evs[0] === 0 ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)' }}>
                PERFECT
              </button>
              <button onClick={() => setStatConfig({ kind: 'gen3plus', ivs: [0,0,0,0,0,0], evs: [0,0,0,0,0,0] })}
                style={{ ...pxFont, fontSize: '6px', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: slotConfig.kind === 'gen3plus' && slotConfig.ivs[0] === 0 ? 'var(--surface)' : 'var(--surface)',
                  color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                ZERO IVs
              </button>
              <button onClick={() => setStatConfig({ kind: 'gen12', dvs: [15,15,15,15,15], statExp: [0,0,0,0,0] })}
                style={{ ...pxFont, fontSize: '6px', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                  background: slotConfig.kind === 'gen12' ? 'var(--blue)' : 'var(--surface)',
                  color: slotConfig.kind === 'gen12' ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)' }}>
                GEN 1/2
              </button>
            </div>
          </div>

          {/* Held Item */}
          <div>
            <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>HELD ITEM</div>
            <select value={slotHeldItem?.name ?? ''} onChange={e => {
              const item = HELD_ITEM_LIST.find(i => i.name === e.target.value) ?? null
              setHeldItem(item)
            }} style={{ ...pxFont, fontSize: '6px', background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', padding: '4px 8px', borderRadius: '3px', width: '100%' }}>
              <option value="">None</option>
              {HELD_ITEM_LIST.map(item => (
                <option key={item.name} value={item.name}>{item.displayName}</option>
              ))}
            </select>
          </div>

          {/* Move Picker */}
          <div>
            <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              MOVES ({slotMoveNames.length}/4)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflowY: 'auto',
              border: '1px solid var(--border)', borderRadius: '3px', padding: '4px' }}>
              {moves.filter(m => m.available).map(m => {
                const selected = slotMoveNames.includes(m.name)
                return (
                  <button key={m.name} onClick={() => toggleMove(m.name)}
                    disabled={!selected && slotMoveNames.length >= 4}
                    style={{ ...pxFont, fontSize: '6px', textAlign: 'left', padding: '3px 6px', borderRadius: '2px', cursor: 'pointer',
                      background: selected ? 'var(--header)' : 'var(--surface)',
                      color: selected ? '#fff' : 'var(--text)', border: '1px solid var(--border)',
                      opacity: !selected && slotMoveNames.length >= 4 ? 0.4 : 1 }}>
                    {m.name.toUpperCase().replace(/-/g, ' ')}
                    {m.requiredLevel != null && (
                      <span style={{ color: selected ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', marginLeft: '6px' }}>
                        Lv.{m.requiredLevel}
                      </span>
                    )}
                  </button>
                )
              })}
              {moves.filter(m => !m.available).length > 0 && (
                <div style={{ ...pxFont, fontSize: '5px', color: 'var(--text-muted)', padding: '4px 6px' }}>
                  — NOT YET LEARNABLE —
                </div>
              )}
              {moves.filter(m => !m.available).map(m => (
                <button key={m.name} disabled
                  style={{ ...pxFont, fontSize: '6px', textAlign: 'left', padding: '3px 6px', borderRadius: '2px',
                    background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', opacity: 0.4, cursor: 'not-allowed' }}>
                  {m.name.toUpperCase().replace(/-/g, ' ')} (Lv.{m.requiredLevel})
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
        <Button onClick={onStart} disabled={!canStart || loadingStart}>
          {loadingStart ? 'LOADING...' : 'START BATTLE'}
        </Button>
        {onBack && <Button onClick={onBack} variant="secondary">BACK</Button>}
      </div>

      {teamIds.length === 0 && (
        <div style={{ ...pxFont, fontSize: '6px', color: 'var(--text-muted)' }}>
          Add Pokémon to your team first!
        </div>
      )}
    </div>
  )
}

// ── Ongoing Battle View ─────────────────────────────────────────────────────

function HpBar({ current, max, color = '#78c850' }: { current: number; max: number; color?: string }) {
  return (
    <div style={{ background: 'var(--border)', borderRadius: '3px', height: '8px', width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, (current / max) * 100)}%`, background: color, height: '100%', transition: 'width 0.3s' }} />
    </div>
  )
}

function PokemonPanel({ pokemon, color }: { pokemon: BattlePokemon; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <SpriteImage id={pokemon.id} name={pokemon.name} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text)' }}>
            {pokemon.name.toUpperCase()} Lv.{pokemon.level}
          </div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            HP {pokemon.currentHp}/{pokemon.maxHp}
          </div>
          <HpBar current={pokemon.currentHp} max={pokemon.maxHp} color={color} />
        </div>
      </div>
    </div>
  )
}

function OngoingView({
  state, onMove, onSwitch, onForfeit,
}: {
  state: Extract<BattleState, { phase: 'ongoing' }>
  onMove: (idx: number) => void
  onSwitch: (idx: number) => void
  onForfeit: () => void
}) {
  const [showSwitch, setShowSwitch] = useState(false)
  const player = state.playerTeam[state.playerActiveIndex]
  const opponent = state.opponentTeam[state.opponentActiveIndex]
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [state.log])

  if (showSwitch) {
    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--gold)' }}>SWITCH POKÉMON</div>
        {state.playerTeam.map((p, i) => {
          if (i === state.playerActiveIndex) return null
          const fainted = p.currentHp <= 0
          return (
            <button key={i} onClick={() => { setShowSwitch(false); onSwitch(i) }} disabled={fainted}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px',
                cursor: fainted ? 'not-allowed' : 'pointer', opacity: fainted ? 0.4 : 1 }}>
              <SpriteImage id={p.id} name={p.name} size={32} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text)' }}>
                  {p.name.toUpperCase()} Lv.{p.level}
                </div>
                <HpBar current={p.currentHp} max={p.maxHp} />
              </div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>
                {fainted ? 'FAINTED' : `${p.currentHp}/${p.maxHp}`}
              </div>
            </button>
          )
        })}
        <Button variant="secondary" onClick={() => setShowSwitch(false)}>CANCEL</Button>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      <PokemonPanel pokemon={opponent} color="#f08030" />
      <PokemonPanel pokemon={player} color="#6890f0" />

      {/* Battle log */}
      <div ref={logRef} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px',
        padding: '8px', flex: 1, overflowY: 'auto', maxHeight: '120px' }}>
        {state.log.slice(-12).map((l, i) => (
          <div key={i} style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', lineHeight: '1.8' }}>{l}</div>
        ))}
      </div>

      {/* Move buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        {player.moves.slice(0, 4).map((m, i) => (
          <Button key={i} onClick={() => onMove(i)} variant="secondary"
            disabled={m.currentPp <= 0}
            style={{ fontSize: '6px', padding: '6px', textAlign: 'center' }}>
            <div>{m.name.toUpperCase().replace(/-/g, ' ')}</div>
            <div style={{ fontSize: '5px', opacity: 0.6 }}>{m.type.toUpperCase()} • {m.currentPp}/{m.pp} PP</div>
          </Button>
        ))}
      </div>

      {/* Switch + Forfeit */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {state.playerTeam.length > 1 && (
          <Button variant="secondary" onClick={() => setShowSwitch(true)} style={{ flex: 1, fontSize: '6px' }}>
            SWITCH
          </Button>
        )}
        <Button variant="secondary" onClick={onForfeit} style={{ flex: 1, fontSize: '6px', color: '#c03028' }}>
          FORFEIT
        </Button>
      </div>
    </div>
  )
}

// ── Pending Switch View ─────────────────────────────────────────────────────

function PendingSwitchView({
  state, onConfirm,
}: {
  state: Extract<BattleState, { phase: 'pending_switch' }>
  onConfirm: (idx: number) => void
}) {
  const fainted = state.playerTeam[state.playerActiveIndex]
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: '#c03028' }}>
        {fainted.name.toUpperCase()} FAINTED!
      </div>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>
        Choose your next Pokémon:
      </div>
      {state.playerTeam.map((p, i) => {
        if (i === state.playerActiveIndex || p.currentHp <= 0) return null
        return (
          <button key={i} onClick={() => onConfirm(i)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer' }}>
            <SpriteImage id={p.id} name={p.name} size={40} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text)' }}>
                {p.name.toUpperCase()} Lv.{p.level}
              </div>
              <HpBar current={p.currentHp} max={p.maxHp} />
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginTop: '2px' }}>
                HP {p.currentHp}/{p.maxHp}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Battle End View ─────────────────────────────────────────────────────────

function BattleEndView({
  won, trainer, log, onRematch, onBack,
}: {
  won: boolean
  trainer?: Trainer
  log: string[]
  onRematch: () => void
  onBack?: () => void
}) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '16px', color: won ? '#f0c040' : '#c03028' }}>
        {won ? 'VICTORY!' : 'DEFEAT'}
      </div>
      {trainer && (
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text-muted)' }}>
          {won ? `You defeated ${trainer.name.toUpperCase()}!` : `${trainer.name.toUpperCase()} won!`}
        </div>
      )}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px',
        padding: '8px', maxHeight: '120px', overflowY: 'auto' }}>
        {log.slice(-10).map((l, i) => (
          <div key={i} style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', lineHeight: '1.8' }}>{l}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button onClick={onRematch}>REMATCH</Button>
        {onBack && <Button variant="secondary" onClick={onBack}>BACK</Button>}
      </div>
    </div>
  )
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export function TurnBattleScreen({ teamIds, trainer, onBack }: Props) {
  const [setup, setSetup] = useState<BattleSetup>(() => defaultSetup())
  const [battleState, setBattleState] = useState<BattleState | null>(null)
  const [loadingStart, setLoadingStart] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useWildRecords()
  const { recordBattle: recordTrainer } = useTrainerRecords()

  // Record result on battle end
  useEffect(() => {
    if (!battleState) return
    if (battleState.phase === 'won') {
      if (trainer) recordTrainer({ trainerId: trainer.id, name: trainer.name, title: trainer.title, region: trainer.region, trainerClass: trainer.trainerClass, typeSpecialty: trainer.typeSpecialty }, true)
    } else if (battleState.phase === 'lost') {
      if (trainer) recordTrainer({ trainerId: trainer.id, name: trainer.name, title: trainer.title, region: trainer.region, trainerClass: trainer.trainerClass, typeSpecialty: trainer.typeSpecialty }, false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState?.phase])

  const buildBaseStats = (detail: PokemonDetail): Record<string, number> => {
    const map: Record<string, number> = {}
    for (const s of detail.stats) map[s.stat.name] = s.base_stat
    return map
  }

  const startBattleFromSetup = useCallback(async () => {
    if (teamIds.length === 0) return
    setLoadingStart(true)
    setError(null)
    try {
      const playerTeam: BattlePokemon[] = await Promise.all(
        teamIds.map(async (id, idx) => {
          const detail = await fetchPokemonDetail(id)
          const ov = setup.teamOverrides[idx]
          const level = ov?.level ?? setup.level
          const statConfig = ov?.statConfig ?? setup.statConfig
          const nature = ov?.nature ?? setup.nature
          const heldItem = ov?.heldItem !== undefined ? ov.heldItem : setup.heldItem
          const allMoves = learnableMoves(detail, level)
          const moveNames = idx === 0
            ? (setup.selectedMoveNames.length > 0 ? setup.selectedMoveNames : allMoves.filter(m => m.available).slice(0, 4).map(m => m.name))
            : (ov?.selectedMoveNames ?? allMoves.filter(m => m.available).slice(0, 4).map(m => m.name))
          const moves = await resolveMoves(moveNames)
          return buildBattlePokemon(detail.id, detail.name, detail.types.map(t => t.type.name), buildBaseStats(detail), level, moves, statConfig, nature, heldItem)
        })
      )

      let opponentTeam: BattlePokemon[]
      let initialLog: string[]

      if (trainer) {
        const roster = trainer.rosters[0] ?? []
        opponentTeam = await Promise.all(
          roster.map(async tp => {
            const detail = await fetchPokemonDetail(tp.id)
            const moves = await resolveMoves(tp.moves.length > 0 ? tp.moves : learnableMoves(detail, tp.level).filter(m => m.available).slice(0, 4).map(m => m.name))
            return buildBattlePokemon(detail.id, detail.name, detail.types.map(t => t.type.name), buildBaseStats(detail), tp.level, moves)
          })
        )
        initialLog = [`${trainer.name.toUpperCase()} wants to battle!`, `${trainer.name.toUpperCase()} sent out ${opponentTeam[0].name.toUpperCase()}!`]
      } else {
        const list = await fetchPokemonList()
        const randomEntry = list[Math.floor(Math.random() * list.length)]
        const detail = await fetchPokemonDetail(randomEntry.id)
        const moves = await resolveMoves(learnableMoves(detail, setup.level).filter(m => m.available).slice(0, 4).map(m => m.name))
        opponentTeam = [buildBattlePokemon(detail.id, detail.name, detail.types.map(t => t.type.name), buildBaseStats(detail), setup.level, moves)]
        initialLog = [`A wild ${detail.name.toUpperCase()} appeared!`]
      }

      setBattleState(startBattle(playerTeam, opponentTeam, initialLog))
    } catch (e) {
      setError(`Failed to start battle: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoadingStart(false)
    }
  }, [teamIds, setup, trainer])

  const handleMove = useCallback((moveIdx: number) => {
    if (!battleState || battleState.phase !== 'ongoing') return
    const player = battleState.playerTeam[battleState.playerActiveIndex]
    const move = player.moves[moveIdx]
    if (!move) return
    const playerAction: TurnAction = { kind: 'use_move', move }
    const aiAction = aiPickAction(
      battleState.opponentTeam[battleState.opponentActiveIndex],
      player,
      battleState.opponentTeam,
      setup.gen
    )
    setBattleState(resolveTurn(playerAction, aiAction, battleState, setup.gen))
  }, [battleState, setup.gen])

  const handleSwitch = useCallback((targetIndex: number) => {
    if (!battleState || battleState.phase !== 'ongoing') return
    const player = battleState.playerTeam[battleState.playerActiveIndex]
    const playerAction: TurnAction = { kind: 'switch_to', targetIndex }
    const aiAction = aiPickAction(
      battleState.opponentTeam[battleState.opponentActiveIndex],
      player,
      battleState.opponentTeam,
      setup.gen
    )
    setBattleState(resolveTurn(playerAction, aiAction, battleState, setup.gen))
  }, [battleState, setup.gen])

  const handleConfirmSwitch = useCallback((newIndex: number) => {
    if (!battleState || battleState.phase !== 'pending_switch') return
    setBattleState(confirmSwitch(newIndex, battleState))
  }, [battleState])

  const handleForfeit = useCallback(() => {
    if (!battleState || battleState.phase !== 'ongoing') return
    setBattleState({ phase: 'lost', log: [...battleState.log, 'You forfeited.'] })
    if (trainer) recordTrainer({ trainerId: trainer.id, name: trainer.name, title: trainer.title, region: trainer.region, trainerClass: trainer.trainerClass, typeSpecialty: trainer.typeSpecialty }, false)
  }, [battleState, trainer, recordTrainer])

  const handleRematch = useCallback(() => {
    setBattleState(null)
    setError(null)
  }, [])

  if (error) {
    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: '#c03028' }}>{error}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={handleRematch}>TRY AGAIN</Button>
          {onBack && <Button variant="secondary" onClick={onBack}>BACK</Button>}
        </div>
      </div>
    )
  }

  if (!battleState) {
    return (
      <SetupView
        teamIds={teamIds}
        trainer={trainer}
        setup={setup}
        onSetupChange={setSetup}
        onStart={startBattleFromSetup}
        onBack={onBack}
        loadingStart={loadingStart}
      />
    )
  }

  if (battleState.phase === 'ongoing') {
    return (
      <OngoingView
        state={battleState}
        onMove={handleMove}
        onSwitch={handleSwitch}
        onForfeit={handleForfeit}
      />
    )
  }

  if (battleState.phase === 'pending_switch') {
    return <PendingSwitchView state={battleState} onConfirm={handleConfirmSwitch} />
  }

  return (
    <BattleEndView
      won={battleState.phase === 'won'}
      trainer={trainer}
      log={battleState.log}
      onRematch={handleRematch}
      onBack={onBack}
    />
  )
}
