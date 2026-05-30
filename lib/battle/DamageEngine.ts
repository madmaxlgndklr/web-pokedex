// lib/battle/DamageEngine.ts

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
