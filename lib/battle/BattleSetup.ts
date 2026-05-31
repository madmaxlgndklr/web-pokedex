import { fetchMove } from '@/lib/api'
import { Natures } from './StatConfig'
import type { StatConfig, Nature } from './StatConfig'
import type { HeldItem, PokemonDetail } from '@/lib/types'
import type { BattleMove } from './BattleEngine'

export interface LearnableMove {
  name: string
  requiredLevel: number | null  // null = TM/egg/tutor (always available)
  available: boolean
}

export interface SlotOverride {
  level?: number
  statConfig?: StatConfig
  nature?: Nature
  heldItem?: HeldItem | null
  selectedMoveNames?: string[]
}

export interface BattleSetup {
  gen: number
  level: number
  selectedMoveNames: string[]
  statConfig: StatConfig
  nature: Nature
  heldItem?: HeldItem | null
  teamOverrides: Record<number, SlotOverride>
}

export function defaultSetup(): BattleSetup {
  return {
    gen: 5,
    level: 50,
    selectedMoveNames: [],
    statConfig: { kind: 'gen3plus', ivs: [31,31,31,31,31,31], evs: [0,0,0,0,0,0] },
    nature: Natures.HARDY,
    heldItem: null,
    teamOverrides: {},
  }
}

// Derive learnable moves from a web-shaped PokemonDetail.
// Level-up moves gated by current level; TM/egg/tutor always available.
export function learnableMoves(detail: PokemonDetail, level: number): LearnableMove[] {
  const byName = new Map<string, { minLevel: number; hasNonLevelUp: boolean }>()

  for (const ref of detail.moves) {
    const name = ref.move.name
    const existing = byName.get(name) ?? { minLevel: Infinity, hasNonLevelUp: false }
    let { minLevel, hasNonLevelUp } = existing

    for (const vgd of ref.version_group_details) {
      if (vgd.move_learn_method.name === 'level-up') {
        minLevel = Math.min(minLevel, vgd.level_learned_at)
      } else {
        hasNonLevelUp = true
      }
    }

    byName.set(name, { minLevel, hasNonLevelUp })
  }

  return Array.from(byName.entries())
    .map(([name, { minLevel, hasNonLevelUp }]): LearnableMove => {
      if (hasNonLevelUp) return { name, requiredLevel: null, available: true }
      const reqLevel = minLevel === Infinity ? 1 : minLevel
      return { name, requiredLevel: reqLevel, available: reqLevel <= level }
    })
    .sort((a, b) => {
      // TMs (null) first, then by level, then alphabetically
      if (a.requiredLevel === null && b.requiredLevel !== null) return -1
      if (a.requiredLevel !== null && b.requiredLevel === null) return 1
      const la = a.requiredLevel ?? 0
      const lb = b.requiredLevel ?? 0
      if (la !== lb) return la - lb
      return a.name.localeCompare(b.name)
    })
}

// Fetch real move data from the API for each move name.
export async function resolveMoves(moveNames: string[]): Promise<BattleMove[]> {
  const resolved = await Promise.all(
    moveNames.map(async name => {
      try {
        const m = await fetchMove(name)
        return {
          name: m.name,
          type: m.type.name,
          category: m.damage_class.name as BattleMove['category'],
          power: m.power ?? 0,
          accuracy: m.accuracy ?? 100,
          pp: m.pp,
          currentPp: m.pp,
        }
      } catch {
        return { name, type: 'normal', category: 'physical' as const, power: 50, accuracy: 100, pp: 20, currentPp: 20 }
      }
    })
  )
  if (resolved.length === 0) {
    return [{ name: 'struggle', type: 'normal', category: 'physical', power: 50, accuracy: 100, pp: 1, currentPp: 1 }]
  }
  return resolved
}

// Common battle-relevant held items for the item picker UI
export const HELD_ITEM_LIST: HeldItem[] = [
  { id: 1, name: 'choice-band',    displayName: 'Choice Band',    effectSummary: '+50% Atk, locked to one move' },
  { id: 2, name: 'choice-specs',   displayName: 'Choice Specs',   effectSummary: '+50% SpAtk, locked to one move' },
  { id: 3, name: 'choice-scarf',   displayName: 'Choice Scarf',   effectSummary: '+50% Speed, locked to one move' },
  { id: 4, name: 'life-orb',       displayName: 'Life Orb',       effectSummary: '+30% damage' },
  { id: 5, name: 'expert-belt',    displayName: 'Expert Belt',    effectSummary: '+20% damage on super-effective hits' },
  { id: 6, name: 'muscle-band',    displayName: 'Muscle Band',    effectSummary: '+10% physical moves' },
  { id: 7, name: 'wise-glasses',   displayName: 'Wise Glasses',   effectSummary: '+10% special moves' },
  { id: 8, name: 'charcoal',       displayName: 'Charcoal',       effectSummary: '+20% Fire moves' },
  { id: 9, name: 'mystic-water',   displayName: 'Mystic Water',   effectSummary: '+20% Water moves' },
  { id: 10, name: 'magnet',        displayName: 'Magnet',         effectSummary: '+20% Electric moves' },
  { id: 11, name: 'miracle-seed',  displayName: 'Miracle Seed',   effectSummary: '+20% Grass moves' },
  { id: 12, name: 'never-melt-ice',displayName: 'Never-Melt Ice', effectSummary: '+20% Ice moves' },
  { id: 13, name: 'black-belt',    displayName: 'Black Belt',     effectSummary: '+20% Fighting moves' },
  { id: 14, name: 'poison-barb',   displayName: 'Poison Barb',    effectSummary: '+20% Poison moves' },
  { id: 15, name: 'soft-sand',     displayName: 'Soft Sand',      effectSummary: '+20% Ground moves' },
  { id: 16, name: 'sharp-beak',    displayName: 'Sharp Beak',     effectSummary: '+20% Flying moves' },
  { id: 17, name: 'twisted-spoon', displayName: 'Twisted Spoon',  effectSummary: '+20% Psychic moves' },
  { id: 18, name: 'silver-powder', displayName: 'Silver Powder',  effectSummary: '+20% Bug moves' },
  { id: 19, name: 'hard-stone',    displayName: 'Hard Stone',     effectSummary: '+20% Rock moves' },
  { id: 20, name: 'spell-tag',     displayName: 'Spell Tag',      effectSummary: '+20% Ghost moves' },
  { id: 21, name: 'dragon-fang',   displayName: 'Dragon Fang',    effectSummary: '+20% Dragon moves' },
  { id: 22, name: 'black-glasses', displayName: 'Black Glasses',  effectSummary: '+20% Dark moves' },
  { id: 23, name: 'metal-coat',    displayName: 'Metal Coat',     effectSummary: '+20% Steel moves' },
  { id: 24, name: 'silk-scarf',    displayName: 'Silk Scarf',     effectSummary: '+20% Normal moves' },
  { id: 25, name: 'fairy-feather', displayName: 'Fairy Feather',  effectSummary: '+20% Fairy moves' },
  // Plates
  { id: 26, name: 'flame-plate',   displayName: 'Flame Plate',    effectSummary: '+20% Fire moves' },
  { id: 27, name: 'splash-plate',  displayName: 'Splash Plate',   effectSummary: '+20% Water moves' },
  { id: 28, name: 'zap-plate',     displayName: 'Zap Plate',      effectSummary: '+20% Electric moves' },
  { id: 29, name: 'meadow-plate',  displayName: 'Meadow Plate',   effectSummary: '+20% Grass moves' },
  { id: 30, name: 'icicle-plate',  displayName: 'Icicle Plate',   effectSummary: '+20% Ice moves' },
  { id: 31, name: 'fist-plate',    displayName: 'Fist Plate',     effectSummary: '+20% Fighting moves' },
  { id: 32, name: 'toxic-plate',   displayName: 'Toxic Plate',    effectSummary: '+20% Poison moves' },
  { id: 33, name: 'earth-plate',   displayName: 'Earth Plate',    effectSummary: '+20% Ground moves' },
  { id: 34, name: 'sky-plate',     displayName: 'Sky Plate',      effectSummary: '+20% Flying moves' },
  { id: 35, name: 'mind-plate',    displayName: 'Mind Plate',     effectSummary: '+20% Psychic moves' },
  { id: 36, name: 'insect-plate',  displayName: 'Insect Plate',   effectSummary: '+20% Bug moves' },
  { id: 37, name: 'stone-plate',   displayName: 'Stone Plate',    effectSummary: '+20% Rock moves' },
  { id: 38, name: 'spooky-plate',  displayName: 'Spooky Plate',   effectSummary: '+20% Ghost moves' },
  { id: 39, name: 'draco-plate',   displayName: 'Draco Plate',    effectSummary: '+20% Dragon moves' },
  { id: 40, name: 'dread-plate',   displayName: 'Dread Plate',    effectSummary: '+20% Dark moves' },
  { id: 41, name: 'iron-plate',    displayName: 'Iron Plate',     effectSummary: '+20% Steel moves' },
  { id: 42, name: 'pixie-plate',   displayName: 'Pixie Plate',    effectSummary: '+20% Fairy moves' },
]

// ── Shared config serialization (matches Android's BattleConfigDto) ──────────
//
// JSON schema:
// { gen, level, moves, nature, statConfig: {type, arr1, arr2}, heldItem, slots: {"1": {...}} }
//
// Android ignores unknown fields, so `gen` is a safe web-only addition.

interface SharedStatConfig { type: string; arr1: number[]; arr2: number[] }

function statConfigToShared(sc: StatConfig): SharedStatConfig {
  if (sc.kind === 'gen12') return { type: 'gen12', arr1: [...sc.dvs], arr2: [...sc.statExp] }
  return { type: 'gen3plus', arr1: [...sc.ivs], arr2: [...sc.evs] }
}

function sharedToStatConfig(dto: unknown): StatConfig {
  if (!dto || typeof dto !== 'object') return { kind: 'gen3plus', ivs: [31,31,31,31,31,31], evs: [0,0,0,0,0,0] }
  const d = dto as SharedStatConfig
  if (d.type === 'gen12') return { kind: 'gen12', dvs: d.arr1 ?? [15,15,15,15,15], statExp: d.arr2 ?? [0,0,0,0,0] }
  return { kind: 'gen3plus', ivs: d.arr1 ?? [31,31,31,31,31,31], evs: d.arr2 ?? [0,0,0,0,0,0] }
}

export function setupToConfig(setup: BattleSetup): Record<string, unknown> {
  return {
    gen: setup.gen,
    level: setup.level,
    moves: setup.selectedMoveNames,
    nature: setup.nature.name,
    statConfig: statConfigToShared(setup.statConfig),
    heldItem: setup.heldItem ?? null,
    slots: Object.fromEntries(
      Object.entries(setup.teamOverrides).map(([k, ov]) => [k, {
        level: ov.level ?? null,
        nature: ov.nature?.name ?? null,
        moves: ov.selectedMoveNames ?? null,
        statConfig: ov.statConfig ? statConfigToShared(ov.statConfig) : null,
        heldItem: ov.heldItem ?? null,
      }])
    ),
  }
}

export function configToSetup(raw: unknown): BattleSetup {
  const c = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const def = defaultSetup()
  const gen   = typeof c.gen   === 'number' ? c.gen                              : def.gen
  const level = typeof c.level === 'number' ? Math.max(1, Math.min(100, c.level)) : def.level
  const moves = Array.isArray(c.moves)
    ? (c.moves as unknown[]).filter((m): m is string => typeof m === 'string')
    : []
  const natureName = typeof c.nature === 'string' ? c.nature : 'Hardy'
  const nature = Natures.ALL.find(n => n.name.toLowerCase() === natureName.toLowerCase()) ?? Natures.HARDY
  const statConfig = sharedToStatConfig(c.statConfig)
  const heldItem = (c.heldItem && typeof c.heldItem === 'object') ? c.heldItem as HeldItem : null

  const slotsRaw = (c.slots && typeof c.slots === 'object') ? c.slots as Record<string, unknown> : {}
  const teamOverrides: Record<number, SlotOverride> = {}
  for (const [k, v] of Object.entries(slotsRaw)) {
    const idx = parseInt(k)
    if (isNaN(idx) || !v || typeof v !== 'object') continue
    const sv = v as Record<string, unknown>
    const ovNature = typeof sv.nature === 'string'
      ? (Natures.ALL.find(n => n.name.toLowerCase() === sv.nature.toLowerCase()) ?? undefined)
      : undefined
    teamOverrides[idx] = {
      level:             typeof sv.level === 'number' ? sv.level : undefined,
      nature:            ovNature,
      selectedMoveNames: Array.isArray(sv.moves)
        ? (sv.moves as unknown[]).filter((m): m is string => typeof m === 'string')
        : undefined,
      statConfig:  sv.statConfig ? sharedToStatConfig(sv.statConfig) : undefined,
      heldItem:    (sv.heldItem && typeof sv.heldItem === 'object') ? sv.heldItem as HeldItem : undefined,
    }
  }

  return { gen, level, selectedMoveNames: moves, statConfig, nature, heldItem, teamOverrides }
}
