// lib/battle/DamageEngine.ts
import { computeEffectiveness, effectivenessLabel } from './TypeChart'
import { StatFormulas } from './StatConfig'
import type { StatConfig, Nature } from './StatConfig'

// ── Gen-aware engine (new API) ──────────────────────────────────────────────

const GEN23_PHYSICAL = new Set([
  'normal', 'fighting', 'flying', 'poison', 'ground',
  'rock', 'bug', 'ghost', 'steel',
])

export function isPhysicalGen23(moveType: string): boolean {
  return GEN23_PHYSICAL.has(moveType)
}

export interface GenDamageParams {
  gen: number
  level: number
  attackBaseStat: number
  defenseBaseStat: number
  attackStatIndex: number
  defenseStatIndex: number
  attackerStatConfig: StatConfig
  attackerNature: Nature
  defenderStatConfig: StatConfig
  defenderNature: Nature
  heldItemName?: string | null
  basePower: number
  moveType: string
  moveCategory: string
  attackerTypes: string[]
  defenderTypes: string[]
  criticalHit?: boolean
}

export interface DamageResult {
  min: number
  max: number
  average: number
  effectivenessLabel: string
}

export function calculate(p: GenDamageParams): DamageResult {
  if (p.moveCategory === 'status' || p.basePower === 0) {
    return { min: 0, max: 0, average: 0, effectivenessLabel: '—' }
  }

  const effectiveness = computeEffectiveness(p.gen, p.moveType, p.defenderTypes)
  const stab = p.attackerTypes.includes(p.moveType) ? 1.5 : 1

  let atk = StatFormulas.computeStat(
    p.attackBaseStat, p.attackerStatConfig, p.attackerNature, p.attackStatIndex, p.level
  )
  const def = StatFormulas.computeStat(
    p.defenseBaseStat, p.defenderStatConfig, p.defenderNature, p.defenseStatIndex, p.level
  )

  // Apply stat-boosting held items (e.g. Choice Band)
  const itemName = p.heldItemName ?? ''
  if (itemName === 'choice-band' && p.attackStatIndex === 1) atk = Math.floor(atk * 1.5)
  if (itemName === 'choice-specs' && p.attackStatIndex === 3) atk = Math.floor(atk * 1.5)
  if (itemName === 'muscle-band' && p.attackStatIndex === 1) atk = Math.floor(atk * 1.1)
  if (itemName === 'wise-glasses' && p.attackStatIndex === 3) atk = Math.floor(atk * 1.1)

  const base = Math.floor(
    Math.floor(2 * p.level / 5 + 2) * p.basePower * atk / def / 50
  ) + 2

  const critMult = !p.criticalHit ? 1 : p.gen <= 5 ? 2 : 1.5
  const [randMin, randMax] = p.gen === 1 ? [217 / 255, 1] : [0.85, 1]

  const applyItemFinal = (dmg: number): number => {
    if (itemName === 'life-orb') return Math.floor(dmg * 1.3)
    if (itemName === 'expert-belt' && effectiveness > 1) return Math.floor(dmg * 1.2)
    // Type-boosting items
    const typeItems: Record<string, string> = {
      'charcoal': 'fire', 'mystic-water': 'water', 'magnet': 'electric',
      'miracle-seed': 'grass', 'never-melt-ice': 'ice', 'black-belt': 'fighting',
      'poison-barb': 'poison', 'soft-sand': 'ground', 'sharp-beak': 'flying',
      'twisted-spoon': 'psychic', 'silver-powder': 'bug', 'hard-stone': 'rock',
      'spell-tag': 'ghost', 'dragon-fang': 'dragon', 'black-glasses': 'dark',
      'metal-coat': 'steel', 'fairy-feather': 'fairy', 'silk-scarf': 'normal',
      'flame-plate': 'fire', 'splash-plate': 'water', 'zap-plate': 'electric',
      'meadow-plate': 'grass', 'icicle-plate': 'ice', 'fist-plate': 'fighting',
      'toxic-plate': 'poison', 'earth-plate': 'ground', 'sky-plate': 'flying',
      'mind-plate': 'psychic', 'insect-plate': 'bug', 'stone-plate': 'rock',
      'spooky-plate': 'ghost', 'draco-plate': 'dragon', 'dread-plate': 'dark',
      'iron-plate': 'steel', 'pixie-plate': 'fairy',
    }
    if (typeItems[itemName] === p.moveType) return Math.floor(dmg * 1.2)
    return dmg
  }

  const finalDamage = (rand: number): number => {
    const dmg = Math.max(1, Math.round(base * stab * effectiveness * critMult * rand))
    return applyItemFinal(dmg)
  }

  const min = finalDamage(randMin)
  const max = finalDamage(randMax)
  const avg = finalDamage((randMin + randMax) / 2)

  return { min, max, average: avg, effectivenessLabel: effectivenessLabel(effectiveness) }
}

// ── Legacy API (kept for DamageCalcScreen backward compat) ──────────────────

export interface DamageParams {
  level: number
  power: number
  attack: number
  defense: number
  stabMultiplier: number
  typeMultiplier: number
  critMultiplier: number
  randomFactor: number
  heldItemMultiplier?: number
}

export function calcDamage(p: DamageParams): number {
  const base = Math.floor(
    (Math.floor((2 * p.level) / 5 + 2) * p.power * p.attack) / p.defense / 50 + 2
  )
  return Math.floor(
    base
    * p.critMultiplier
    * p.randomFactor
    * p.stabMultiplier
    * p.typeMultiplier
    * (p.heldItemMultiplier ?? 1)
  )
}

export function randomFactor(): number {
  return (85 + Math.floor(Math.random() * 16)) / 100
}

export function getTypeEffectiveness(
  moveType: string,
  defenderTypes: string[],
  chart: Record<string, { double_damage_to: {name:string}[]; half_damage_to: {name:string}[]; no_damage_to: {name:string}[] }>
): number {
  const relations = chart[moveType]
  if (!relations) return 1
  return defenderTypes.reduce((mult, defType) => {
    if (relations.no_damage_to.some(t => t.name === defType)) return mult * 0
    if (relations.double_damage_to.some(t => t.name === defType)) return mult * 2
    if (relations.half_damage_to.some(t => t.name === defType)) return mult * 0.5
    return mult
  }, 1)
}

export function calcDamageRange(p: Omit<DamageParams, 'randomFactor'>): { min: number; max: number } {
  return {
    min: calcDamage({ ...p, randomFactor: 0.85 }),
    max: calcDamage({ ...p, randomFactor: 1.00 }),
  }
}
