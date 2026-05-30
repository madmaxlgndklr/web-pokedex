import { describe, it, expect } from 'vitest'
import { calcStat, calcHp, applyNature } from '@/lib/battle/StatConfig'

describe('Gen 3+ stat calc', () => {
  it('calculates Garchomp attack at level 100, 31 IV, 252 EV, +atk nature', () => {
    // Base ATK = 130, IV = 31, EV = 252, level = 100, nature = 1.1
    // inner = floor((2*130 + 31 + floor(252/4)) * 100 / 100) + 5 = floor(354) + 5 = 359
    // with nature: floor(359 * 1.1) = 394
    const stat = calcStat({ base: 130, iv: 31, ev: 252, level: 100, natureModifier: 1.1 })
    expect(stat).toBe(394)
  })

  it('calculates HP separately', () => {
    // Blissey HP: base=255, iv=31, ev=252, level=100
    // floor((2*255 + 31 + floor(252/4)) * 100 / 100) + 100 + 10 = floor(595) + 110 = 705
    // But with more precise calculation: floor((2*255 + 31 + 63) * 100 / 100) + 100 + 10 = floor(604) + 110 = 714
    const hp = calcHp({ base: 255, iv: 31, ev: 252, level: 100 })
    expect(hp).toBe(714)
  })
})

describe('Gen 1/2 stat calc', () => {
  it('calculates stat with DVs and stat exp', () => {
    // Base 100, DV 15, statExp 65535 → max gen1 stat at level 100
    const stat = calcStat({ base: 100, dv: 15, statExp: 65535, level: 100, gen: 1 })
    expect(stat).toBeGreaterThan(0)
  })
})

describe('applyNature', () => {
  it('boosts the correct stat', () => {
    expect(applyNature(100, 'attack', { name: 'Adamant', boosted: 1, dropped: 3 })).toBe(110)
  })

  it('drops the correct stat', () => {
    expect(applyNature(100, 'special-attack', { name: 'Adamant', boosted: 1, dropped: 3 })).toBe(90)
  })

  it('neutral nature does nothing', () => {
    expect(applyNature(100, 'attack', { name: 'Hardy', boosted: null, dropped: null })).toBe(100)
  })
})
