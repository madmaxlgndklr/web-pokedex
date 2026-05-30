// lib/battle/HeldItemEffect.ts
import type { HeldItem } from '@/lib/types'

export type HeldItemEffect =
  | { kind: 'stat_multiplier'; statIndex: number; factor: number }
  | { kind: 'damage_multiplier'; factor: number }
  | { kind: 'type_multiplier'; type: string; factor: number }
  | { kind: 'super_effective_boost'; factor: number }
  | { kind: 'none' }

const ITEM_EFFECTS: Record<string, HeldItemEffect> = {
  'choice-band':    { kind: 'stat_multiplier', statIndex: 1, factor: 1.5 },
  'choice-specs':   { kind: 'stat_multiplier', statIndex: 3, factor: 1.5 },
  'choice-scarf':   { kind: 'stat_multiplier', statIndex: 5, factor: 1.5 },
  'life-orb':       { kind: 'damage_multiplier', factor: 1.3 },
  'expert-belt':    { kind: 'super_effective_boost', factor: 1.2 },
  'muscle-band':    { kind: 'stat_multiplier', statIndex: 1, factor: 1.1 },
  'wise-glasses':   { kind: 'stat_multiplier', statIndex: 3, factor: 1.1 },
  'flame-orb':      { kind: 'none' },
  'toxic-orb':      { kind: 'none' },
}

const TYPE_ITEMS: [string, string, number][] = [
  ['charcoal', 'fire', 1.2], ['mystic-water', 'water', 1.2],
  ['miracle-seed', 'grass', 1.2], ['magnet', 'electric', 1.2],
  ['never-melt-ice', 'ice', 1.2], ['black-belt', 'fighting', 1.2],
  ['poison-barb', 'poison', 1.2], ['soft-sand', 'ground', 1.2],
  ['sharp-beak', 'flying', 1.2], ['twisted-spoon', 'psychic', 1.2],
  ['silver-powder', 'bug', 1.2], ['hard-stone', 'rock', 1.2],
  ['spell-tag', 'ghost', 1.2], ['dragon-fang', 'dragon', 1.2],
  ['black-glasses', 'dark', 1.2], ['metal-coat', 'steel', 1.2],
  ['silk-scarf', 'normal', 1.2], ['fairy-feather', 'fairy', 1.2],
]

export function getHeldItemEffect(item: HeldItem | null): HeldItemEffect {
  if (!item) return { kind: 'none' }
  const direct = ITEM_EFFECTS[item.name]
  if (direct) return direct
  const typeEntry = TYPE_ITEMS.find(([name]) => name === item.name)
  if (typeEntry) return { kind: 'type_multiplier', type: typeEntry[1], factor: typeEntry[2] }
  return { kind: 'none' }
}

export function applyHeldItemDamageMultiplier(
  effect: HeldItemEffect,
  moveType: string,
  typeMultiplier: number
): number {
  switch (effect.kind) {
    case 'damage_multiplier': return effect.factor
    case 'type_multiplier':   return effect.type === moveType ? effect.factor : 1
    case 'super_effective_boost': return typeMultiplier > 1 ? effect.factor : 1
    default: return 1
  }
}
