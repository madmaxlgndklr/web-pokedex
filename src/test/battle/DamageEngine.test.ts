import { describe, it, expect } from 'vitest'
import { calcDamage } from '@/lib/battle/DamageEngine'

describe('calcDamage', () => {
  it('calculates base damage', () => {
    const dmg = calcDamage({
      level: 50, power: 80,
      attack: 100, defense: 100,
      stabMultiplier: 1, typeMultiplier: 1, critMultiplier: 1, randomFactor: 1,
    })
    expect(dmg).toBeGreaterThan(0)
    expect(dmg).toBeLessThan(200)
  })

  it('STAB doubles with 1.5x multiplier', () => {
    const noStab = calcDamage({ level: 50, power: 80, attack: 100, defense: 100, stabMultiplier: 1, typeMultiplier: 1, critMultiplier: 1, randomFactor: 1 })
    const stab   = calcDamage({ level: 50, power: 80, attack: 100, defense: 100, stabMultiplier: 1.5, typeMultiplier: 1, critMultiplier: 1, randomFactor: 1 })
    expect(Math.abs(stab - noStab * 1.5)).toBeLessThan(1)
  })

  it('super effective doubles damage', () => {
    const normal = calcDamage({ level: 50, power: 80, attack: 100, defense: 100, stabMultiplier: 1, typeMultiplier: 1, critMultiplier: 1, randomFactor: 1 })
    const super_  = calcDamage({ level: 50, power: 80, attack: 100, defense: 100, stabMultiplier: 1, typeMultiplier: 2, critMultiplier: 1, randomFactor: 1 })
    expect(Math.abs(super_ - normal * 2)).toBeLessThan(1)
  })

  it('crit doubles damage', () => {
    const normal = calcDamage({ level: 50, power: 80, attack: 100, defense: 100, stabMultiplier: 1, typeMultiplier: 1, critMultiplier: 1, randomFactor: 1 })
    const crit   = calcDamage({ level: 50, power: 80, attack: 100, defense: 100, stabMultiplier: 1, typeMultiplier: 1, critMultiplier: 2, randomFactor: 1 })
    expect(Math.abs(crit - normal * 2)).toBeLessThan(1)
  })
})
