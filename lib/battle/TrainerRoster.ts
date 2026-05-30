// lib/battle/TrainerRoster.ts

export interface TrainerPokemon {
  id: number
  name: string
  level: number
  moves: string[]
  heldItem?: string
}

export interface Trainer {
  id: string
  name: string
  title: string
  region: string
  trainerClass: 'GYM_LEADER' | 'ELITE_FOUR' | 'CHAMPION' | 'RIVAL' | 'TRAINER'
  typeSpecialty: string
  rosters: TrainerPokemon[][]
}

export async function loadTrainers(): Promise<Trainer[]> {
  const res = await fetch('/trainers/trainers.json')
  if (!res.ok) return []
  return res.json()
}
