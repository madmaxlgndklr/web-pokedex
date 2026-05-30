// src/test/battle/BattleEngine.test.ts
import { describe, it, expect } from 'vitest'
import { resolvePlayerAttack, type BattlePokemon, type BattleMove } from '@/lib/battle/BattleEngine'

const mockChart = {
  fire: {
    double_damage_to: [{ name: 'grass' }, { name: 'ice' }],
    half_damage_to: [{ name: 'water' }],
    no_damage_to: [],
  },
}

const makePlayer = (): BattlePokemon => ({
  id: 6, name: 'charizard', level: 50, types: ['fire', 'flying'],
  currentHp: 100, maxHp: 100, stats: [100, 109, 78, 120, 85, 100],
  moves: [{ name: 'flamethrower', type: 'fire', category: 'special', power: 90, accuracy: 100, pp: 15, currentPp: 15 }],
})

const makeEnemy = (type: string): BattlePokemon => ({
  id: 1, name: 'bulbasaur', level: 50, types: [type],
  currentHp: 100, maxHp: 100, stats: [100, 80, 80, 80, 80, 80],
  moves: [],
})

describe('resolvePlayerAttack', () => {
  it('deals more damage to grass (super effective fire)', () => {
    const grassEnemy = makeEnemy('grass')
    const waterEnemy = makeEnemy('water')
    const { damage: vGrass } = resolvePlayerAttack(makePlayer(), grassEnemy, 0, mockChart)
    const { damage: vWater } = resolvePlayerAttack(makePlayer(), waterEnemy, 0, mockChart)
    expect(vGrass).toBeGreaterThan(vWater)
  })

  it('deals 0 damage on miss when accuracy forces miss', () => {
    const player = { ...makePlayer(), moves: [{ ...makePlayer().moves[0], accuracy: 0 }] }
    const { damage } = resolvePlayerAttack(player, makeEnemy('normal'), 0, mockChart)
    expect(damage).toBe(0)
  })

  it('returns fainted log when damage >= enemy HP', () => {
    const weakEnemy = { ...makeEnemy('grass'), currentHp: 1, maxHp: 1 }
    const { log } = resolvePlayerAttack(makePlayer(), weakEnemy, 0, mockChart)
    expect(log.toLowerCase()).toContain('fainted')
  })
})
