// lib/sync-merge.ts
// Pure merge functions — no I/O, no browser dependencies, safe to import in tests.

import type { TrainerRecord, WildRecord } from './types'

// ---- Remote state types ----

export interface RemoteCaughtRow { pokemon_id: number; caught_at: number }
export interface RemoteTeamRow { team_json: number[]; updated_at: number }
export interface RemoteTrainerRow {
  trainer_id: string; name: string; title: string; region: string
  trainer_class: string; type_specialty: string
  wins: number; losses: number; first_defeated_at: number | null; last_battled_at: number
}
export interface RemoteWildRow {
  pokemon_id: number; pokemon_name: string
  wins: number; losses: number; last_battled_at: number
}
export interface RemoteBattleConfigRow { config_json: Record<string, unknown>; updated_at: number }
export interface RemoteSettingsRow { generation: number; music_on_launch: boolean; updated_at: number }

export interface RemoteState {
  caughtPokemon: RemoteCaughtRow[]
  team: RemoteTeamRow | null
  trainerRecords: RemoteTrainerRow[]
  wildRecords: RemoteWildRow[]
  battleConfig: RemoteBattleConfigRow | null
  settings: RemoteSettingsRow | null
}

export interface LocalSettings {
  generation: number
  musicOnLaunch: boolean
  updatedAt: number
}

// ---- Pure merge functions ----

export function mergeCaughtPokemon(localIds: number[], remoteIds: number[]): number[] {
  return Array.from(new Set([...localIds, ...remoteIds]))
}

export function mergeTeam(
  localTeam: number[], localUpdatedAt: number,
  remoteTeam: number[] | null, remoteUpdatedAt: number | null
): number[] {
  if (remoteTeam === null || remoteUpdatedAt === null) return localTeam
  return remoteUpdatedAt > localUpdatedAt ? remoteTeam : localTeam
}

export function mergeTrainerRecords(
  local: TrainerRecord[],
  remote: RemoteTrainerRow[]
): TrainerRecord[] {
  const map = new Map<string, TrainerRecord>()
  for (const r of local) map.set(r.trainerId, { ...r })
  for (const r of remote) {
    const existing = map.get(r.trainer_id)
    if (existing) {
      const localFirst = existing.firstDefeatedAt
      const remoteFirst = r.first_defeated_at ?? undefined
      map.set(r.trainer_id, {
        ...existing,
        wins: Math.max(existing.wins, r.wins),
        losses: Math.max(existing.losses, r.losses),
        firstDefeatedAt:
          localFirst !== undefined && remoteFirst !== undefined
            ? Math.min(localFirst, remoteFirst)
            : localFirst ?? remoteFirst,
        lastBattledAt: Math.max(existing.lastBattledAt, r.last_battled_at),
      })
    } else {
      map.set(r.trainer_id, {
        trainerId: r.trainer_id,
        name: r.name,
        title: r.title,
        region: r.region,
        trainerClass: r.trainer_class,
        typeSpecialty: r.type_specialty,
        wins: r.wins,
        losses: r.losses,
        firstDefeatedAt: r.first_defeated_at ?? undefined,
        lastBattledAt: r.last_battled_at,
      })
    }
  }
  return Array.from(map.values())
}

export function mergeWildRecords(local: WildRecord[], remote: RemoteWildRow[]): WildRecord[] {
  const map = new Map<number, WildRecord>()
  for (const r of local) map.set(r.pokemonId, { ...r })
  for (const r of remote) {
    const existing = map.get(r.pokemon_id)
    if (existing) {
      map.set(r.pokemon_id, {
        ...existing,
        wins: Math.max(existing.wins, r.wins),
        losses: Math.max(existing.losses, r.losses),
        lastBattledAt: Math.max(existing.lastBattledAt, r.last_battled_at),
      })
    } else {
      map.set(r.pokemon_id, {
        pokemonId: r.pokemon_id,
        pokemonName: r.pokemon_name,
        wins: r.wins,
        losses: r.losses,
        lastBattledAt: r.last_battled_at,
      })
    }
  }
  return Array.from(map.values())
}

export function mergeBattleConfig(
  localJson: string, localUpdatedAt: number,
  remoteJson: string | null, remoteUpdatedAt: number | null
): string {
  if (remoteJson === null || remoteUpdatedAt === null) return localJson
  return remoteUpdatedAt > localUpdatedAt ? remoteJson : localJson
}

export function mergeSettings(
  local: LocalSettings,
  remote: { generation: number; musicOnLaunch: boolean; updatedAt: number } | null
): LocalSettings {
  if (remote === null) return local
  return remote.updatedAt > local.updatedAt
    ? { generation: remote.generation, musicOnLaunch: remote.musicOnLaunch, updatedAt: remote.updatedAt }
    : local
}
