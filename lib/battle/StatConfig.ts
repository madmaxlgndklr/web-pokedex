export type StatIndex = 0 | 1 | 2 | 3 | 4 | 5

export type StatConfig =
  | { kind: 'gen3plus'; ivs: number[]; evs: number[] }
  | { kind: 'gen12'; dvs: number[]; statExp: number[] }

export interface NatureData {
  name: string
  boosted: number | null
  dropped: number | null
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
