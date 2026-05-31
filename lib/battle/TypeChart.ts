// lib/battle/TypeChart.ts
// Gen-9 type effectiveness table. CHART[attackType][defenderType] = multiplier.

const CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, steel: 0.5, ghost: 0 },
  fire:     { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water:    { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  grass:    { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
  ice:      { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, bug: 0.5, flying: 0.5, psychic: 0.5, fairy: 0.5, ghost: 0 },
  poison:   { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground:   { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying:   { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug:      { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, poison: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost:    { ghost: 2, psychic: 2, dark: 0.5, normal: 0 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { ghost: 2, psychic: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel:    { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy:    { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
}

export function computeEffectiveness(gen: number, moveType: string, defenderTypes: string[]): number {
  const filtered = gen === 1
    ? defenderTypes.filter(t => t !== 'steel' && t !== 'dark' && t !== 'fairy')
    : gen <= 5
    ? defenderTypes.filter(t => t !== 'fairy')
    : defenderTypes
  const row = CHART[moveType] ?? {}
  return filtered.reduce((acc, defType) => acc * (row[defType] ?? 1), 1)
}

export function effectivenessLabel(e: number): string {
  if (e === 0) return '0×'
  if (e <= 0.26) return '0.25×'
  if (e <= 0.51) return '0.5×'
  if (e <= 1.01) return '1×'
  if (e <= 2.01) return '2×'
  return '4×'
}
