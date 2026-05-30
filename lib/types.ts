// lib/types.ts

export interface PokemonSummary {
  id: number
  name: string
}

export interface PokemonType {
  slot: number
  type: { name: string }
}

export interface Stat {
  base_stat: number
  effort: number
  stat: { name: string }
}

export interface MoveRef {
  move: { name: string; url: string }
  version_group_details: {
    level_learned_at: number
    move_learn_method: { name: string }
    version_group: { name: string }
  }[]
}

export interface Sprites {
  front_default: string | null
  front_shiny: string | null
}

export interface PokemonDetail {
  id: number
  name: string
  types: PokemonType[]
  stats: Stat[]
  moves: MoveRef[]
  sprites: Sprites
  species: { name: string; url: string }
  base_experience: number | null
  height: number
  weight: number
}

export interface PokemonSpecies {
  id: number
  name: string
  flavor_text_entries: {
    flavor_text: string
    language: { name: string }
    version: { name: string }
  }[]
  evolution_chain: { url: string }
  genera: { genus: string; language: { name: string } }[]
  gender_rate: number
  capture_rate: number
  is_legendary: boolean
  is_mythical: boolean
}

export interface ChainLink {
  species: { name: string; url: string }
  evolves_to: ChainLink[]
  evolution_details: {
    min_level: number | null
    item: { name: string } | null
    trigger: { name: string }
  }[]
}

export interface EvolutionChain {
  id: number
  chain: ChainLink
}

export interface MoveDetail {
  id: number
  name: string
  type: { name: string }
  damage_class: { name: string }
  power: number | null
  accuracy: number | null
  pp: number
  priority: number
  effect_entries: {
    effect: string
    short_effect: string
    language: { name: string }
  }[]
  learned_by_pokemon: { name: string; url: string }[]
}

export interface HeldItem {
  id: number
  name: string
  displayName: string
  effectSummary: string
}

export interface TrainerRecord {
  trainerId: string
  name: string
  title: string
  region: string
  trainerClass: string
  typeSpecialty: string
  wins: number
  losses: number
  firstDefeatedAt?: number
  lastBattledAt: number
}

export interface WildRecord {
  pokemonId: number
  pokemonName: string
  wins: number
  losses: number
  lastBattledAt: number
}
