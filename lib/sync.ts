// lib/sync.ts
// I/O layer: pulls from Supabase, writes to Dexie, pushes diffs back.
// Import pure merge functions from sync-merge to keep them testable.

import { supabase } from './supabase'
import { db } from './db'
import type { TrainerRecord, WildRecord } from './types'
import {
  mergeCaughtPokemon,
  mergeTeam,
  mergeTrainerRecords,
  mergeWildRecords,
  mergeBattleConfig,
  mergeSettings,
} from './sync-merge'

export type {
  RemoteCaughtRow,
  RemoteTeamRow,
  RemoteTrainerRow,
  RemoteWildRow,
  RemoteBattleConfigRow,
  RemoteSettingsRow,
  RemoteState,
  LocalSettings,
} from './sync-merge'

export {
  mergeCaughtPokemon,
  mergeTeam,
  mergeTrainerRecords,
  mergeWildRecords,
  mergeBattleConfig,
  mergeSettings,
} from './sync-merge'

import type {
  RemoteCaughtRow,
  RemoteTeamRow,
  RemoteTrainerRow,
  RemoteWildRow,
  RemoteBattleConfigRow,
  RemoteSettingsRow,
  RemoteState,
  LocalSettings,
} from './sync-merge'

// ---- I/O functions ----

export async function pullAll(userId: string): Promise<RemoteState> {
  const [caught, team, trainers, wild, config, settings] = await Promise.all([
    supabase.from('caught_pokemon').select('pokemon_id, caught_at').eq('user_id', userId),
    supabase.from('team').select('team_json, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('trainer_records').select('*').eq('user_id', userId),
    supabase.from('wild_records').select('*').eq('user_id', userId),
    supabase.from('battle_config').select('config_json, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('settings').select('generation, music_on_launch, updated_at').eq('user_id', userId).maybeSingle(),
  ])

  const errors = [caught.error, team.error, trainers.error, wild.error, config.error, settings.error].filter(Boolean)
  if (errors.length > 0) throw new Error(`Supabase pull failed: ${errors.map(e => e!.message).join('; ')}`)

  return {
    caughtPokemon: (caught.data ?? []) as RemoteCaughtRow[],
    team: team.data as RemoteTeamRow | null,
    trainerRecords: (trainers.data ?? []) as RemoteTrainerRow[],
    wildRecords: (wild.data ?? []) as RemoteWildRow[],
    battleConfig: config.data as RemoteBattleConfigRow | null,
    settings: settings.data ? (settings.data as RemoteSettingsRow) : null,
  }
}

async function getLocalSettings(): Promise<LocalSettings> {
  const [gen, music, ts] = await Promise.all([
    db.settings.get('generation'),
    db.settings.get('musicOnLaunch'),
    db.settings.get('settings_updated_at'),
  ])
  return {
    generation: gen ? parseInt(gen.value) : 3,
    musicOnLaunch: music?.value === 'true',
    updatedAt: ts ? parseInt(ts.value) : 0,
  }
}

async function getLocalTeamUpdatedAt(): Promise<number> {
  const ts = await db.settings.get('team_updated_at')
  return ts ? parseInt(ts.value) : 0
}

async function getLocalBattleConfigUpdatedAt(): Promise<number> {
  const ts = await db.settings.get('battle_config_updated_at')
  return ts ? parseInt(ts.value) : 0
}

export async function writeLocal(
  remote: RemoteState,
  localCaughtIds: number[],
  localTeam: number[],
  localTrainers: TrainerRecord[],
  localWild: WildRecord[],
  localBattleConfig: string,
  localSettings: LocalSettings,
): Promise<void> {
  const now = Date.now()
  const localTeamUpdatedAt = await getLocalTeamUpdatedAt()
  const localBattleConfigUpdatedAt = await getLocalBattleConfigUpdatedAt()

  const mergedCaught = mergeCaughtPokemon(localCaughtIds, remote.caughtPokemon.map(r => r.pokemon_id))
  const remoteTeamIds = remote.team ? (remote.team.team_json as number[]) : null
  const mergedTeam = mergeTeam(localTeam, localTeamUpdatedAt, remoteTeamIds, remote.team?.updated_at ?? null)
  const mergedTrainers = mergeTrainerRecords(localTrainers, remote.trainerRecords)
  const mergedWild = mergeWildRecords(localWild, remote.wildRecords)
  const remoteConfigJson = remote.battleConfig ? JSON.stringify(remote.battleConfig.config_json) : null
  const mergedBattleConfig = mergeBattleConfig(localBattleConfig, localBattleConfigUpdatedAt, remoteConfigJson, remote.battleConfig?.updated_at ?? null)
  const remoteSettings = remote.settings
    ? { generation: remote.settings.generation, musicOnLaunch: remote.settings.music_on_launch, updatedAt: remote.settings.updated_at }
    : null
  const mergedSettings = mergeSettings(localSettings, remoteSettings)

  await db.transaction('rw', [db.caught_pokemon, db.team, db.trainer_records, db.wild_records, db.battle_config, db.settings], async () => {
    await db.caught_pokemon.clear()
    await db.caught_pokemon.bulkAdd(mergedCaught.map(id => ({ pokemonId: id })))

    await db.team.clear()
    const teamSlots = mergedTeam.map((id, i) => ({ slot: i, pokemonId: id }))
    if (teamSlots.length > 0) await db.team.bulkPut(teamSlots)

    await db.trainer_records.clear()
    if (mergedTrainers.length > 0) await db.trainer_records.bulkPut(mergedTrainers)

    await db.wild_records.clear()
    if (mergedWild.length > 0) await db.wild_records.bulkPut(mergedWild)

    await db.battle_config.clear()
    if (mergedBattleConfig) await db.battle_config.put({ slot: 0, configJson: mergedBattleConfig })

    await db.settings.bulkPut([
      { key: 'generation', value: String(mergedSettings.generation) },
      { key: 'musicOnLaunch', value: String(mergedSettings.musicOnLaunch) },
      { key: 'settings_updated_at', value: String(mergedSettings.updatedAt || now) },
    ])
  })
}

export async function pushDiff(
  userId: string,
  remote: RemoteState,
  localCaughtIds: number[],
  localTrainers: TrainerRecord[],
  localWild: WildRecord[]
): Promise<void> {
  const remoteCaughtIds = new Set(remote.caughtPokemon.map(r => r.pokemon_id))
  const missingCaught = localCaughtIds.filter(id => !remoteCaughtIds.has(id))
  if (missingCaught.length > 0) {
    await supabase.from('caught_pokemon').upsert(
      missingCaught.map(id => ({ user_id: userId, pokemon_id: id, caught_at: Date.now() }))
    )
  }

  // trainer_records — upsert all local (not just missing)
  if (localTrainers.length > 0) {
    await supabase.from('trainer_records').upsert(
      localTrainers.map(t => ({
        user_id: userId,
        trainer_id: t.trainerId,
        name: t.name,
        title: t.title,
        region: t.region,
        trainer_class: t.trainerClass,
        type_specialty: t.typeSpecialty,
        wins: t.wins,
        losses: t.losses,
        first_defeated_at: t.firstDefeatedAt ?? null,
        last_battled_at: t.lastBattledAt,
      }))
    )
  }

  // wild_records — upsert all local (not just missing)
  if (localWild.length > 0) {
    await supabase.from('wild_records').upsert(
      localWild.map(w => ({
        user_id: userId,
        pokemon_id: w.pokemonId,
        pokemon_name: w.pokemonName,
        wins: w.wins,
        losses: w.losses,
        last_battled_at: w.lastBattledAt,
      }))
    )
  }
}

export async function syncOnOpen(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const [localCaught, localTeam, localTrainers, localWild, localBattleConfigRow, localSettings] = await Promise.all([
    db.caught_pokemon.toArray().then(r => r.map(c => c.pokemonId)),
    db.team.orderBy('slot').toArray().then(r => r.map(s => s.pokemonId)),
    db.trainer_records.toArray(),
    db.wild_records.toArray(),
    db.battle_config.get(0),
    getLocalSettings(),
  ])
  const localBattleConfig = localBattleConfigRow?.configJson ?? '{}'

  const remote = await pullAll(user.id)
  await writeLocal(remote, localCaught, localTeam, localTrainers, localWild, localBattleConfig, localSettings)
  await pushDiff(user.id, remote, localCaught, localTrainers, localWild)
}

// ---- Fire-and-forget push functions ----

export async function pushCaughtToggle(userId: string, pokemonId: number, isCaught: boolean): Promise<void> {
  if (isCaught) {
    await supabase.from('caught_pokemon').upsert({ user_id: userId, pokemon_id: pokemonId, caught_at: Date.now() })
  } else {
    await supabase.from('caught_pokemon').delete().eq('user_id', userId).eq('pokemon_id', pokemonId)
  }
}

export async function pushTeam(userId: string, teamIds: number[]): Promise<void> {
  const now = Date.now()
  await supabase.from('team').upsert({ user_id: userId, team_json: teamIds, updated_at: now })
  await db.settings.put({ key: 'team_updated_at', value: String(now) })
}

export async function pushTrainerRecord(userId: string, record: TrainerRecord): Promise<void> {
  await supabase.from('trainer_records').upsert({
    user_id: userId,
    trainer_id: record.trainerId,
    name: record.name,
    title: record.title,
    region: record.region,
    trainer_class: record.trainerClass,
    type_specialty: record.typeSpecialty,
    wins: record.wins,
    losses: record.losses,
    first_defeated_at: record.firstDefeatedAt ?? null,
    last_battled_at: record.lastBattledAt,
  })
}

export async function pushWildRecord(userId: string, record: WildRecord): Promise<void> {
  await supabase.from('wild_records').upsert({
    user_id: userId,
    pokemon_id: record.pokemonId,
    pokemon_name: record.pokemonName,
    wins: record.wins,
    losses: record.losses,
    last_battled_at: record.lastBattledAt,
  })
}

export async function pushBattleConfig(userId: string, configJson: string): Promise<void> {
  const now = Date.now()
  await supabase.from('battle_config').upsert({
    user_id: userId,
    config_json: JSON.parse(configJson),
    updated_at: now,
  })
  await db.settings.put({ key: 'battle_config_updated_at', value: String(now) })
}

export async function pushSettings(userId: string, generation: number, musicOnLaunch: boolean): Promise<void> {
  const now = Date.now()
  await supabase.from('settings').upsert({
    user_id: userId,
    generation,
    music_on_launch: musicOnLaunch,
    updated_at: now,
  })
  await db.settings.put({ key: 'settings_updated_at', value: String(now) })
}
