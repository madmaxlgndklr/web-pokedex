# Supabase Auth & Sync — Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase-backed anonymous-first authentication and cross-platform sync to the Next.js web Pokédex so user data (caught Pokémon, team, battle records, settings) persists across devices and matches the Android app.

**Architecture:** Local-first. Dexie (IndexedDB) is always the source of truth for reads. Supabase receives writes asynchronously (fire-and-forget) and is pulled from once on app open to reconcile state. Anonymous session created on first load; user can upgrade to Google or email account.

**Tech Stack:** Next.js 14 App Router, Dexie.js (existing), `@supabase/supabase-js`, Supabase Postgres + Auth (anonymous, Google OAuth, email).

**Spec:** `docs/superpowers/specs/2026-05-30-supabase-auth-sync-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/supabase.ts` | Supabase client singleton |
| Create | `lib/sync.ts` | All sync functions: push*, pullAll, mergeAll, writeLocal, pushDiff, syncOnOpen |
| Create | `lib/auth.ts` | Auth helper functions: signInAnonymously, signInWithEmail, signUpWithEmail, linkGoogle, signOut |
| Create | `src/test/sync.test.ts` | Unit tests for pure merge functions in sync.ts |
| Create | `components/auth/AuthProvider.tsx` | React context: initialises anonymous session, exposes user/session |
| Create | `components/auth/AccountBadge.tsx` | Nav component: sign-in prompt or signed-in state + sign-out |
| Create | `app/login/page.tsx` | Login sheet page: Google button + email sign-in + email create-account |
| Modify | `lib/db.ts` | After each write, call corresponding pushTo* from sync.ts |
| Modify | `app/layout.tsx` | Wrap children with `<AuthProvider>`, call syncOnOpen after auth ready |
| Modify | `.env.local` | Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY |

---

## Task 1: Supabase Project Setup (Manual)

**Files:** None (manual Supabase dashboard steps)

This task has no code. It must be done in the Supabase dashboard before any code can run.

- [ ] **Step 1: Create Supabase project**

  Go to supabase.com → New project. Note the Project URL and anon public key.

- [ ] **Step 2: Run schema SQL**

  In the Supabase SQL editor, run:

  ```sql
  create table caught_pokemon (
    user_id uuid references auth.users not null,
    pokemon_id integer not null,
    caught_at bigint not null default extract(epoch from now()) * 1000,
    primary key (user_id, pokemon_id)
  );

  create table team (
    user_id uuid references auth.users primary key,
    team_json jsonb not null default '[]',
    updated_at bigint not null default extract(epoch from now()) * 1000
  );

  create table trainer_records (
    user_id uuid references auth.users not null,
    trainer_id text not null,
    name text not null,
    title text not null,
    region text not null,
    trainer_class text not null,
    type_specialty text not null,
    wins integer not null default 0,
    losses integer not null default 0,
    first_defeated_at bigint,
    last_battled_at bigint not null,
    primary key (user_id, trainer_id)
  );

  create table wild_records (
    user_id uuid references auth.users not null,
    pokemon_id integer not null,
    pokemon_name text not null,
    wins integer not null default 0,
    losses integer not null default 0,
    last_battled_at bigint not null,
    primary key (user_id, pokemon_id)
  );

  create table battle_config (
    user_id uuid references auth.users primary key,
    config_json jsonb not null default '{}',
    updated_at bigint not null default extract(epoch from now()) * 1000
  );

  create table settings (
    user_id uuid references auth.users primary key,
    generation integer not null default 3,
    music_on_launch boolean not null default false,
    updated_at bigint not null default extract(epoch from now()) * 1000
  );

  alter table caught_pokemon enable row level security;
  create policy "own data" on caught_pokemon using (user_id = auth.uid());

  alter table team enable row level security;
  create policy "own data" on team using (user_id = auth.uid());

  alter table trainer_records enable row level security;
  create policy "own data" on trainer_records using (user_id = auth.uid());

  alter table wild_records enable row level security;
  create policy "own data" on wild_records using (user_id = auth.uid());

  alter table battle_config enable row level security;
  create policy "own data" on battle_config using (user_id = auth.uid());

  alter table settings enable row level security;
  create policy "own data" on settings using (user_id = auth.uid());
  ```

- [ ] **Step 3: Enable anonymous sign-in**

  Authentication → Providers → Anonymous → Enable.

- [ ] **Step 4: Enable Google OAuth**

  Authentication → Providers → Google → Enable. Paste Google Cloud OAuth client ID and secret (create at console.cloud.google.com if needed; set redirect URI to your Supabase project's callback URL shown in the dashboard).

- [ ] **Step 5: Add env vars**

  Create/update `.env.local` in `/home/madmaxlgndklr/Git/web-pokedex/`:

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
  ```

  Both are `NEXT_PUBLIC_` because the client runs in the browser. The anon key is safe to expose — RLS enforces all access.

---

## Task 2: Install Package and Create Supabase Client

**Files:**
- Modify: `package.json` (via npm install)
- Create: `lib/supabase.ts`

- [ ] **Step 1: Install `@supabase/supabase-js`**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npm install @supabase/supabase-js
  ```

  Expected: package installs without error, `@supabase/supabase-js` appears in `package.json` dependencies.

- [ ] **Step 2: Create `lib/supabase.ts`**

  ```typescript
  import { createClient } from '@supabase/supabase-js'

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  export const supabase = createClient(url, key)
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npx tsc --noEmit
  ```

  Expected: no errors related to `lib/supabase.ts`.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/supabase.ts package.json package-lock.json
  git commit -m "feat: add Supabase client singleton"
  ```

---

## Task 3: Sync Layer — Pure Merge Functions + Tests

**Files:**
- Create: `lib/sync.ts`
- Create: `src/test/sync.test.ts`

The merge functions are pure (no I/O) and fully unit-testable. Write the tests first.

- [ ] **Step 1: Check test setup exists**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  cat package.json | grep -E '"test"|"jest"|"vitest"'
  ```

  If no test runner is configured, install vitest:

  ```bash
  npm install -D vitest
  ```

  Add to `package.json` scripts:
  ```json
  "test": "vitest run"
  ```

  Create `vitest.config.ts` if absent:

  ```typescript
  import { defineConfig } from 'vitest/config'
  export default defineConfig({
    test: { environment: 'node' },
  })
  ```

- [ ] **Step 2: Create `src/test/sync.test.ts`**

  ```bash
  mkdir -p /home/madmaxlgndklr/Git/web-pokedex/src/test
  ```

  ```typescript
  import { describe, it, expect } from 'vitest'
  import {
    mergeCaughtPokemon,
    mergeTeam,
    mergeTrainerRecords,
    mergeWildRecords,
    mergeBattleConfig,
    mergeSettings,
  } from '../../lib/sync'
  import type { RemoteState } from '../../lib/sync'

  const baseRemote: RemoteState = {
    caughtPokemon: [],
    team: null,
    trainerRecords: [],
    wildRecords: [],
    battleConfig: null,
    settings: null,
  }

  describe('mergeCaughtPokemon', () => {
    it('unions local and remote pokemon ids', () => {
      const result = mergeCaughtPokemon([1, 2], [2, 3])
      expect(result).toEqual(expect.arrayContaining([1, 2, 3]))
      expect(result).toHaveLength(3)
    })

    it('handles empty local', () => {
      expect(mergeCaughtPokemon([], [4, 5])).toEqual([4, 5])
    })

    it('handles empty remote', () => {
      expect(mergeCaughtPokemon([1], [])).toEqual([1])
    })
  })

  describe('mergeTeam', () => {
    it('keeps remote team when remote is newer', () => {
      const result = mergeTeam([1, 2, 3], 1000, [4, 5, 6], 2000)
      expect(result).toEqual([4, 5, 6])
    })

    it('keeps local team when local is newer', () => {
      const result = mergeTeam([1, 2, 3], 3000, [4, 5, 6], 2000)
      expect(result).toEqual([1, 2, 3])
    })

    it('keeps local team when timestamps are equal', () => {
      const result = mergeTeam([1, 2], 1000, [3, 4], 1000)
      expect(result).toEqual([1, 2])
    })

    it('keeps local when remote is null', () => {
      const result = mergeTeam([1, 2], 1000, null, null)
      expect(result).toEqual([1, 2])
    })
  })

  describe('mergeTrainerRecords', () => {
    it('takes max wins and losses, min first_defeated_at, max last_battled_at', () => {
      const local = { trainerId: 'brock', name: 'Brock', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'rock', wins: 3, losses: 1, firstDefeatedAt: 100, lastBattledAt: 500 }
      const remote = { trainerId: 'brock', name: 'Brock', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'rock', wins: 5, losses: 2, firstDefeatedAt: 200, lastBattledAt: 400 }
      const result = mergeTrainerRecords([local], [remote])
      expect(result[0].wins).toBe(5)
      expect(result[0].losses).toBe(2)
      expect(result[0].firstDefeatedAt).toBe(100)
      expect(result[0].lastBattledAt).toBe(500)
    })

    it('includes trainers only in local', () => {
      const local = { trainerId: 'misty', name: 'Misty', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'water', wins: 1, losses: 0, firstDefeatedAt: 100, lastBattledAt: 100 }
      const result = mergeTrainerRecords([local], [])
      expect(result).toHaveLength(1)
      expect(result[0].trainerId).toBe('misty')
    })

    it('includes trainers only in remote', () => {
      const remote = { trainerId: 'lt-surge', name: 'Lt. Surge', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'electric', wins: 0, losses: 1, firstDefeatedAt: undefined, lastBattledAt: 200 }
      const result = mergeTrainerRecords([], [remote])
      expect(result[0].trainerId).toBe('lt-surge')
    })

    it('uses min non-null firstDefeatedAt when local is undefined', () => {
      const local = { trainerId: 'erika', name: 'Erika', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'grass', wins: 0, losses: 1, firstDefeatedAt: undefined, lastBattledAt: 100 }
      const remote = { trainerId: 'erika', name: 'Erika', title: 'Gym Leader', region: 'kanto', trainerClass: 'gym', typeSpecialty: 'grass', wins: 1, losses: 0, firstDefeatedAt: 300, lastBattledAt: 300 }
      const result = mergeTrainerRecords([local], [remote])
      expect(result[0].firstDefeatedAt).toBe(300)
    })
  })

  describe('mergeWildRecords', () => {
    it('takes max wins and losses, max last_battled_at', () => {
      const local = { pokemonId: 25, pokemonName: 'pikachu', wins: 2, losses: 1, lastBattledAt: 500 }
      const remote = { pokemonId: 25, pokemonName: 'pikachu', wins: 3, losses: 0, lastBattledAt: 400 }
      const result = mergeWildRecords([local], [remote])
      expect(result[0].wins).toBe(3)
      expect(result[0].losses).toBe(1)
      expect(result[0].lastBattledAt).toBe(500)
    })
  })

  describe('mergeBattleConfig', () => {
    it('keeps remote when remote is newer', () => {
      const result = mergeBattleConfig('{"slot":0}', 1000, '{"slot":1}', 2000)
      expect(result).toBe('{"slot":1}')
    })

    it('keeps local when local is newer', () => {
      const result = mergeBattleConfig('{"slot":0}', 3000, '{"slot":1}', 2000)
      expect(result).toBe('{"slot":0}')
    })

    it('keeps local when remote is null', () => {
      const result = mergeBattleConfig('{"slot":0}', 1000, null, null)
      expect(result).toBe('{"slot":0}')
    })
  })

  describe('mergeSettings', () => {
    it('keeps remote when remote is newer', () => {
      const result = mergeSettings({ generation: 3, musicOnLaunch: false, updatedAt: 1000 }, { generation: 4, musicOnLaunch: true, updatedAt: 2000 })
      expect(result.generation).toBe(4)
    })

    it('keeps local when local is newer', () => {
      const result = mergeSettings({ generation: 5, musicOnLaunch: true, updatedAt: 3000 }, { generation: 3, musicOnLaunch: false, updatedAt: 1000 })
      expect(result.generation).toBe(5)
    })

    it('keeps local when remote is null', () => {
      const result = mergeSettings({ generation: 3, musicOnLaunch: false, updatedAt: 1000 }, null)
      expect(result.generation).toBe(3)
    })
  })
  ```

- [ ] **Step 3: Run tests to confirm they fail**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npm test
  ```

  Expected: FAIL — "Cannot find module '../../lib/sync'"

- [ ] **Step 4: Create `lib/sync.ts`**

  ```typescript
  import { supabase } from './supabase'
  import { db } from './db'
  import type { TrainerRecord, WildRecord } from './types'

  // ---- Remote state types ----

  interface RemoteCaughtRow { pokemon_id: number; caught_at: number }
  interface RemoteTeamRow { team_json: number[]; updated_at: number }
  interface RemoteTrainerRow {
    trainer_id: string; name: string; title: string; region: string
    trainer_class: string; type_specialty: string
    wins: number; losses: number; first_defeated_at: number | null; last_battled_at: number
  }
  interface RemoteWildRow {
    pokemon_id: number; pokemon_name: string
    wins: number; losses: number; last_battled_at: number
  }
  interface RemoteBattleConfigRow { config_json: Record<string, unknown>; updated_at: number }
  interface RemoteSettingsRow { generation: number; music_on_launch: boolean; updated_at: number }

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

  // ---- Pure merge functions (exported for testing) ----

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
          firstDefeatedAt: localFirst !== undefined && remoteFirst !== undefined
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
    return {
      caughtPokemon: (caught.data ?? []) as RemoteCaughtRow[],
      team: team.data as RemoteTeamRow | null,
      trainerRecords: (trainers.data ?? []) as RemoteTrainerRow[],
      wildRecords: (wild.data ?? []) as RemoteWildRow[],
      battleConfig: config.data as RemoteBattleConfigRow | null,
      settings: settings.data
        ? { generation: settings.data.generation, music_on_launch: settings.data.music_on_launch, updated_at: settings.data.updated_at }
        : null,
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

    const mergedCaught = mergeCaughtPokemon(localCaughtIds, (remote.caughtPokemon).map(r => r.pokemon_id))
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

  export async function pushDiff(userId: string, remote: RemoteState,
    localCaughtIds: number[], localTrainers: TrainerRecord[], localWild: WildRecord[]
  ): Promise<void> {
    const remoteCaughtIds = new Set(remote.caughtPokemon.map(r => r.pokemon_id))
    const missingCaught = localCaughtIds.filter(id => !remoteCaughtIds.has(id))
    if (missingCaught.length > 0) {
      await supabase.from('caught_pokemon').upsert(
        missingCaught.map(id => ({ user_id: userId, pokemon_id: id, caught_at: Date.now() }))
      )
    }

    const remoteTrainerIds = new Set(remote.trainerRecords.map(r => r.trainer_id))
    const missingTrainers = localTrainers.filter(t => !remoteTrainerIds.has(t.trainerId))
    if (missingTrainers.length > 0) {
      await supabase.from('trainer_records').upsert(
        missingTrainers.map(t => ({
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

    const remoteWildIds = new Set(remote.wildRecords.map(r => r.pokemon_id))
    const missingWild = localWild.filter(w => !remoteWildIds.has(w.pokemonId))
    if (missingWild.length > 0) {
      await supabase.from('wild_records').upsert(
        missingWild.map(w => ({
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

    const mergedCaught = mergeCaughtPokemon(localCaught, remote.caughtPokemon.map(r => r.pokemon_id))
    const mergedTrainers = mergeTrainerRecords(localTrainers, remote.trainerRecords)
    const mergedWild = mergeWildRecords(localWild, remote.wildRecords)
    await pushDiff(user.id, remote, mergedCaught, mergedTrainers, mergedWild)
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
    await db.settings.put({ key: 'team_updated_at', value: String(now) })
    await supabase.from('team').upsert({ user_id: userId, team_json: teamIds, updated_at: now })
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
    await db.settings.put({ key: 'battle_config_updated_at', value: String(now) })
    await supabase.from('battle_config').upsert({
      user_id: userId,
      config_json: JSON.parse(configJson),
      updated_at: now,
    })
  }

  export async function pushSettings(userId: string, generation: number, musicOnLaunch: boolean): Promise<void> {
    const now = Date.now()
    await db.settings.put({ key: 'settings_updated_at', value: String(now) })
    await supabase.from('settings').upsert({
      user_id: userId,
      generation,
      music_on_launch: musicOnLaunch,
      updated_at: now,
    })
  }
  ```

- [ ] **Step 5: Run tests — expect pass**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npm test
  ```

  Expected: all tests in `src/test/sync.test.ts` PASS.

- [ ] **Step 6: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add lib/sync.ts src/test/sync.test.ts vitest.config.ts package.json package-lock.json
  git commit -m "feat: add sync layer with merge functions and tests"
  ```

---

## Task 4: Auth Helper Functions

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: Create `lib/auth.ts`**

  ```typescript
  import { supabase } from './supabase'

  export async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return data.user
  }

  export async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  }

  export async function signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.updateUser({ email, password })
    if (error) throw error
    return data.user
  }

  export async function linkGoogle() {
    const { error } = await supabase.auth.linkIdentity({ provider: 'google' })
    if (error) throw error
  }

  export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    await supabase.auth.signInAnonymously()
  }

  export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add lib/auth.ts
  git commit -m "feat: add auth helper functions"
  ```

---

## Task 5: AuthProvider Context Component

**Files:**
- Create: `components/auth/AuthProvider.tsx`

- [ ] **Step 1: Create directory**

  ```bash
  mkdir -p /home/madmaxlgndklr/Git/web-pokedex/components/auth
  ```

- [ ] **Step 2: Create `components/auth/AuthProvider.tsx`**

  ```typescript
  'use client'
  import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
  import type { User, Session } from '@supabase/supabase-js'
  import { supabase } from '@/lib/supabase'
  import { signInAnonymously } from '@/lib/auth'
  import { syncOnOpen } from '@/lib/sync'

  interface AuthContextValue {
    user: User | null
    session: Session | null
    loading: boolean
  }

  const AuthContext = createContext<AuthContextValue>({ user: null, session: null, loading: true })

  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
          setSession(session)
          setUser(session.user)
        } else {
          try {
            const anonUser = await signInAnonymously()
            setUser(anonUser)
          } catch {
            // stay unauthenticated — app still works offline
          }
        }
        setLoading(false)
        syncOnOpen().catch(() => {})
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session) syncOnOpen().catch(() => {})
      })

      return () => subscription.unsubscribe()
    }, [])

    return <AuthContext.Provider value={{ user, session, loading }}>{children}</AuthContext.Provider>
  }

  export function useAuth() {
    return useContext(AuthContext)
  }
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add components/auth/AuthProvider.tsx
  git commit -m "feat: add AuthProvider context with anonymous session init and syncOnOpen"
  ```

---

## Task 6: Wire db.ts Writes to Push to Supabase

**Files:**
- Modify: `lib/db.ts`

Every write in `lib/db.ts` needs a fire-and-forget push after the local write. The push is skipped silently when the user has no active session.

- [ ] **Step 1: Read current `lib/db.ts`**

  Full current content shown in File Map section. Key write points:
  - `useCaughtPokemon.toggle`: calls `db.caught_pokemon.delete` or `db.caught_pokemon.add`
  - `useTeam.add` and `useTeam.remove`: calls `db.team.put` or `db.team.bulkPut`
  - `useBattleConfig.save`: calls `db.battle_config.put`
  - `useTrainerRecords.recordBattle`: calls `db.trainer_records.update` or `db.trainer_records.add`
  - `useWildRecords.recordBattle`: calls `db.wild_records.update` or `db.wild_records.add`
  - `useSetting.set`: calls `db.settings.put`

- [ ] **Step 2: Add push calls to `lib/db.ts`**

  Replace the entire file content with:

  ```typescript
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
  ```

- [ ] **Step 3: Run tests to verify nothing broke**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 4: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/db.ts
  git commit -m "feat: wire db writes to push to Supabase after local write"
  ```

---

## Task 7: Wrap Layout with AuthProvider

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

  Replace:

  ```typescript
  import type { Metadata } from 'next'
  import './globals.css'
  import { ThemeProvider } from '@/lib/theme'
  import { Sidebar } from '@/components/nav/Sidebar'

  export const metadata: Metadata = {
    title: 'Pokédex',
    description: 'Personal Pokédex',
  }

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en" data-theme="dark" suppressHydrationWarning>
        <body>
          <ThemeProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </ThemeProvider>
        </body>
      </html>
    )
  }
  ```

  With:

  ```typescript
  import type { Metadata } from 'next'
  import './globals.css'
  import { ThemeProvider } from '@/lib/theme'
  import { Sidebar } from '@/components/nav/Sidebar'
  import { AuthProvider } from '@/components/auth/AuthProvider'

  export const metadata: Metadata = {
    title: 'Pokédex',
    description: 'Personal Pokédex',
  }

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en" data-theme="dark" suppressHydrationWarning>
        <body>
          <ThemeProvider>
            <AuthProvider>
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 min-w-0">{children}</main>
              </div>
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    )
  }
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add app/layout.tsx
  git commit -m "feat: wrap layout with AuthProvider"
  ```

---

## Task 8: Login Page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create `app/login/page.tsx`**

  ```typescript
  'use client'
  import { useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { signInWithEmail, signUpWithEmail, linkGoogle } from '@/lib/auth'

  type Mode = 'signin' | 'signup'

  export default function LoginPage() {
    const router = useRouter()
    const [mode, setMode] = useState<Mode>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleEmail = async () => {
      setError(null)
      setLoading(true)
      try {
        if (mode === 'signin') {
          await signInWithEmail(email, password)
        } else {
          await signUpWithEmail(email, password)
        }
        router.back()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Authentication failed')
      } finally {
        setLoading(false)
      }
    }

    const handleGoogle = async () => {
      setError(null)
      setLoading(true)
      try {
        await linkGoogle()
        // Google OAuth redirects — no router.back() needed here
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Google sign-in failed')
        setLoading(false)
      }
    }

    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>
            SYNC ACCOUNT
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{ padding: '10px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', letterSpacing: '0.5px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            CONTINUE WITH GOOGLE
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', gap: '0' }}>
            {(['signin', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                style={{ flex: 1, padding: '6px', fontFamily: 'var(--font-pixel)', fontSize: '6px', background: mode === m ? 'var(--blue)' : 'transparent', color: mode === m ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                {m === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>
            ))}
          </div>

          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', fontFamily: 'monospace', fontSize: '12px' }}
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEmail() }}
            style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', fontFamily: 'monospace', fontSize: '12px' }}
          />

          {error && (
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c03028' }}>{error}</div>
          )}

          <button
            onClick={handleEmail}
            disabled={loading || !email || !password}
            style={{ padding: '10px 16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', letterSpacing: '0.5px', cursor: (loading || !email || !password) ? 'not-allowed' : 'pointer', opacity: (loading || !email || !password) ? 0.6 : 1 }}
          >
            {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>

          <button
            onClick={() => router.back()}
            style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            BACK
          </button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add app/login/page.tsx
  git commit -m "feat: add login page with Google and email auth"
  ```

---

## Task 9: AccountBadge Component

**Files:**
- Create: `components/auth/AccountBadge.tsx`

This component belongs in the nav/sidebar. After creating it, it needs to be placed inside `Sidebar` — check `components/nav/Sidebar.tsx` for the right slot.

- [ ] **Step 1: Create `components/auth/AccountBadge.tsx`**

  ```typescript
  'use client'
  import { useRouter } from 'next/navigation'
  import { useAuth } from './AuthProvider'
  import { signOut } from '@/lib/auth'
  import { useState } from 'react'

  export function AccountBadge() {
    const { user, loading } = useAuth()
    const router = useRouter()
    const [signingOut, setSigningOut] = useState(false)

    if (loading) return null

    const isAnonymous = !user || user.is_anonymous

    if (isAnonymous) {
      return (
        <button
          onClick={() => router.push('/login')}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '6px 8px',
            fontFamily: 'var(--font-pixel)',
            fontSize: '5px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            letterSpacing: '0.5px',
            textAlign: 'left',
            width: '100%',
          }}
        >
          SIGN IN TO SYNC
        </button>
      )
    }

    const displayName = user.email ?? 'GOOGLE ACCOUNT'

    const handleSignOut = async () => {
      setSigningOut(true)
      try {
        await signOut()
      } finally {
        setSigningOut(false)
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: '#f0c040', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName.toUpperCase()}
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            padding: '4px 6px',
            fontFamily: 'var(--font-pixel)',
            fontSize: '5px',
            color: 'var(--text-muted)',
            cursor: signingOut ? 'not-allowed' : 'pointer',
            opacity: signingOut ? 0.6 : 1,
          }}
        >
          SIGN OUT
        </button>
      </div>
    )
  }
  ```

- [ ] **Step 2: Find where to add AccountBadge in Sidebar**

  ```bash
  cat /home/madmaxlgndklr/Git/web-pokedex/components/nav/Sidebar.tsx
  ```

  Locate the bottom of the sidebar nav list (look for a settings link or the end of the nav items). Add `<AccountBadge />` in a `<div>` at the bottom of the sidebar, below all nav items, with a border-top separator.

- [ ] **Step 3: Modify `components/nav/Sidebar.tsx`**

  Add import at top:
  ```typescript
  import { AccountBadge } from '@/components/auth/AccountBadge'
  ```

  Find the outermost sidebar container's last child element and insert after all nav links:
  ```tsx
  <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
    <AccountBadge />
  </div>
  ```

  The exact placement depends on the Sidebar's current structure — read it first (Step 2) and find the logical bottom of the nav.

- [ ] **Step 4: TypeScript check**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add components/auth/AccountBadge.tsx components/nav/Sidebar.tsx
  git commit -m "feat: add AccountBadge to sidebar showing sign-in prompt or signed-in state"
  ```

---

## Task 10: End-to-End Test and Deploy

**Files:** None (testing and deployment)

- [ ] **Step 1: Start dev server**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npm run dev
  ```

- [ ] **Step 2: Smoke test anonymous session**

  Open the app in a browser. Open DevTools → Application → Local Storage.
  Confirm `supabase.auth.token` key exists, meaning `signInAnonymously()` ran on load.

- [ ] **Step 3: Smoke test sync on open**

  Open DevTools → Network. Reload the page. Confirm requests go to `<supabase-url>/rest/v1/caught_pokemon` (and other tables) after auth resolves.

- [ ] **Step 4: Smoke test AccountBadge**

  Confirm the sidebar shows "SIGN IN TO SYNC" for an anonymous session.
  Click it — confirm it navigates to `/login`.

- [ ] **Step 5: Smoke test login page**

  On `/login`, click "CONTINUE WITH GOOGLE". Confirm Google OAuth redirect initiates. (Full test requires a live Supabase project with Google OAuth configured.)

  For email, enter any email + password and click "CREATE ACCOUNT". Confirm the request fires (check Network tab for a POST to Supabase auth endpoint).

- [ ] **Step 6: Smoke test signed-in state**

  After signing in, confirm AccountBadge shows the email address and a "SIGN OUT" button.
  Click sign out — confirm badge reverts to "SIGN IN TO SYNC" (new anonymous session created).

- [ ] **Step 7: Smoke test caught Pokémon push**

  Toggle a Pokémon as caught. Open Network tab and confirm a POST/UPSERT fires to `caught_pokemon`.

- [ ] **Step 8: Run full test suite**

  ```bash
  cd /home/madmaxlgndklr/Git/web-pokedex
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 9: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 10: Deploy to production**

  ```bash
  npx vercel --prod
  ```

  Confirm deployment succeeds. Open the production URL and repeat steps 2–7 on the live site.

- [ ] **Step 11: Final commit**

  ```bash
  git add .
  git commit -m "feat: Supabase auth + sync — web app complete"
  ```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Schema SQL — Task 1
- [x] RLS policies — Task 1
- [x] Anonymous sign-in on first launch — Task 5 (AuthProvider)
- [x] Google OAuth via linkIdentity — Task 4 + Task 8
- [x] Email sign-in and sign-up (via updateUser for anonymous upgrade) — Task 4 + Task 8
- [x] Sign-out creates new anonymous session — Task 4
- [x] `pullAll`, `mergeAll`, `writeLocal`, `pushDiff`, `syncOnOpen` — Task 3
- [x] Merge rules: union for caught, max for battle records, last-write-wins for team/config/settings — Task 3
- [x] Fire-and-forget push on every local write — Task 6
- [x] AccountBadge: anonymous prompt vs signed-in — Task 9
- [x] Login sheet: Google + email sign-in + email create-account — Task 8
- [x] syncOnOpen runs on auth state change (after linking) — Task 5
- [x] env vars — Task 1

**Out of scope (confirmed not included):** Realtime, search history, API cache tables, password reset, account deletion.

**Type consistency check:**
- `RemoteState` defined in Task 3, used in `pullAll`, `pushDiff`, `syncOnOpen`, `writeLocal` — all consistent
- `TrainerRecord`, `WildRecord` from `lib/types.ts` — used throughout Tasks 3 and 6
- `LocalSettings` interface defined in Task 3, used in `writeLocal` and `mergeSettings`
- `pushTeam(userId, teamIds: number[])` called from Task 6 with `newTeam: number[]` — consistent
- `mergeSettings` signature: `(LocalSettings, {generation, musicOnLaunch, updatedAt} | null)` — remote object literal matches `RemoteSettingsRow` mapped fields
