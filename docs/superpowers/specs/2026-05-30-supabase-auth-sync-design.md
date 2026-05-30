# Supabase Auth & Cross-Platform Sync Design

> **For agentic workers:** This spec covers two codebases. Implement web changes in `/home/madmaxlgndklr/Git/web-pokedex` and Android changes in `/home/madmaxlgndklr/Git/sandbox/Pokedex`. Both share the same Supabase project.

**Goal:** Add Supabase-backed authentication and cross-platform data sync so user data (caught Pokémon, team, battle records, settings) persists across the web app and Android app.

**Architecture:** Local-first. Local storage (Dexie on web, Room/DataStore on Android) remains the source of truth for reads. Supabase receives writes asynchronously and is pulled from on app open to reconcile state across devices.

**Tech Stack:** Supabase (Postgres + Auth), `@supabase/supabase-js` (web), Supabase Kotlin SDK (Android), existing Dexie + Room storage unchanged.

---

## 1. Supabase Schema

### Tables

All tables include a `user_id uuid references auth.users` column. Row Level Security (RLS) is enabled on every table with the policy `user_id = auth.uid()` for all operations.

```sql
-- One row per caught Pokémon per user
create table caught_pokemon (
  user_id uuid references auth.users not null,
  pokemon_id integer not null,
  caught_at bigint not null default extract(epoch from now()) * 1000,
  primary key (user_id, pokemon_id)
);

-- One row per user; team stored as ordered JSON array of up to 6 IDs
create table team (
  user_id uuid references auth.users primary key,
  team_json jsonb not null default '[]',
  updated_at bigint not null default extract(epoch from now()) * 1000
);

-- One row per trainer per user
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

-- One row per wild Pokémon per user
create table wild_records (
  user_id uuid references auth.users not null,
  pokemon_id integer not null,
  pokemon_name text not null,
  wins integer not null default 0,
  losses integer not null default 0,
  last_battled_at bigint not null,
  primary key (user_id, pokemon_id)
);

-- One row per user
create table battle_config (
  user_id uuid references auth.users primary key,
  config_json jsonb not null default '{}',
  updated_at bigint not null default extract(epoch from now()) * 1000
);

-- One row per user
create table settings (
  user_id uuid references auth.users primary key,
  generation integer not null default 3,
  music_on_launch boolean not null default false,
  updated_at bigint not null default extract(epoch from now()) * 1000
);
```

### RLS Policies (apply to all six tables)

```sql
alter table caught_pokemon enable row level security;
create policy "own data" on caught_pokemon using (user_id = auth.uid());

-- Repeat for team, trainer_records, wild_records, battle_config, settings
```

### Supabase Project Setup (one-time, manual)

1. Create project at supabase.com
2. Run the schema SQL above in the SQL editor
3. Enable anonymous sign-in: Authentication → Providers → Anonymous
4. Enable Google OAuth: Authentication → Providers → Google (paste Google Cloud OAuth client ID and secret)
5. Copy `Project URL` and `anon public` key for use in both apps

---

## 2. Auth Flow

### User States

```
[anonymous Supabase user]
        |
        ├── linkIdentity(google)   → [signed in with Google]
        └── linkIdentity(email)    → [signed in with email + password]
```

### Anonymous Session (first launch)

Both platforms call `supabase.auth.signInAnonymously()` on first launch if no session exists. This produces a real `user_id` immediately so all data written before sign-in is scoped to that user. The session is persisted automatically by the Supabase SDK (web: `localStorage`; Android: `EncryptedSharedPreferences` via the SDK).

### Login Sheet UI

Shown when the user taps the account badge. Contains three options:

| Control | Call |
|---|---|
| **Continue with Google** | `supabase.auth.linkIdentity({ provider: 'google' })` — creates account if new, signs in if returning |
| **Sign in with email** | `supabase.auth.signInWithPassword({ email, password })` |
| **Create account with email** | `supabase.auth.linkIdentity({ provider: 'email', email, password })` |

Google handles both new and returning users in one tap with no separate create/sign-in distinction.

### After Linking

Immediately trigger `syncOnOpen()`. This is the moment two datasets (device local data + any prior data on the real account) may diverge; the merge runs once to reconcile them.

### Sign Out

Local data is retained. A new anonymous session is created immediately so the app stays functional. The signed-out account's data remains in Supabase under its original `user_id`.

### Account Badge (both platforms)

- Anonymous: "Sign in to sync across devices" → opens login sheet
- Signed in: display email or "Google account" + sign-out button

---

## 3. Sync Layer

### Principle

Local storage is always read from directly — no loading states, offline works identically to today. Supabase is written to in the background and read from once on app open.

### On Every Local Write

```
user action
  → write to Dexie / Room immediately  (synchronous from UI perspective)
  → pushToSupabase(table, row)         (async, fire-and-forget)
```

If the push fails (offline, timeout), it is silently dropped. The next `syncOnOpen()` will reconcile via `pushDiff`. No retry queue.

### On App Open — `syncOnOpen()`

```
1. pullAll(userId)     → fetch all 6 tables from Supabase
2. mergeAll(local, remote) → produce merged state using rules below
3. writeLocal(merged)  → persist merged state to Dexie / Room
4. pushDiff(local, remote) → upload rows present locally but missing remotely
```

Runs once in the background after the UI is visible. User sees local data immediately.

### Merge Rules

| Table | Rule |
|---|---|
| `caught_pokemon` | Union — keep all rows from both local and remote |
| `team` | Last-write-wins on `updated_at` |
| `trainer_records` | Per trainer: `wins = max(local.wins, remote.wins)`, `losses = max(local.losses, remote.losses)`, `first_defeated_at = min(non-null values)`, `last_battled_at = max(values)` |
| `wild_records` | Same additive merge as trainer_records |
| `battle_config` | Last-write-wins on `updated_at` |
| `settings` | Last-write-wins on `updated_at` |

### Core Sync Functions (both platforms)

| Function | Signature | Does |
|---|---|---|
| `pullAll` | `(userId) → RemoteState` | Fetch all 6 tables for user |
| `mergeAll` | `(local, remote) → MergedState` | Apply merge rules |
| `writeLocal` | `(merged) → void` | Persist to Dexie / Room |
| `pushDiff` | `(local, remote) → void` | Upload rows missing from remote |
| `syncOnOpen` | `() → void` | Orchestrate all four in order |

No Supabase Realtime. Pull-on-open is sufficient; real-time would add complexity and battery drain for negligible benefit.

---

## 4. Web Implementation

**Repo:** `/home/madmaxlgndklr/Git/web-pokedex`

### New Files

| Path | Purpose |
|---|---|
| `lib/supabase.ts` | Supabase client singleton, initialised with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `lib/auth.ts` | React hooks: `useUser()`, `useSignIn()`, `useSignUp()`, `useSignOut()`, `useLinkGoogle()` |
| `lib/sync.ts` | `pullAll()`, `mergeAll()`, `writeLocal()`, `pushDiff()`, `syncOnOpen()` |
| `app/login/page.tsx` | Login sheet: Google button + email sign-in form + email create-account form |
| `components/auth/AuthProvider.tsx` | Context wrapping whole app — initialises anonymous session on first load, exposes `user` and `session` |
| `components/auth/AccountBadge.tsx` | Nav/settings component showing sign-in prompt or signed-in state |

### Modified Files

| Path | Change |
|---|---|
| `lib/db.ts` | After each write (caught toggle, team add/remove, battle record upsert, settings set), call the corresponding `pushToSupabase()` from `lib/sync.ts` |
| `app/layout.tsx` | Wrap children with `<AuthProvider>`, call `syncOnOpen()` after session is ready |
| `.env.local` | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Both are `NEXT_PUBLIC_` because the Supabase client runs in the browser. The anon key is safe to expose — RLS enforces all access control.

---

## 5. Android Implementation

**Repo:** `/home/madmaxlgndklr/Git/sandbox/Pokedex`

### New Files

| Path | Purpose |
|---|---|
| `data/remote/SupabaseClient.kt` | Supabase client singleton using the Kotlin SDK (`io.github.jan-tennert.supabase`) |
| `data/remote/AuthRepository.kt` | `signInAnonymously()`, `signInWithEmail()`, `signUpWithEmail()`, `linkGoogle()`, `signOut()`, `currentUser()`, session restore |
| `data/remote/SyncRepository.kt` | `pullAll()`, `mergeAll()`, `writeLocal()`, `pushDiff()`, `syncOnOpen()` |
| `ui/auth/LoginScreen.kt` | Bottom sheet: Google button + email forms |
| `ui/auth/LoginViewModel.kt` | Form state, validation, calls `AuthRepository`, triggers `syncOnOpen()` on success |

### Modified Files

| Path | Change |
|---|---|
| `PokedexApplication.kt` | Initialise `SupabaseClient`, call `AuthRepository.signInAnonymously()` if no session |
| `ui/settings/SettingsScreen.kt` | Add account section — sign-in prompt or email + sign-out |
| `ui/settings/SettingsViewModel.kt` | Expose `currentUser` state, handle sign-out |
| `data/local/CaughtPokemonDao.kt` | After insert/delete, call `SyncRepository.pushCaughtPokemon()` |
| `data/repository/BattleRecordRepository.kt` | After upsert, call `SyncRepository.pushBattleRecord()` |
| `ui/team/TeamViewModel.kt` | After `setTeam()`, call `SyncRepository.pushTeam()` |
| `data/local/SettingsDataStore.kt` | After setting gen / music, call `SyncRepository.pushSettings()` |

### Dependencies to Add (`build.gradle.kts`)

```kotlin
implementation("io.github.jan-tennert.supabase:postgrest-kt:2.x.x")
implementation("io.github.jan-tennert.supabase:auth-kt:2.x.x")
implementation("io.ktor:ktor-client-android:2.x.x")
```

### Configuration

Add to `local.properties` (not committed):
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
```

Expose via `BuildConfig` in `build.gradle.kts`:
```kotlin
buildConfigField("String", "SUPABASE_URL", "\"${properties["SUPABASE_URL"]}\"")
buildConfigField("String", "SUPABASE_ANON_KEY", "\"${properties["SUPABASE_ANON_KEY"]}\"")
```

---

## 6. Out of Scope

- Supabase Realtime subscriptions — pull-on-open is sufficient
- Search history sync — device-specific, not worth syncing
- API cache tables (`pokemon_list_cache`, `pokemon_detail_cache`, `moves`, `held_items`) — device-local caches only
- Password reset / email verification flows — Supabase handles these via email with no custom code required
- Account deletion — can be added later via Supabase admin API
