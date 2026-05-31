export type StatIndex = 0 | 1 | 2 | 3 | 4 | 5

export type StatConfig =
  | { kind: 'gen3plus'; ivs: number[]; evs: number[] }
  | { kind: 'gen12'; dvs: number[]; statExp: number[] }

export interface NatureData {
  name: string
  boosted: number | null
  dropped: number | null
}

// Kotlin-compatible Nature type (boostedStat / droppedStat)
export interface Nature {
  name: string
  boostedStat: number | null
  droppedStat: number | null
}

export const Natures = {
  HARDY:   { name: 'Hardy',   boostedStat: null, droppedStat: null } as Nature,
  LONELY:  { name: 'Lonely',  boostedStat: 1,    droppedStat: 2    } as Nature,
  BRAVE:   { name: 'Brave',   boostedStat: 1,    droppedStat: 5    } as Nature,
  ADAMANT: { name: 'Adamant', boostedStat: 1,    droppedStat: 3    } as Nature,
  NAUGHTY: { name: 'Naughty', boostedStat: 1,    droppedStat: 4    } as Nature,
  BOLD:    { name: 'Bold',    boostedStat: 2,    droppedStat: 1    } as Nature,
  DOCILE:  { name: 'Docile',  boostedStat: null, droppedStat: null } as Nature,
  RELAXED: { name: 'Relaxed', boostedStat: 2,    droppedStat: 5    } as Nature,
  IMPISH:  { name: 'Impish',  boostedStat: 2,    droppedStat: 3    } as Nature,
  LAX:     { name: 'Lax',     boostedStat: 2,    droppedStat: 4    } as Nature,
  TIMID:   { name: 'Timid',   boostedStat: 5,    droppedStat: 1    } as Nature,
  HASTY:   { name: 'Hasty',   boostedStat: 5,    droppedStat: 2    } as Nature,
  SERIOUS: { name: 'Serious', boostedStat: null, droppedStat: null } as Nature,
  JOLLY:   { name: 'Jolly',   boostedStat: 5,    droppedStat: 3    } as Nature,
  NAIVE:   { name: 'Naive',   boostedStat: 5,    droppedStat: 4    } as Nature,
  MODEST:  { name: 'Modest',  boostedStat: 3,    droppedStat: 1    } as Nature,
  MILD:    { name: 'Mild',    boostedStat: 3,    droppedStat: 2    } as Nature,
  QUIET:   { name: 'Quiet',   boostedStat: 3,    droppedStat: 5    } as Nature,
  BASHFUL: { name: 'Bashful', boostedStat: null, droppedStat: null } as Nature,
  RASH:    { name: 'Rash',    boostedStat: 3,    droppedStat: 4    } as Nature,
  CALM:    { name: 'Calm',    boostedStat: 4,    droppedStat: 1    } as Nature,
  GENTLE:  { name: 'Gentle',  boostedStat: 4,    droppedStat: 2    } as Nature,
  SASSY:   { name: 'Sassy',   boostedStat: 4,    droppedStat: 5    } as Nature,
  CAREFUL: { name: 'Careful', boostedStat: 4,    droppedStat: 3    } as Nature,
  QUIRKY:  { name: 'Quirky',  boostedStat: null, droppedStat: null } as Nature,
  ALL: [] as Nature[],
}

Natures.ALL = [
  Natures.HARDY, Natures.LONELY, Natures.BRAVE, Natures.ADAMANT, Natures.NAUGHTY,
  Natures.BOLD, Natures.DOCILE, Natures.RELAXED, Natures.IMPISH, Natures.LAX,
  Natures.TIMID, Natures.HASTY, Natures.SERIOUS, Natures.JOLLY, Natures.NAIVE,
  Natures.MODEST, Natures.MILD, Natures.QUIET, Natures.BASHFUL, Natures.RASH,
  Natures.CALM, Natures.GENTLE, Natures.SASSY, Natures.CAREFUL, Natures.QUIRKY,
]

// Unified stat index (Gen3+ convention): 0=HP, 1=Atk, 2=Def, 3=SpAtk, 4=SpDef, 5=Spe
// For Gen12Config: 3→4 (Spc), 4→4 (Spc), 5→3 (Spe)
function gen12SlotFor(idx: number): number {
  if (idx === 3 || idx === 4) return 4
  if (idx === 5) return 3
  return idx
}

export const StatFormulas = {
  natureMultiplier(nature: Nature, statIndex: number): number {
    if (statIndex === 0) return 1
    if (statIndex === nature.boostedStat) return 1.1
    if (statIndex === nature.droppedStat) return 0.9
    return 1
  },

  computeStat(base: number, config: StatConfig, nature: Nature, statIndex: number, level: number): number {
    if (config.kind === 'gen12') {
      const slot = gen12SlotFor(statIndex)
      const dv = config.dvs[slot] ?? 0
      const se = config.statExp[slot] ?? 0
      const inner = (base + dv) * 2 + Math.floor(Math.floor(Math.sqrt(se)) / 4)
      return Math.floor(inner * level / 100) + 5
    }
    const iv = config.ivs[statIndex] ?? 31
    const ev = config.evs[statIndex] ?? 0
    const inner = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5
    return Math.floor(inner * this.natureMultiplier(nature, statIndex))
  },

  computeHp(base: number, config: StatConfig, level: number): number {
    if (config.kind === 'gen12') {
      const dv = config.dvs[0] ?? 15
      const se = config.statExp[0] ?? 0
      const inner = (base + dv) * 2 + Math.floor(Math.floor(Math.sqrt(se)) / 4)
      return Math.floor(inner * level / 100) + level + 10
    }
    const iv = config.ivs[0] ?? 31
    const ev = config.evs[0] ?? 0
    return Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10
  },

  isEvSumValid(evs: number[]): boolean {
    return evs.reduce((a, b) => a + b, 0) <= 510
  },
}

const STAT_NAMES = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'] as const

function statIndex(name: string): number {
  return STAT_NAMES.indexOf(name as typeof STAT_NAMES[number])
}

interface Gen3Params {
  base: number
  iv: number
  ev: number
  level: number
  natureModifier?: number
}

interface Gen12Params {
  base: number
  dv: number
  statExp: number
  level: number
  gen?: number
}

interface HpParams {
  base: number
  iv: number
  ev: number
  level: number
}

export function calcStat(params: Gen3Params | Gen12Params): number {
  if ('iv' in params && 'ev' in params && !('dv' in params)) {
    const { base, iv, ev, level, natureModifier = 1 } = params as Gen3Params
    const inner = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5
    return Math.floor(inner * natureModifier)
  }
  const { base, dv, statExp, level } = params as Gen12Params
  const statExpSqrt = Math.min(255, Math.floor(Math.ceil(Math.sqrt(statExp))))
  return Math.floor(((base + dv) * 2 + Math.floor(statExpSqrt / 4)) * level / 100) + 5
}

export function calcHp({ base, iv, ev, level }: HpParams): number {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
}

export function applyNature(value: number, statName: string, nature: NatureData): number {
  const idx = statIndex(statName)
  if (nature.boosted === idx) return Math.floor(value * 1.1)
  if (nature.dropped === idx) return Math.floor(value * 0.9)
  return value
}

export function resolveStats(
  baseStats: number[],
  config: StatConfig,
  level: number,
  nature: NatureData
): number[] {
  return baseStats.map((base, i) => {
    if (i === 0) {
      if (config.kind === 'gen3plus') return calcHp({ base, iv: config.ivs[0], ev: config.evs[0], level })
      return calcStat({ base, dv: config.dvs[0], statExp: config.statExp[0], level })
    }
    let stat: number
    if (config.kind === 'gen3plus') {
      stat = calcStat({ base, iv: config.ivs[i], ev: config.evs[i], level })
      stat = applyNature(stat, STAT_NAMES[i], nature)
    } else {
      stat = calcStat({ base, dv: config.dvs[i] ?? 0, statExp: config.statExp[i] ?? 0, level })
    }
    return stat
  })
}
