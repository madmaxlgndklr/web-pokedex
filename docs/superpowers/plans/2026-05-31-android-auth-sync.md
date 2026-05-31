# Android: Supabase Auth + Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase anonymous auth, email/password, and Google Sign-In to the Android app; sync all 6 data tables (caught_pokemon, team, trainer_records, wild_records, battle_config, settings) bidirectionally with the web app using the same merge logic; add a Profile screen with editable Trainer Name.

**Architecture:** New `data/remote/` layer (SupabaseModule singleton, AuthRepository, SyncRepository with merge DTOs) + new `ui/profile/` layer, wired into the existing PokedexApplication and Settings nav. The app is local-first: Room/DataStore remain the source of truth; Supabase syncs in the background. No Hilt — follow the existing singleton-in-Application pattern (see `RetrofitClient`, `SettingsRepository`).

**Tech Stack:** supabase-kt 3.x (BOM), ktor-client-android 3.x, kotlinx-serialization, existing Room 2.x / DataStore 1.x

**Repo:** `/home/madmaxlgndklr/Git/sandbox/Pokedex`

---

## Prerequisites (manual, one-time)

1. **Supabase dashboard** → SQL editor → run:
   ```sql
   ALTER TABLE settings ADD COLUMN IF NOT EXISTS trainer_name text NOT NULL DEFAULT '';
   ```
2. **Google Cloud Console** → APIs & Services → Credentials:
   - Create an OAuth 2.0 **Web** client ID (not Android). Copy the client ID — you need it as `GOOGLE_SERVER_CLIENT_ID`.
   - Add `com.madmaxlgndklr.pokedex` to authorized Android client IDs for the same OAuth app.
3. Copy your Supabase project URL and anon key from Supabase dashboard → Settings → API.
4. Add to `local.properties` (this file is gitignored):
   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=<anon-key>
   GOOGLE_SERVER_CLIENT_ID=<web-oauth-client-id>.apps.googleusercontent.com
   ```

---

## File Map

| File | Change |
|---|---|
| `gradle/libs.versions.toml` | Add supabase, ktor, kotlinx-serialization versions + libraries + plugin |
| `app/build.gradle.kts` | Add serialization plugin, buildConfig, supabase/ktor deps |
| `data/local/SettingsDataStore.kt` | Add `trainerName` Flow + `setTrainerName` |
| `data/remote/SupabaseModule.kt` | Create — Supabase client singleton |
| `data/remote/AuthRepository.kt` | Create — anonymous, email, Google sign-in/out |
| `data/remote/SyncRepository.kt` | Create — DTOs, merge logic, pullAll/writeLocal/pushDiff/syncOnOpen, push functions |
| `PokedexApplication.kt` | Init SupabaseModule + AuthRepository + SyncRepository; anonymous sign-in on start; syncOnOpen |
| `data/repository/BattleRecordRepository.kt` | Fire-and-forget push after every upsert |
| `ui/profile/ProfileViewModel.kt` | Create — auth state, trainer name, save, sign-in/out |
| `ui/profile/ProfileScreen.kt` | Create — trainer name field + auth UI |
| `ui/navigation/AppNavigation.kt` | Add `PROFILE` route |
| `ui/settings/SettingsScreen.kt` | Add "TRAINER PROFILE" row that navigates to profile |

---

### Task 1: Add Supabase dependencies and buildConfig

**Files:**
- Modify: `gradle/libs.versions.toml`
- Modify: `app/build.gradle.kts`

- [ ] **Step 1: Add versions and libraries to `gradle/libs.versions.toml`**

In the `[versions]` section, append:
```toml
supabase = "3.1.4"
ktor = "3.1.3"
```

In the `[libraries]` section, append:
```toml
supabase-bom = { group = "io.github.jan-tennert.supabase", name = "bom", version.ref = "supabase" }
supabase-postgrest = { group = "io.github.jan-tennert.supabase", name = "postgrest-kt" }
supabase-auth = { group = "io.github.jan-tennert.supabase", name = "auth-kt" }
supabase-compose-auth = { group = "io.github.jan-tennert.supabase", name = "compose-auth" }
ktor-client-android = { group = "io.ktor", name = "ktor-client-android", version.ref = "ktor" }
```

In the `[plugins]` section, append:
```toml
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
```

- [ ] **Step 2: Update `app/build.gradle.kts`**

In the `plugins {}` block, append:
```kotlin
    alias(libs.plugins.kotlin.serialization)
```

In the `android { buildFeatures {} }` block, add:
```kotlin
        buildConfig = true
```

In `android { defaultConfig {} }`, add (after `testInstrumentationRunner`):
```kotlin
        val localProps = java.util.Properties().apply {
            load(rootProject.file("local.properties").inputStream())
        }
        buildConfigField("String", "SUPABASE_URL", "\"${localProps["SUPABASE_URL"]}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${localProps["SUPABASE_ANON_KEY"]}\"")
        buildConfigField("String", "GOOGLE_SERVER_CLIENT_ID", "\"${localProps["GOOGLE_SERVER_CLIENT_ID"]}\"")
```

In the `dependencies {}` block, append:
```kotlin
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.auth)
    implementation(libs.supabase.compose.auth)
    implementation(libs.ktor.client.android)
```

- [ ] **Step 3: Sync Gradle and verify the build**

In Android Studio: File → Sync Project with Gradle Files, or run:
```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew assembleDebug 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL (new deps resolved, BuildConfig regenerated)

- [ ] **Step 4: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add gradle/libs.versions.toml app/build.gradle.kts
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "build: add supabase-kt, ktor, kotlinx-serialization deps and buildConfig fields"
```

---

### Task 2: Add `trainerName` to `SettingsRepository`

**Files:**
- Modify: `data/local/SettingsDataStore.kt`

The existing `SettingsRepository` class has DataStore keys for music, team, gen, battleConfig, spriteMode. Add `trainerName`.

- [ ] **Step 1: Add `TRAINER_NAME_KEY`, `trainerName` Flow, and `setTrainerName` to `SettingsRepository`**

Find the end of the `SettingsRepository` class, just before the closing `}`. Insert:
```kotlin
    private val TRAINER_NAME_KEY = stringPreferencesKey("trainer_name")

    val trainerName: Flow<String> = dataStore.data.map { it[TRAINER_NAME_KEY] ?: "" }

    suspend fun setTrainerName(name: String) {
        dataStore.edit { it[TRAINER_NAME_KEY] = name.take(16) }
    }
```

- [ ] **Step 2: Build to confirm no compile errors**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew :app:compileDebugKotlin 2>&1 | grep -E "error:|warning:" | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add app/src/main/java/com/madmaxlgndklr/pokedex/data/local/SettingsDataStore.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: add trainerName to SettingsRepository"
```

---

### Task 3: Create `data/remote/SupabaseModule.kt`

**Files:**
- Create: `app/src/main/java/com/madmaxlgndklr/pokedex/data/remote/SupabaseModule.kt`

Follow the same singleton object pattern as `RetrofitClient.kt` in the same package.

- [ ] **Step 1: Create the file**

```kotlin
package com.madmaxlgndklr.pokedex.data.remote

import com.madmaxlgndklr.pokedex.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.compose.auth.ComposeAuth
import io.github.jan.supabase.compose.auth.googleNativeLogin
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

object SupabaseModule {
    val client = createSupabaseClient(
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseKey = BuildConfig.SUPABASE_ANON_KEY
    ) {
        install(Auth)
        install(Postgrest)
        install(ComposeAuth) {
            googleNativeLogin(serverClientId = BuildConfig.GOOGLE_SERVER_CLIENT_ID)
        }
    }
}
```

- [ ] **Step 2: Build to confirm no compile errors**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew :app:compileDebugKotlin 2>&1 | grep -E "error:" | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add app/src/main/java/com/madmaxlgndklr/pokedex/data/remote/SupabaseModule.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: add SupabaseModule client singleton"
```

---

### Task 4: Create `data/remote/AuthRepository.kt`

**Files:**
- Create: `app/src/main/java/com/madmaxlgndklr/pokedex/data/remote/AuthRepository.kt`

- [ ] **Step 1: Create the file**

```kotlin
package com.madmaxlgndklr.pokedex.data.remote

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.user.UserInfo

class AuthRepository {
    private val auth = SupabaseModule.client.auth

    suspend fun signInAnonymously() {
        if (auth.currentUserOrNull() == null) {
            auth.signInAnonymously()
        }
    }

    suspend fun signInWithEmail(email: String, password: String) {
        auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signUpWithEmail(email: String, password: String) {
        auth.signUpWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        auth.signOut()
    }

    fun currentUser(): UserInfo? = auth.currentUserOrNull()

    fun isAnonymous(): Boolean = auth.currentUserOrNull()?.isAnonymous == true

    fun currentUserId(): String? = auth.currentUserOrNull()?.id
}
```

- [ ] **Step 2: Build**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew :app:compileDebugKotlin 2>&1 | grep -E "error:" | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add app/src/main/java/com/madmaxlgndklr/pokedex/data/remote/AuthRepository.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: add AuthRepository (anonymous, email, signOut)"
```

---

### Task 5: Create `data/remote/SyncRepository.kt`

**Files:**
- Create: `app/src/main/java/com/madmaxlgndklr/pokedex/data/remote/SyncRepository.kt`
- Create: `app/src/test/java/com/madmaxlgndklr/pokedex/sync/SyncMergeTest.kt`

This is the largest file. It mirrors the web's `sync.ts` + `sync-merge.ts` exactly — same merge rules, same table names, same column names.

**Merge rules (match the web implementation exactly):**
- `caught_pokemon`: union of local + remote IDs
- `team`: last-write-wins on `updated_at`
- `trainer_records`: per trainer — wins = max(local, remote), losses = max(local, remote), firstDefeatedAt = min non-null, lastBattledAt = max
- `wild_records`: per pokémon — wins = max(local, remote), losses = max(local, remote), lastBattledAt = max
- `battle_config`: last-write-wins on `updated_at`
- `settings`: last-write-wins on `updated_at`

Note: the web uses `Math.max` (not sum) for wins/losses — match this exactly so a record won on one device doesn't get doubled when syncing.

- [ ] **Step 1: Write the failing merge tests first**

Create `app/src/test/java/com/madmaxlgndklr/pokedex/sync/SyncMergeTest.kt`:

```kotlin
package com.madmaxlgndklr.pokedex.sync

import com.madmaxlgndklr.pokedex.data.remote.MergeUtils
import com.madmaxlgndklr.pokedex.data.remote.RemoteTrainerRow
import com.madmaxlgndklr.pokedex.data.remote.RemoteWildRow
import com.madmaxlgndklr.pokedex.data.local.TrainerRecord
import com.madmaxlgndklr.pokedex.data.local.WildRecord
import org.junit.Test
import org.junit.Assert.*

class SyncMergeTest {

    @Test
    fun `mergeCaughtPokemon unions local and remote`() {
        val local = listOf(1, 2, 3)
        val remote = listOf(3, 4, 5)
        val result = MergeUtils.mergeCaughtPokemon(local, remote)
        assertEquals(setOf(1, 2, 3, 4, 5), result.toSet())
    }

    @Test
    fun `mergeTeam picks remote when newer`() {
        val result = MergeUtils.mergeTeam(listOf(1, 2), 100L, listOf(3, 4), 200L)
        assertEquals(listOf(3, 4), result)
    }

    @Test
    fun `mergeTeam picks local when newer`() {
        val result = MergeUtils.mergeTeam(listOf(1, 2), 300L, listOf(3, 4), 200L)
        assertEquals(listOf(1, 2), result)
    }

    @Test
    fun `mergeTrainerRecords uses max wins and losses`() {
        val local = listOf(TrainerRecord("t1", "Brock", "Gym Leader", "Kanto", "GymLeader", "Rock", wins = 5, losses = 2, lastBattledAt = 100))
        val remote = listOf(RemoteTrainerRow("t1", "Brock", "Gym Leader", "Kanto", "GymLeader", "Rock", wins = 3, losses = 4, firstDefeatedAt = 50L, lastBattledAt = 200))
        val result = MergeUtils.mergeTrainerRecords(local, remote)
        assertEquals(1, result.size)
        assertEquals(5, result[0].wins)   // max(5, 3)
        assertEquals(4, result[0].losses) // max(2, 4)
        assertEquals(200L, result[0].lastBattledAt) // max timestamp
    }

    @Test
    fun `mergeWildRecords uses max wins and losses`() {
        val local = listOf(WildRecord(25, "pikachu", wins = 10, losses = 1, lastBattledAt = 100))
        val remote = listOf(RemoteWildRow(25, "pikachu", wins = 8, losses = 3, lastBattledAt = 200))
        val result = MergeUtils.mergeWildRecords(local, remote)
        assertEquals(1, result.size)
        assertEquals(10, result[0].wins)  // max(10, 8)
        assertEquals(3, result[0].losses) // max(1, 3)
    }

    @Test
    fun `mergeSettings picks remote when newer`() {
        val local = MergeUtils.LocalSettings(5, false, "ASH", 100L)
        val remote = MergeUtils.RemoteSettings(3, true, "MISTY", 200L)
        val result = MergeUtils.mergeSettings(local, remote)
        assertEquals("MISTY", result.trainerName)
        assertEquals(3, result.generation)
    }

    @Test
    fun `mergeSettings picks local when newer`() {
        val local = MergeUtils.LocalSettings(5, false, "ASH", 300L)
        val remote = MergeUtils.RemoteSettings(3, true, "MISTY", 200L)
        val result = MergeUtils.mergeSettings(local, remote)
        assertEquals("ASH", result.trainerName)
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew :app:testDebugUnitTest --tests "com.madmaxlgndklr.pokedex.sync.SyncMergeTest" 2>&1 | tail -20
```

Expected: FAIL — `MergeUtils` does not exist yet

- [ ] **Step 3: Create `data/remote/SyncRepository.kt`**

```kotlin
package com.madmaxlgndklr.pokedex.data.remote

import com.madmaxlgndklr.pokedex.data.local.AppDatabase
import com.madmaxlgndklr.pokedex.data.local.SettingsRepository
import com.madmaxlgndklr.pokedex.data.local.TrainerRecord
import com.madmaxlgndklr.pokedex.data.local.WildRecord
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject

// ── Remote DTOs ──────────────────────────────────────────────────────────────

@Serializable
data class RemoteCaughtRow(
    @SerialName("pokemon_id") val pokemonId: Int,
    @SerialName("caught_at") val caughtAt: Long
)

@Serializable
data class RemoteTeamRow(
    @SerialName("team_json") val teamJson: List<Int>,
    @SerialName("updated_at") val updatedAt: Long
)

@Serializable
data class RemoteTrainerRow(
    @SerialName("trainer_id") val trainerId: String,
    val name: String,
    val title: String,
    val region: String,
    @SerialName("trainer_class") val trainerClass: String,
    @SerialName("type_specialty") val typeSpecialty: String,
    val wins: Int,
    val losses: Int,
    @SerialName("first_defeated_at") val firstDefeatedAt: Long?,
    @SerialName("last_battled_at") val lastBattledAt: Long
)

@Serializable
data class RemoteWildRow(
    @SerialName("pokemon_id") val pokemonId: Int,
    @SerialName("pokemon_name") val pokemonName: String,
    val wins: Int,
    val losses: Int,
    @SerialName("last_battled_at") val lastBattledAt: Long
)

@Serializable
data class RemoteBattleConfigRow(
    @SerialName("config_json") val configJson: JsonObject,
    @SerialName("updated_at") val updatedAt: Long
)

@Serializable
data class RemoteSettingsRow(
    val generation: Int,
    @SerialName("music_on_launch") val musicOnLaunch: Boolean,
    @SerialName("trainer_name") val trainerName: String,
    @SerialName("updated_at") val updatedAt: Long
)

// ── Pure merge helpers ────────────────────────────────────────────────────────

object MergeUtils {
    data class LocalSettings(
        val generation: Int,
        val musicOnLaunch: Boolean,
        val trainerName: String,
        val updatedAt: Long
    )
    data class RemoteSettings(
        val generation: Int,
        val musicOnLaunch: Boolean,
        val trainerName: String,
        val updatedAt: Long
    )

    fun mergeCaughtPokemon(local: List<Int>, remote: List<Int>): List<Int> =
        (local + remote).distinct()

    fun mergeTeam(local: List<Int>, localUpdatedAt: Long, remote: List<Int>?, remoteUpdatedAt: Long?): List<Int> {
        if (remote == null || remoteUpdatedAt == null) return local
        return if (remoteUpdatedAt > localUpdatedAt) remote else local
    }

    fun mergeTrainerRecords(local: List<TrainerRecord>, remote: List<RemoteTrainerRow>): List<TrainerRecord> {
        val map = mutableMapOf<String, TrainerRecord>()
        for (r in local) map[r.trainerId] = r.copy()
        for (r in remote) {
            val existing = map[r.trainerId]
            if (existing != null) {
                val localFirst = existing.firstDefeatedAt
                val remoteFirst = r.firstDefeatedAt
                map[r.trainerId] = existing.copy(
                    wins = maxOf(existing.wins, r.wins),
                    losses = maxOf(existing.losses, r.losses),
                    firstDefeatedAt = when {
                        localFirst != null && remoteFirst != null -> minOf(localFirst, remoteFirst)
                        else -> localFirst ?: remoteFirst
                    },
                    lastBattledAt = maxOf(existing.lastBattledAt, r.lastBattledAt)
                )
            } else {
                map[r.trainerId] = TrainerRecord(
                    trainerId = r.trainerId, name = r.name, title = r.title,
                    region = r.region, trainerClass = r.trainerClass, typeSpecialty = r.typeSpecialty,
                    wins = r.wins, losses = r.losses,
                    firstDefeatedAt = r.firstDefeatedAt,
                    lastBattledAt = r.lastBattledAt
                )
            }
        }
        return map.values.toList()
    }

    fun mergeWildRecords(local: List<WildRecord>, remote: List<RemoteWildRow>): List<WildRecord> {
        val map = mutableMapOf<Int, WildRecord>()
        for (r in local) map[r.pokemonId] = r.copy()
        for (r in remote) {
            val existing = map[r.pokemonId]
            if (existing != null) {
                map[r.pokemonId] = existing.copy(
                    wins = maxOf(existing.wins, r.wins),
                    losses = maxOf(existing.losses, r.losses),
                    lastBattledAt = maxOf(existing.lastBattledAt, r.lastBattledAt)
                )
            } else {
                map[r.pokemonId] = WildRecord(r.pokemonId, r.pokemonName, r.wins, r.losses, r.lastBattledAt)
            }
        }
        return map.values.toList()
    }

    fun mergeBattleConfig(localJson: String, localUpdatedAt: Long, remoteJson: String?, remoteUpdatedAt: Long?): String {
        if (remoteJson == null || remoteUpdatedAt == null) return localJson
        return if (remoteUpdatedAt > localUpdatedAt) remoteJson else localJson
    }

    fun mergeSettings(local: LocalSettings, remote: RemoteSettings?): LocalSettings {
        if (remote == null) return local
        return if (remote.updatedAt > local.updatedAt)
            LocalSettings(remote.generation, remote.musicOnLaunch, remote.trainerName, remote.updatedAt)
        else local
    }
}

// ── SyncRepository ────────────────────────────────────────────────────────────

class SyncRepository(
    private val db: AppDatabase,
    private val settingsRepo: SettingsRepository,
    private val scope: CoroutineScope
) {
    private val supabase = SupabaseModule.client
    private val pg = supabase.postgrest
    private val auth = supabase.auth

    private fun userId(): String? = auth.currentUserOrNull()?.id

    // ── syncOnOpen ─────────────────────────────────────────────────────────

    suspend fun syncOnOpen() {
        val uid = userId() ?: return
        try {
            val remote = pullAll(uid)
            writeLocal(remote)
            pushDiff(uid, remote)
        } catch (_: Exception) { /* silent — app works offline */ }
    }

    // ── pullAll ────────────────────────────────────────────────────────────

    private suspend fun pullAll(userId: String): RemoteState {
        val caught = pg.from("caught_pokemon")
            .select(Columns.list("pokemon_id", "caught_at")) { filter { eq("user_id", userId) } }
            .decodeList<RemoteCaughtRow>()

        val team = pg.from("team")
            .select(Columns.list("team_json", "updated_at")) { filter { eq("user_id", userId) } }
            .decodeSingleOrNull<RemoteTeamRow>()

        val trainers = pg.from("trainer_records")
            .select { filter { eq("user_id", userId) } }
            .decodeList<RemoteTrainerRow>()

        val wild = pg.from("wild_records")
            .select { filter { eq("user_id", userId) } }
            .decodeList<RemoteWildRow>()

        val config = pg.from("battle_config")
            .select(Columns.list("config_json", "updated_at")) { filter { eq("user_id", userId) } }
            .decodeSingleOrNull<RemoteBattleConfigRow>()

        val settings = pg.from("settings")
            .select(Columns.list("generation", "music_on_launch", "trainer_name", "updated_at")) { filter { eq("user_id", userId) } }
            .decodeSingleOrNull<RemoteSettingsRow>()

        return RemoteState(caught, team, trainers, wild, config, settings)
    }

    data class RemoteState(
        val caught: List<RemoteCaughtRow>,
        val team: RemoteTeamRow?,
        val trainers: List<RemoteTrainerRow>,
        val wild: List<RemoteWildRow>,
        val battleConfig: RemoteBattleConfigRow?,
        val settings: RemoteSettingsRow?
    )

    // ── writeLocal ─────────────────────────────────────────────────────────

    private suspend fun writeLocal(remote: RemoteState) {
        val dao = db.battleRecordDao()
        val caughtDao = db.caughtPokemonDao()

        // caught_pokemon
        val localCaught = caughtDao.getAllCaughtIds()
        val mergedCaught = MergeUtils.mergeCaughtPokemon(localCaught, remote.caught.map { it.pokemonId })
        caughtDao.replaceAll(mergedCaught.map { com.madmaxlgndklr.pokedex.data.local.CaughtPokemonEntity(it) })

        // team
        val localTeamIds = settingsRepo.team.first()
        val localTeamUpdatedAt = settingsRepo.teamUpdatedAt.first()
        val mergedTeam = MergeUtils.mergeTeam(localTeamIds, localTeamUpdatedAt, remote.team?.teamJson, remote.team?.updatedAt)
        settingsRepo.setTeam(mergedTeam)

        // trainer_records
        val localTrainers = dao.getAllTrainerRecords()
        val mergedTrainers = MergeUtils.mergeTrainerRecords(localTrainers, remote.trainers)
        dao.replaceAllTrainerRecords(mergedTrainers)

        // wild_records
        val localWild = dao.getAllWildRecords()
        val mergedWild = MergeUtils.mergeWildRecords(localWild, remote.wild)
        dao.replaceAllWildRecords(mergedWild)

        // battle_config
        val localConfigJson = settingsRepo.loadBattleConfigJson() ?: "{}"
        val localConfigUpdatedAt = settingsRepo.battleConfigUpdatedAt.first()
        val remoteConfigJson = remote.battleConfig?.configJson?.toString()
        val remoteConfigUpdatedAt = remote.battleConfig?.updatedAt
        val mergedConfig = MergeUtils.mergeBattleConfig(localConfigJson, localConfigUpdatedAt, remoteConfigJson, remoteConfigUpdatedAt)
        settingsRepo.saveBattleConfig(mergedConfig)

        // settings
        val localGen = settingsRepo.selectedGen.first()
        val localMusic = settingsRepo.musicOnLaunch.first()
        val localTrainerName = settingsRepo.trainerName.first()
        val localSettingsUpdatedAt = settingsRepo.settingsUpdatedAt.first()
        val localSettings = MergeUtils.LocalSettings(localGen, localMusic, localTrainerName, localSettingsUpdatedAt)
        val remoteSettings = remote.settings?.let {
            MergeUtils.RemoteSettings(it.generation, it.musicOnLaunch, it.trainerName, it.updatedAt)
        }
        val merged = MergeUtils.mergeSettings(localSettings, remoteSettings)
        if (merged !== localSettings) {
            settingsRepo.setGen(merged.generation)
            settingsRepo.setMusicOnLaunch(merged.musicOnLaunch)
            settingsRepo.setTrainerName(merged.trainerName)
        }
    }

    // ── pushDiff ────────────────────────────────────────────────────────────

    private suspend fun pushDiff(userId: String, remote: RemoteState) {
        val caughtDao = db.caughtPokemonDao()
        val dao = db.battleRecordDao()

        // caught_pokemon — push IDs missing from remote
        val remoteCaughtIds = remote.caught.map { it.pokemonId }.toSet()
        val localCaught = caughtDao.getAllCaughtIds()
        val missing = localCaught.filter { it !in remoteCaughtIds }
        if (missing.isNotEmpty()) {
            val now = System.currentTimeMillis()
            pg.from("caught_pokemon").upsert(missing.map { mapOf("user_id" to userId, "pokemon_id" to it, "caught_at" to now) })
        }

        // trainer_records — upsert all local
        val trainers = dao.getAllTrainerRecords()
        if (trainers.isNotEmpty()) {
            pg.from("trainer_records").upsert(trainers.map { t ->
                mapOf(
                    "user_id" to userId, "trainer_id" to t.trainerId,
                    "name" to t.name, "title" to t.title, "region" to t.region,
                    "trainer_class" to t.trainerClass, "type_specialty" to t.typeSpecialty,
                    "wins" to t.wins, "losses" to t.losses,
                    "first_defeated_at" to t.firstDefeatedAt,
                    "last_battled_at" to t.lastBattledAt
                )
            })
        }

        // wild_records — upsert all local
        val wildRecords = dao.getAllWildRecords()
        if (wildRecords.isNotEmpty()) {
            pg.from("wild_records").upsert(wildRecords.map { w ->
                mapOf(
                    "user_id" to userId, "pokemon_id" to w.pokemonId,
                    "pokemon_name" to w.pokemonName,
                    "wins" to w.wins, "losses" to w.losses,
                    "last_battled_at" to w.lastBattledAt
                )
            })
        }
    }

    // ── fire-and-forget push functions ────────────────────────────────────

    fun pushCaughtToggle(pokemonId: Int, isCaught: Boolean) {
        val uid = userId() ?: return
        scope.launch(Dispatchers.IO) {
            runCatching {
                if (isCaught) {
                    pg.from("caught_pokemon").upsert(mapOf("user_id" to uid, "pokemon_id" to pokemonId, "caught_at" to System.currentTimeMillis()))
                } else {
                    pg.from("caught_pokemon").delete { filter { eq("user_id", uid); eq("pokemon_id", pokemonId) } }
                }
            }
        }
    }

    fun pushTeam(teamIds: List<Int>) {
        val uid = userId() ?: return
        val now = System.currentTimeMillis()
        scope.launch(Dispatchers.IO) {
            runCatching { pg.from("team").upsert(mapOf("user_id" to uid, "team_json" to teamIds, "updated_at" to now)) }
        }
    }

    fun pushTrainerRecord(record: TrainerRecord) {
        val uid = userId() ?: return
        scope.launch(Dispatchers.IO) {
            runCatching {
                pg.from("trainer_records").upsert(mapOf(
                    "user_id" to uid, "trainer_id" to record.trainerId,
                    "name" to record.name, "title" to record.title, "region" to record.region,
                    "trainer_class" to record.trainerClass, "type_specialty" to record.typeSpecialty,
                    "wins" to record.wins, "losses" to record.losses,
                    "first_defeated_at" to record.firstDefeatedAt,
                    "last_battled_at" to record.lastBattledAt
                ))
            }
        }
    }

    fun pushWildRecord(record: WildRecord) {
        val uid = userId() ?: return
        scope.launch(Dispatchers.IO) {
            runCatching {
                pg.from("wild_records").upsert(mapOf(
                    "user_id" to uid, "pokemon_id" to record.pokemonId,
                    "pokemon_name" to record.pokemonName,
                    "wins" to record.wins, "losses" to record.losses,
                    "last_battled_at" to record.lastBattledAt
                ))
            }
        }
    }

    fun pushBattleConfig(configJson: String, updatedAt: Long) {
        val uid = userId() ?: return
        scope.launch(Dispatchers.IO) {
            runCatching {
                pg.from("battle_config").upsert(mapOf(
                    "user_id" to uid,
                    "config_json" to kotlinx.serialization.json.Json.parseToJsonElement(configJson),
                    "updated_at" to updatedAt
                ))
            }
        }
    }

    fun pushSettings(generation: Int, musicOnLaunch: Boolean, trainerName: String, updatedAt: Long) {
        val uid = userId() ?: return
        scope.launch(Dispatchers.IO) {
            runCatching {
                pg.from("settings").upsert(mapOf(
                    "user_id" to uid,
                    "generation" to generation,
                    "music_on_launch" to musicOnLaunch,
                    "trainer_name" to trainerName,
                    "updated_at" to updatedAt
                ))
            }
        }
    }
}
```

- [ ] **Step 4: Add missing DAO methods that `writeLocal` and `pushDiff` call**

`writeLocal` needs `dao.replaceAllTrainerRecords` and `dao.replaceAllWildRecords`. Add them to `BattleRecordDao` in `data/local/BattleRecord.kt`:

```kotlin
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllTrainerRecords(records: List<TrainerRecord>)

    @Query("DELETE FROM trainer_records")
    suspend fun deleteAllTrainerRecords()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAllWildRecords(records: List<WildRecord>)

    @Query("DELETE FROM wild_records")
    suspend fun deleteAllWildRecords()
```

Then in `BattleRecordRepository`, add convenience wrappers:
```kotlin
    suspend fun replaceAllTrainerRecords(records: List<TrainerRecord>) {
        dao.deleteAllTrainerRecords()
        dao.insertAllTrainerRecords(records)
    }

    suspend fun replaceAllWildRecords(records: List<WildRecord>) {
        dao.deleteAllWildRecords()
        dao.insertAllWildRecords(records)
    }
```

`writeLocal` also calls `caughtDao.getAllCaughtIds()` and `caughtDao.replaceAll()`. Add them to `CaughtPokemonDao` in `data/local/CaughtPokemonDao.kt`:
```kotlin
    @Query("SELECT pokemonId FROM caught_pokemon")
    suspend fun getAllCaughtIds(): List<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<CaughtPokemonEntity>)

    @Query("DELETE FROM caught_pokemon")
    suspend fun deleteAll()
```

Add `replaceAll` to the DAO or call `deleteAll` + `insertAll` from SyncRepository's `writeLocal` (update the call site to `caughtDao.deleteAll(); caughtDao.insertAll(...)`).

`writeLocal` also needs `settingsRepo.teamUpdatedAt`, `settingsRepo.battleConfigUpdatedAt`, and `settingsRepo.settingsUpdatedAt` flows. Add them to `SettingsRepository`:

```kotlin
    private val TEAM_UPDATED_AT_KEY = longPreferencesKey("team_updated_at")
    val teamUpdatedAt: Flow<Long> = dataStore.data.map { it[TEAM_UPDATED_AT_KEY] ?: 0L }
    suspend fun setTeamUpdatedAt(ts: Long) { dataStore.edit { it[TEAM_UPDATED_AT_KEY] = ts } }

    private val BATTLE_CONFIG_UPDATED_AT_KEY = longPreferencesKey("battle_config_updated_at")
    val battleConfigUpdatedAt: Flow<Long> = dataStore.data.map { it[BATTLE_CONFIG_UPDATED_AT_KEY] ?: 0L }
    suspend fun setBattleConfigUpdatedAt(ts: Long) { dataStore.edit { it[BATTLE_CONFIG_UPDATED_AT_KEY] = ts } }

    private val SETTINGS_UPDATED_AT_KEY = longPreferencesKey("settings_updated_at")
    val settingsUpdatedAt: Flow<Long> = dataStore.data.map { it[SETTINGS_UPDATED_AT_KEY] ?: 0L }
    suspend fun setSettingsUpdatedAt(ts: Long) { dataStore.edit { it[SETTINGS_UPDATED_AT_KEY] = ts } }
```

Also update `setTeam` in `SettingsRepository` to persist `team_updated_at`:
```kotlin
    suspend fun setTeam(ids: List<Int>) {
        val now = System.currentTimeMillis()
        dataStore.edit { prefs ->
            prefs[TEAM_KEY] = ids.take(6).joinToString(",")
            prefs[TEAM_UPDATED_AT_KEY] = now
        }
    }
```

Also update `saveBattleConfig` to persist `battle_config_updated_at`:
```kotlin
    suspend fun saveBattleConfig(json: String) {
        val now = System.currentTimeMillis()
        dataStore.edit { prefs ->
            prefs[BATTLE_CONFIG_KEY] = json
            prefs[BATTLE_CONFIG_UPDATED_AT_KEY] = now
        }
    }
```

And update `setGen`, `setMusicOnLaunch`, `setTrainerName` to update `settings_updated_at`:
```kotlin
    suspend fun setGen(gen: Int) {
        val now = System.currentTimeMillis()
        dataStore.edit { prefs ->
            prefs[SELECTED_GEN_KEY] = gen
            prefs[SETTINGS_UPDATED_AT_KEY] = now
        }
    }

    suspend fun setMusicOnLaunch(enabled: Boolean) {
        val now = System.currentTimeMillis()
        dataStore.edit { prefs ->
            prefs[MUSIC_ON_LAUNCH] = enabled
            prefs[SETTINGS_UPDATED_AT_KEY] = now
        }
    }

    suspend fun setTrainerName(name: String) {
        val now = System.currentTimeMillis()
        dataStore.edit { prefs ->
            prefs[TRAINER_NAME_KEY] = name.take(16)
            prefs[SETTINGS_UPDATED_AT_KEY] = now
        }
    }
```

- [ ] **Step 5: Run the merge tests**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew :app:testDebugUnitTest --tests "com.madmaxlgndklr.pokedex.sync.SyncMergeTest" 2>&1 | tail -30
```

Expected: 7 tests PASS

- [ ] **Step 6: Build the full app**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew assembleDebug 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 7: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add \
  app/src/main/java/com/madmaxlgndklr/pokedex/data/remote/SyncRepository.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/data/local/BattleRecord.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/data/local/CaughtPokemonDao.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/data/local/SettingsDataStore.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/data/repository/BattleRecordRepository.kt \
  app/src/test/java/com/madmaxlgndklr/pokedex/sync/SyncMergeTest.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: add SyncRepository with merge logic and remote DTOs"
```

---

### Task 6: Update `PokedexApplication.kt`

**Files:**
- Modify: `app/src/main/java/com/madmaxlgndklr/pokedex/PokedexApplication.kt`

Wire in `AuthRepository` and `SyncRepository`, and trigger anonymous sign-in + syncOnOpen on startup.

- [ ] **Step 1: Update `PokedexApplication.kt`**

Add these lazy vals after `settingsRepository`:
```kotlin
    val authRepository by lazy { AuthRepository() }
    val syncRepository by lazy {
        SyncRepository(database, settingsRepository, appScope)
    }
```

Add imports:
```kotlin
import com.madmaxlgndklr.pokedex.data.remote.AuthRepository
import com.madmaxlgndklr.pokedex.data.remote.SyncRepository
import com.madmaxlgndklr.pokedex.data.remote.SupabaseModule
```

Update `onCreate()` to sign in anonymously and sync:
```kotlin
    override fun onCreate() {
        super.onCreate()
        appScope.launch {
            filesDir.listFiles { _, n -> n.endsWith(".tmp") }?.forEach { it.delete() }
        }
        CryPlayer.init(this, networkObserver)
        appScope.launch {
            runCatching { authRepository.signInAnonymously() }
            syncRepository.syncOnOpen()
        }
    }
```

- [ ] **Step 2: Build**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew assembleDebug 2>&1 | tail -10
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add app/src/main/java/com/madmaxlgndklr/pokedex/PokedexApplication.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: init Supabase, anonymous sign-in, and syncOnOpen in Application"
```

---

### Task 7: Wire fire-and-forget pushes

**Files:**
- Modify: `data/repository/BattleRecordRepository.kt`

After every trainer/wild record upsert, call the relevant push function on SyncRepository. Pass `syncRepository` in via constructor.

- [ ] **Step 1: Update `BattleRecordRepository` constructor and upsert methods**

Current constructor:
```kotlin
class BattleRecordRepository(private val dao: BattleRecordDao)
```

New constructor:
```kotlin
class BattleRecordRepository(
    private val dao: BattleRecordDao,
    private val sync: com.madmaxlgndklr.pokedex.data.remote.SyncRepository? = null
)
```

After the `dao.upsertTrainerRecord(record)` call:
```kotlin
    sync?.pushTrainerRecord(record)
```

After the `dao.upsertWildRecord(record)` call:
```kotlin
    sync?.pushWildRecord(record)
```

- [ ] **Step 2: Update `PokedexApplication` to pass `syncRepository` to `BattleRecordRepository`**

In `PokedexApplication`, change:
```kotlin
    val battleRecordRepository by lazy { BattleRecordRepository(database.battleRecordDao()) }
```

to:
```kotlin
    val battleRecordRepository by lazy { BattleRecordRepository(database.battleRecordDao(), syncRepository) }
```

- [ ] **Step 3: Build**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew assembleDebug 2>&1 | tail -10
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add \
  app/src/main/java/com/madmaxlgndklr/pokedex/data/repository/BattleRecordRepository.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/PokedexApplication.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: fire-and-forget push after every battle record upsert"
```

---

### Task 8: Create `ui/profile/ProfileViewModel.kt`

**Files:**
- Create: `app/src/main/java/com/madmaxlgndklr/pokedex/ui/profile/ProfileViewModel.kt`

- [ ] **Step 1: Create the file**

```kotlin
package com.madmaxlgndklr.pokedex.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.madmaxlgndklr.pokedex.data.local.SettingsRepository
import com.madmaxlgndklr.pokedex.data.remote.AuthRepository
import com.madmaxlgndklr.pokedex.data.remote.SyncRepository
import io.github.jan.supabase.auth.user.UserInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ProfileViewModel(
    private val settingsRepo: SettingsRepository,
    private val authRepo: AuthRepository,
    private val syncRepo: SyncRepository
) : ViewModel() {

    val trainerName: StateFlow<String> = settingsRepo.trainerName
        .stateIn(viewModelScope, SharingStarted.Eagerly, "")

    private val _currentUser = MutableStateFlow<UserInfo?>(authRepo.currentUser())
    val currentUser: StateFlow<UserInfo?> = _currentUser

    val isAnonymous: Boolean get() = authRepo.isAnonymous()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    fun saveTrainerName(name: String) {
        viewModelScope.launch {
            settingsRepo.setTrainerName(name)
            val uid = authRepo.currentUserId() ?: return@launch
            val gen = settingsRepo.selectedGen.stateIn(viewModelScope, SharingStarted.Eagerly, 5).value
            val music = settingsRepo.musicOnLaunch.stateIn(viewModelScope, SharingStarted.Eagerly, true).value
            val updatedAt = settingsRepo.settingsUpdatedAt.stateIn(viewModelScope, SharingStarted.Eagerly, 0L).value
            syncRepo.pushSettings(gen, music, name.take(16), updatedAt)
        }
    }

    fun signInWithEmail(email: String, password: String) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            runCatching { authRepo.signInWithEmail(email, password) }
                .onSuccess {
                    _currentUser.value = authRepo.currentUser()
                    syncRepo.syncOnOpen()
                }
                .onFailure { _error.value = it.message }
            _loading.value = false
        }
    }

    fun signUpWithEmail(email: String, password: String) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            runCatching { authRepo.signUpWithEmail(email, password) }
                .onSuccess { _currentUser.value = authRepo.currentUser() }
                .onFailure { _error.value = it.message }
            _loading.value = false
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { authRepo.signOut() }
            runCatching { authRepo.signInAnonymously() }
            _currentUser.value = authRepo.currentUser()
        }
    }

    fun onGoogleSignInResult() {
        viewModelScope.launch {
            _currentUser.value = authRepo.currentUser()
            syncRepo.syncOnOpen()
        }
    }

    fun clearError() { _error.value = null }

    companion object {
        fun factory(
            settingsRepo: SettingsRepository,
            authRepo: AuthRepository,
            syncRepo: SyncRepository
        ) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>) =
                ProfileViewModel(settingsRepo, authRepo, syncRepo) as T
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew :app:compileDebugKotlin 2>&1 | grep -E "error:" | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add app/src/main/java/com/madmaxlgndklr/pokedex/ui/profile/ProfileViewModel.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: add ProfileViewModel (trainer name, auth state, sign-in/out)"
```

---

### Task 9: Create `ui/profile/ProfileScreen.kt`

**Files:**
- Create: `app/src/main/java/com/madmaxlgndklr/pokedex/ui/profile/ProfileScreen.kt`

Style to match the rest of the app: `PressStart2P` font, `PokedexDark`/`PokedexCream`/`CaughtGold`/`GlowBlue` colours, `pdex_open_v2` background image.

- [ ] **Step 1: Create the file**

```kotlin
package com.madmaxlgndklr.pokedex.ui.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.madmaxlgndklr.pokedex.R
import com.madmaxlgndklr.pokedex.ui.theme.*
import io.github.jan.supabase.compose.auth.composable.rememberSignInWithGoogle
import io.github.jan.supabase.compose.auth.ui.ProviderButtonContent
import com.madmaxlgndklr.pokedex.data.remote.SupabaseModule
import io.github.jan.supabase.compose.auth.ComposeAuth
import io.github.jan.supabase.compose.auth.composeAuth
import io.github.jan.supabase.compose.auth.composable.NativeSignInResult

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onBack: () -> Unit
) {
    val trainerName by viewModel.trainerName.collectAsState()
    val currentUser by viewModel.currentUser.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val error by viewModel.error.collectAsState()

    var draft by remember { mutableStateOf<String?>(null) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current

    val displayed = draft ?: trainerName
    val isAnonymous = viewModel.isAnonymous

    val googleSignIn = SupabaseModule.client.composeAuth.rememberSignInWithGoogle(
        onResult = { result ->
            when (result) {
                is NativeSignInResult.Success -> viewModel.onGoogleSignInResult()
                is NativeSignInResult.Error -> { /* error shown via viewModel.error */ }
                else -> {}
            }
        }
    )

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val sw = maxWidth
        val sh = maxHeight

        Image(
            painter = painterResource(R.drawable.pdex_open_v2),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        IconButton(
            onClick = onBack,
            modifier = Modifier.offset(x = 2.dp, y = 2.dp).size(36.dp)
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = PokedexCream)
        }

        Column(
            modifier = Modifier
                .offset(x = sw * 0.04f, y = sh * 0.25f)
                .fillMaxWidth(0.92f)
                .height(sh * 0.65f)
                .background(PokedexDark.copy(alpha = 0.85f), RoundedCornerShape(8.dp))
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("TRAINER PROFILE", fontFamily = PressStart2P, fontSize = 8.sp, color = CaughtGold)
            HorizontalDivider(color = PokedexCream.copy(alpha = 0.25f))

            // ── Trainer Name ──────────────────────────────────────────────
            Text("TRAINER NAME", fontFamily = PressStart2P, fontSize = 6.sp, color = PokedexCream.copy(alpha = 0.6f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = displayed,
                    onValueChange = { draft = it.take(16) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    textStyle = LocalTextStyle.current.copy(fontFamily = PressStart2P, fontSize = 7.sp, color = PokedexCream),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = GlowBlue,
                        unfocusedBorderColor = PokedexCream.copy(alpha = 0.3f)
                    ),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = {
                        keyboard?.hide()
                        draft?.let { viewModel.saveTrainerName(it); draft = null }
                    })
                )
                TextButton(
                    onClick = { draft?.let { viewModel.saveTrainerName(it); draft = null } },
                    enabled = draft != null
                ) {
                    Text("SAVE", fontFamily = PressStart2P, fontSize = 6.sp, color = if (draft != null) GlowBlue else PokedexCream.copy(alpha = 0.3f))
                }
            }

            HorizontalDivider(color = PokedexCream.copy(alpha = 0.25f))

            // ── Auth section ──────────────────────────────────────────────
            Text("SYNC ACCOUNT", fontFamily = PressStart2P, fontSize = 6.sp, color = PokedexCream.copy(alpha = 0.6f))

            if (currentUser != null && !isAnonymous) {
                // Signed-in state
                Text(
                    text = (currentUser!!.email ?: "GOOGLE ACCOUNT").uppercase(),
                    fontFamily = PressStart2P, fontSize = 6.sp, color = CaughtGold,
                    modifier = Modifier.fillMaxWidth()
                )
                TextButton(onClick = { viewModel.signOut() }) {
                    Text("SIGN OUT", fontFamily = PressStart2P, fontSize = 6.sp, color = PokedexCream.copy(alpha = 0.6f))
                }
            } else {
                // Anonymous state — show sign-in/up form
                Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                    listOf(false to "SIGN IN", true to "CREATE ACCOUNT").forEach { (signup, label) ->
                        TextButton(
                            onClick = { isSignUp = signup; error?.let { viewModel.clearError() } },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                label, fontFamily = PressStart2P, fontSize = 5.sp,
                                color = if (isSignUp == signup) GlowBlue else PokedexCream.copy(alpha = 0.4f)
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = email, onValueChange = { email = it },
                    label = { Text("EMAIL", fontFamily = PressStart2P, fontSize = 5.sp, color = PokedexCream.copy(0.5f)) },
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                    textStyle = LocalTextStyle.current.copy(fontFamily = PressStart2P, fontSize = 6.sp, color = PokedexCream),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GlowBlue, unfocusedBorderColor = PokedexCream.copy(0.3f))
                )
                OutlinedTextField(
                    value = password, onValueChange = { password = it },
                    label = { Text("PASSWORD", fontFamily = PressStart2P, fontSize = 5.sp, color = PokedexCream.copy(0.5f)) },
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation(),
                    textStyle = LocalTextStyle.current.copy(fontFamily = PressStart2P, fontSize = 6.sp, color = PokedexCream),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = GlowBlue, unfocusedBorderColor = PokedexCream.copy(0.3f))
                )

                if (error != null) {
                    Text(error!!, fontFamily = PressStart2P, fontSize = 5.sp, color = Color.Red.copy(alpha = 0.8f))
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            keyboard?.hide()
                            if (isSignUp) viewModel.signUpWithEmail(email, password)
                            else viewModel.signInWithEmail(email, password)
                        },
                        enabled = !loading && email.isNotBlank() && password.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = GlowBlue)
                    ) {
                        if (loading) CircularProgressIndicator(Modifier.size(14.dp), color = Color.White, strokeWidth = 2.dp)
                        else Text(if (isSignUp) "CREATE" else "SIGN IN", fontFamily = PressStart2P, fontSize = 5.sp)
                    }

                    OutlinedButton(
                        onClick = { googleSignIn.startFlow() },
                        enabled = !loading,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PokedexCream)
                    ) {
                        Text("GOOGLE", fontFamily = PressStart2P, fontSize = 5.sp)
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew assembleDebug 2>&1 | tail -15
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add app/src/main/java/com/madmaxlgndklr/pokedex/ui/profile/
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: add ProfileScreen with trainer name and auth UI"
```

---

### Task 10: Wire Profile into navigation and Settings

**Files:**
- Modify: `ui/navigation/AppNavigation.kt`
- Modify: `ui/settings/SettingsScreen.kt`

- [ ] **Step 1: Add PROFILE to `Routes` object and add composable in `AppNavigation.kt`**

In `Routes` object, append:
```kotlin
    const val PROFILE = "profile"
```

Add imports at the top:
```kotlin
import com.madmaxlgndklr.pokedex.ui.profile.ProfileScreen
import com.madmaxlgndklr.pokedex.ui.profile.ProfileViewModel
```

Inside the `NavHost` block (after the `Routes.SETTINGS` composable), add:
```kotlin
            composable(Routes.PROFILE) {
                val app = context.applicationContext as PokedexApplication
                val vm: ProfileViewModel = viewModel(
                    factory = ProfileViewModel.factory(
                        app.settingsRepository,
                        app.authRepository,
                        app.syncRepository
                    )
                )
                ProfileScreen(
                    viewModel = vm,
                    onBack = { navController.popBackStack() }
                )
            }
```

- [ ] **Step 2: Add "TRAINER PROFILE" row to `SettingsScreen.kt`**

The `SettingsScreen` composable has an `onNavigateFullList` and `onNavigateMyCollection` parameter. Add `onNavigateProfile: () -> Unit` to the signature:

```kotlin
fun SettingsScreen(
    viewModel: SettingsViewModel,
    isMuted: Boolean,
    onToggleMute: () -> Unit,
    onBack: () -> Unit,
    onNavigateFullList: () -> Unit,
    onNavigateMyCollection: () -> Unit,
    onNavigateProfile: () -> Unit   // add this
)
```

Inside the settings panel `Column`, just below the `HorizontalDivider` after VERSION, add:

```kotlin
            // Trainer Profile row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) { onNavigateProfile() },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "TRAINER PROFILE",
                    fontFamily = PressStart2P,
                    fontSize = 7.sp,
                    color = PokedexCream
                )
                Text(
                    text = "▶",
                    fontFamily = PressStart2P,
                    fontSize = 7.sp,
                    color = GlowBlue
                )
            }

            HorizontalDivider(color = PokedexCream.copy(alpha = 0.25f))
```

- [ ] **Step 3: Update the `SettingsScreen` call site in `AppNavigation.kt`**

Find the `SettingsScreen(...)` call and add `onNavigateProfile`:
```kotlin
                SettingsScreen(
                    viewModel = vm,
                    isMuted = isMuted,
                    onToggleMute = { ... },
                    onBack = { navController.popBackStack() },
                    onNavigateFullList = { ... },
                    onNavigateMyCollection = { ... },
                    onNavigateProfile = { navController.navigate(Routes.PROFILE) }
                )
```

- [ ] **Step 4: Build the full app**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew assembleDebug 2>&1 | tail -10
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Run all unit tests**

```bash
cd /home/madmaxlgndklr/Git/sandbox/Pokedex && ./gradlew :app:testDebugUnitTest 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex add \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/navigation/AppNavigation.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/settings/SettingsScreen.kt
git -C /home/madmaxlgndklr/Git/sandbox/Pokedex commit -m "feat: add Profile route and Settings → Trainer Profile row"
```

---

## Done

**Manual smoke test after installing the debug APK:**
1. Launch app → check no crash → anonymous Supabase session created silently
2. Settings → TRAINER PROFILE → set a name → force-stop app → reopen → name persists
3. Settings → TRAINER PROFILE → CREATE ACCOUNT → check Supabase dashboard Auth tab shows new user
4. Sign out → new anonymous session created
5. Sign in again → syncOnOpen merges data → check Supabase `settings` table has `trainer_name`
6. GOOGLE button → Google account picker → pick account → signed in → check Supabase Auth tab
