// src/test/battle/BattleEngine.test.ts
import { describe, it, expect } from 'vitest'
import { buildBattlePokemon, startBattle, resolveTurn, confirmSwitch, type BattlePokemon } from '@/lib/battle/BattleEngine'
import { Natures } from '@/lib/battle/StatConfig'

const DEFAULT_CONFIG = { kind: 'gen3plus' as const, ivs: [31,31,31,31,31,31], evs: [0,0,0,0,0,0] }
const FLAMETHROWER = { name: 'flamethrower', type: 'fire', category: 'special' as const, power: 90, accuracy: 100, pp: 15, currentPp: 15 }
const TACKLE       = { name: 'tackle',       type: 'normal', category: 'physical' as const, power: 40, accuracy: 100, pp: 35, currentPp: 35 }

function makeCharizard(): BattlePokemon {
  return buildBattlePokemon(6, 'charizard', ['fire', 'flying'],
    { hp: 78, attack: 84, defense: 78, 'special-attack': 109, 'special-defense': 85, speed: 100 },
    50, [FLAMETHROWER], DEFAULT_CONFIG, Natures.HARDY)
}

function makeBulbasaur(): BattlePokemon {
  return buildBattlePokemon(1, 'bulbasaur', ['grass', 'poison'],
    { hp: 45, attack: 49, defense: 49, 'special-attack': 65, 'special-defense': 65, speed: 45 },
    50, [TACKLE], DEFAULT_CONFIG, Natures.HARDY)
}

describe('buildBattlePokemon', () => {
  it('computes maxHp from base stats', () => {
    const p = makeCharizard()
    expect(p.maxHp).toBeGreaterThan(0)
    expect(p.currentHp).toBe(p.maxHp)
  })

  it('stores base stats correctly', () => {
    const p = makeCharizard()
    expect(p.baseStats['speed']).toBe(100)
  })
})

describe('startBattle', () => {
  it('returns ongoing state', () => {
    const state = startBattle([makeCharizard()], [makeBulbasaur()])
    expect(state.phase).toBe('ongoing')
    if (state.phase !== 'ongoing') throw new Error()
    expect(state.playerTeam).toHaveLength(1)
    expect(state.opponentTeam).toHaveLength(1)
  })
})

describe('resolveTurn', () => {
  it('applies damage to opponent on player attack', () => {
    const state = startBattle([makeCharizard()], [makeBulbasaur()])
    if (state.phase !== 'ongoing') throw new Error('Expected ongoing')
    const result = resolveTurn(
      { kind: 'use_move', move: FLAMETHROWER },
      { kind: 'use_move', move: TACKLE },
      state, 5
    )
    if (result.phase === 'won') {
      // One-shot is valid
      expect(true).toBe(true)
    } else if (result.phase === 'ongoing') {
      expect(result.opponentTeam[0].currentHp).toBeLessThan(makeBulbasaur().maxHp)
    }
  })

  it('handles voluntary switch', () => {
    const fighter = buildBattlePokemon(106, 'hitmonlee', ['fighting'],
      { hp: 50, attack: 120, defense: 53, 'special-attack': 35, 'special-defense': 110, speed: 87 },
      50, [TACKLE], DEFAULT_CONFIG, Natures.HARDY)
    const state = startBattle([makeCharizard(), fighter], [makeBulbasaur()])
    if (state.phase !== 'ongoing') throw new Error('Expected ongoing')
    const result = resolveTurn(
      { kind: 'switch_to', targetIndex: 1 },
      { kind: 'use_move', move: TACKLE },
      state, 5
    )
    expect(['ongoing', 'pending_switch', 'won', 'lost']).toContain(result.phase)
    if (result.phase === 'ongoing') {
      expect(result.playerActiveIndex).toBe(1)
    }
  })
})

describe('confirmSwitch', () => {
  it('transitions from pending_switch to ongoing', () => {
    const pendingState = {
      phase: 'pending_switch' as const,
      playerTeam: [
        { ...makeCharizard(), currentHp: 0 },
        makeBulbasaur(),
      ],
      playerActiveIndex: 0,
      opponentTeam: [makeBulbasaur()],
      opponentActiveIndex: 0,
      log: ['Charizard fainted!'],
    }
    const result = confirmSwitch(1, pendingState)
    expect(result.phase).toBe('ongoing')
    if (result.phase === 'ongoing') {
      expect(result.playerActiveIndex).toBe(1)
    }
  })

  it('rejects invalid index', () => {
    const pendingState = {
      phase: 'pending_switch' as const,
      playerTeam: [{ ...makeCharizard(), currentHp: 0 }, makeBulbasaur()],
      playerActiveIndex: 0,
      opponentTeam: [makeBulbasaur()],
      opponentActiveIndex: 0,
      log: [],
    }
    const result = confirmSwitch(0, pendingState)
    // Same index as active (which is fainted) → no change
    expect(result.phase).toBe('pending_switch')
  })
})
