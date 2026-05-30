// lib/db.ts
import Dexie, { type Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { TrainerRecord, WildRecord } from './types'
import { supabase } from './supabase'
import {
  pushCaughtToggle,
  pushTeam,
  pushTrainerRecord,
  pushWildRecord,
  pushBattleConfig,
  pushSettings,
} from './sync'

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

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export function useCaughtPokemon() {
  const caught = useLiveQuery(
    () => db.caught_pokemon.toArray().then(r => new Set(r.map(c => c.pokemonId))),
    [],
    new Set<number>()
  )
  const toggle = async (pokemonId: number) => {
    const isCaught = caught?.has(pokemonId) ?? false
    if (isCaught) {
      await db.caught_pokemon.delete(pokemonId)
    } else {
      await db.caught_pokemon.add({ pokemonId })
    }
    const userId = await getUserId()
    if (userId) pushCaughtToggle(userId, pokemonId, !isCaught).catch(() => {})
  }
  return { caught: caught ?? new Set<number>(), toggle }
}

export function useTeam() {
  const slots = useLiveQuery(() => db.team.orderBy('slot').toArray(), [], [])
  const teamIds = (slots ?? []).map(s => s.pokemonId)
  const add = async (pokemonId: number) => {
    if (teamIds.length >= 6) return
    await db.team.put({ slot: teamIds.length, pokemonId })
    const newTeam = [...teamIds, pokemonId]
    const userId = await getUserId()
    if (userId) pushTeam(userId, newTeam).catch(() => {})
  }
  const remove = async (pokemonId: number) => {
    const all = slots ?? []
    const idx = all.findIndex(s => s.pokemonId === pokemonId)
    if (idx === -1) return
    await db.team.clear()
    const remaining = all.filter(s => s.pokemonId !== pokemonId)
    await db.team.bulkPut(remaining.map((s, i) => ({ slot: i, pokemonId: s.pokemonId })))
    const newTeam = remaining.map(s => s.pokemonId)
    const userId = await getUserId()
    if (userId) pushTeam(userId, newTeam).catch(() => {})
  }
  return { teamIds, add, remove }
}

export function useBattleConfig(slot: number) {
  const record = useLiveQuery(() => db.battle_config.get(slot), [slot])
  const config = record ? JSON.parse(record.configJson) : null
  const save = async (configData: unknown) => {
    const configJson = JSON.stringify(configData)
    await db.battle_config.put({ slot, configJson })
    const userId = await getUserId()
    if (userId) pushBattleConfig(userId, configJson).catch(() => {})
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
    let updatedRecord: TrainerRecord
    if (existing) {
      updatedRecord = {
        ...existing,
        wins: existing.wins + (won ? 1 : 0),
        losses: existing.losses + (won ? 0 : 1),
        firstDefeatedAt: won && !existing.firstDefeatedAt ? now : existing.firstDefeatedAt,
        lastBattledAt: now,
      }
      await db.trainer_records.update(trainerData.trainerId, {
        wins: updatedRecord.wins,
        losses: updatedRecord.losses,
        firstDefeatedAt: updatedRecord.firstDefeatedAt,
        lastBattledAt: updatedRecord.lastBattledAt,
      })
    } else {
      updatedRecord = {
        ...trainerData,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        firstDefeatedAt: won ? now : undefined,
        lastBattledAt: now,
      }
      await db.trainer_records.add(updatedRecord)
    }
    const userId = await getUserId()
    if (userId) pushTrainerRecord(userId, updatedRecord).catch(() => {})
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
    let updatedRecord: WildRecord
    if (existing) {
      updatedRecord = {
        ...existing,
        wins: existing.wins + (won ? 1 : 0),
        losses: existing.losses + (won ? 0 : 1),
        lastBattledAt: now,
      }
      await db.wild_records.update(pokemonId, {
        wins: updatedRecord.wins,
        losses: updatedRecord.losses,
        lastBattledAt: updatedRecord.lastBattledAt,
      })
    } else {
      updatedRecord = {
        pokemonId, pokemonName,
        wins: won ? 1 : 0, losses: won ? 0 : 1,
        lastBattledAt: now,
      }
      await db.wild_records.add(updatedRecord)
    }
    const userId = await getUserId()
    if (userId) pushWildRecord(userId, updatedRecord).catch(() => {})
  }
  return { records: records ?? [], recordBattle }
}

export function useSetting(key: string, defaultValue: string): [string, (v: string) => Promise<void>] {
  const record = useLiveQuery(() => db.settings.get(key), [key])
  const value = record?.value ?? defaultValue
  const set = async (v: string) => {
    await db.settings.put({ key, value: v })
    if (key === 'generation' || key === 'musicOnLaunch') {
      const [genRow, musicRow] = await Promise.all([db.settings.get('generation'), db.settings.get('musicOnLaunch')])
      const generation = key === 'generation' ? parseInt(v) : parseInt(genRow?.value ?? '3')
      const musicOnLaunch = key === 'musicOnLaunch' ? v === 'true' : musicRow?.value === 'true'
      const userId = await getUserId()
      if (userId) pushSettings(userId, generation, musicOnLaunch).catch(() => {})
    }
  }
  return [value, set]
}
