// lib/db.ts
import Dexie, { type Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { TrainerRecord, WildRecord } from './types'

interface CaughtPokemon { pokemonId: number }
interface TeamSlot { slot: number; pokemonId: number }
interface BattleConfig { slot: number; configJson: string }
interface Setting { key: string; value: string }

class PokedexDB extends Dexie {
  caught_pokemon!: Table<CaughtPokemon>
  team!: Table<TeamSlot>
  battle_config!: Table<BattleConfig>
  trainer_records!: Table<TrainerRecord>
  wild_records!: Table<WildRecord>
  settings!: Table<Setting>

  constructor() {
    super('pokedex')
    this.version(1).stores({
      caught_pokemon: 'pokemonId',
      team: 'slot',
      battle_config: 'slot',
      trainer_records: 'trainerId',
      wild_records: 'pokemonId',
      settings: 'key',
    })
    this.version(2).stores({
      trainer_records: 'trainerId, lastBattledAt',
    })
  }
}

export const db = new PokedexDB()

export function useCaughtPokemon() {
  const caught = useLiveQuery(
    () => db.caught_pokemon.toArray().then(r => new Set(r.map(c => c.pokemonId))),
    [],
    new Set<number>()
  )
  const toggle = async (pokemonId: number) => {
    if (caught?.has(pokemonId)) {
      await db.caught_pokemon.delete(pokemonId)
    } else {
      await db.caught_pokemon.add({ pokemonId })
    }
  }
  return { caught: caught ?? new Set<number>(), toggle }
}

export function useTeam() {
  const slots = useLiveQuery(() => db.team.orderBy('slot').toArray(), [], [])
  const teamIds = (slots ?? []).map(s => s.pokemonId)
  const add = async (pokemonId: number) => {
    if (teamIds.length >= 6) return
    await db.team.put({ slot: teamIds.length, pokemonId })
  }
  const remove = async (pokemonId: number) => {
    const all = slots ?? []
    const idx = all.findIndex(s => s.pokemonId === pokemonId)
    if (idx === -1) return
    await db.team.clear()
    const remaining = all.filter(s => s.pokemonId !== pokemonId)
    await db.team.bulkPut(remaining.map((s, i) => ({ slot: i, pokemonId: s.pokemonId })))
  }
  return { teamIds, add, remove }
}

export function useBattleConfig(slot: number) {
  const record = useLiveQuery(() => db.battle_config.get(slot), [slot])
  const config = record ? JSON.parse(record.configJson) : null
  const save = async (configData: unknown) => {
    await db.battle_config.put({ slot, configJson: JSON.stringify(configData) })
  }
  return { config, save }
}

export function useTrainerRecords() {
  const records = useLiveQuery(
    () => db.trainer_records.orderBy('lastBattledAt').reverse().toArray(),
    [],
    [] as TrainerRecord[]
  )
  const recordBattle = async (
    trainerData: Omit<TrainerRecord, 'wins' | 'losses' | 'firstDefeatedAt' | 'lastBattledAt'>,
    won: boolean
  ) => {
    const existing = await db.trainer_records.get(trainerData.trainerId)
    const now = Date.now()
    if (existing) {
      await db.trainer_records.update(trainerData.trainerId, {
        wins: existing.wins + (won ? 1 : 0),
        losses: existing.losses + (won ? 0 : 1),
        firstDefeatedAt: won && !existing.firstDefeatedAt ? now : existing.firstDefeatedAt,
        lastBattledAt: now,
      })
    } else {
      await db.trainer_records.add({
        ...trainerData,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        firstDefeatedAt: won ? now : undefined,
        lastBattledAt: now,
      })
    }
  }
  return { records: records ?? [], recordBattle }
}

export function useWildRecords() {
  const records = useLiveQuery(
    () => db.wild_records.toArray().then(r => r.sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))),
    [],
    [] as WildRecord[]
  )
  const recordBattle = async (pokemonId: number, pokemonName: string, won: boolean) => {
    const existing = await db.wild_records.get(pokemonId)
    const now = Date.now()
    if (existing) {
      await db.wild_records.update(pokemonId, {
        wins: existing.wins + (won ? 1 : 0),
        losses: existing.losses + (won ? 0 : 1),
        lastBattledAt: now,
      })
    } else {
      await db.wild_records.add({
        pokemonId, pokemonName,
        wins: won ? 1 : 0, losses: won ? 0 : 1,
        lastBattledAt: now,
      })
    }
  }
  return { records: records ?? [], recordBattle }
}

export function useSetting(key: string, defaultValue: string): [string, (v: string) => Promise<void>] {
  const record = useLiveQuery(() => db.settings.get(key), [key])
  const value = record?.value ?? defaultValue
  const set = async (v: string) => { await db.settings.put({ key, value: v }) }
  return [value, set]
}
