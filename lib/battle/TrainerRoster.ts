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

interface RawRoster { label: string; team: TrainerPokemon[] }
interface RawTrainer { id: string; name: string; title: string; trainerClass: Trainer['trainerClass']; typeSpecialty: string; rosters: RawRoster[] }
interface RawRegion { name: string; trainers: RawTrainer[] }

export async function loadTrainers(): Promise<Trainer[]> {
  const res = await fetch('/trainers/trainers.json')
  if (!res.ok) return []
  const data: { regions: RawRegion[] } = await res.json()
  return (data.regions ?? []).flatMap(r =>
    r.trainers.map(t => ({
      ...t,
      region: r.name,
      typeSpecialty: t.typeSpecialty.toLowerCase(),
      rosters: t.rosters.map(roster => roster.team),
    }))
  )
}
