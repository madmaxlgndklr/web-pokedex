# Android: Moves-Bound-to-Slot Fix + Sprite Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Android battle moves bug (custom moves/overrides are stored by slot index instead of pokemonId, so reordering the team gives the wrong Pokémon another Pokémon's move config) and add a three-mode sprite toggle (Modern 3D GIFs / Retro Game Boy / DS Animated) that persists in DataStore.

**Architecture:**
- **Moves fix:** Change `BattleSetup.teamOverrides: Map<Int, SlotOverride>` key from slot index (0–5) to pokemonId. Store `teamIds` inside `TurnBattleViewModel` so slot→pokemonId conversion can happen in the ViewModel without requiring UI changes to function call signatures. Update all read/write paths and serialization. Old saved configs with slot-index keys will gracefully produce no overrides (defaults apply).
- **Sprite toggle:** Add `sprite_mode` to `SettingsDataStore`. Create a `LocalSpriteMode` CompositionLocal provided at the app root via `SettingsViewModel`. Create a `PokemonImage` composable that reads `LocalSpriteMode`, computes the mode-aware URL from `RetrofitClient.spriteUrl(id, name, mode)`, and falls back to the GitHub CDN on error. Replace all direct `RetrofitClient.spriteUrl(id)` call sites with `PokemonImage`.

**Tech Stack:** Kotlin, Jetpack Compose, DataStore, Room (unchanged), Coil3 (`AsyncImage`), Retrofit, existing PokeAPI asset server at `https://madmaxlgndklrpokeapi.com`

**Repo:** `/home/madmaxlgndklr/Git/sandbox/Pokedex`

---

## File Map

**Moves fix:**
| File | Change |
|---|---|
| Modify: `ui/battle/TurnBattleViewModel.kt` | Store `_teamIds`; change `teamOverrides` key to pokemonId; update all slot mutation functions |
| Modify: `ui/battle/BattleConfigStore.kt` | Change filter in `loadSetup` deserialization from `>= 1` to `> 0` |

**Sprite toggle:**
| File | Change |
|---|---|
| Modify: `data/local/SettingsDataStore.kt` | Add `SPRITE_MODE_KEY`, `spriteMode` Flow, `setSpriteMode()` |
| Modify: `data/remote/RetrofitClient.kt` | Add `spriteUrl(id, name, mode)` overload + `genFromId()` private helper |
| Create: `ui/common/SpriteModeProvider.kt` | `LocalSpriteMode` CompositionLocal + `SpriteModeProvider` wrapper |
| Create: `ui/common/PokemonImage.kt` | `PokemonImage` composable using `LocalSpriteMode` + Coil fallback |
| Modify: `ui/settings/SettingsViewModel.kt` | Expose `spriteMode: StateFlow<String>` + `setSpriteMode()` |
| Modify: `ui/settings/SettingsScreen.kt` | Add sprite mode selector section |
| Modify: `MainActivity.kt` | Wrap content in `SpriteModeProvider` collecting from `SettingsViewModel.spriteMode` |
| Modify: `ui/common/PokemonSpriteGrid.kt` | Replace `AsyncImage(RetrofitClient.spriteUrl(id))` with `PokemonImage(id, name)` |
| Modify: `ui/battle/TurnBattleScreen.kt` | Replace `AsyncImage(RetrofitClient.spriteUrl(...))` with `PokemonImage(id, name)` (4 sites) |
| Modify: `ui/detail/DetailScreen.kt` | Replace sprite `AsyncImage` calls with `PokemonImage` (2 sites) |
| Modify: `ui/team/TeamScreen.kt` | Replace sprite `AsyncImage` with `PokemonImage` |
| Modify: `ui/battle/MatchupScreen.kt` | Replace sprite `AsyncImage` with `PokemonImage` |
| Modify: `ui/battle/RecordScreen.kt` | Replace sprite `AsyncImage` with `PokemonImage` (2 sites) |
| Modify: `ui/battle/DamageCalcScreen.kt` | Replace sprite `AsyncImage` with `PokemonImage` |
| Modify: `ui/list/FullListScreen.kt` | Replace sprite `AsyncImage` with `PokemonImage` |
| Modify: `ui/mycollection/MyCollectionScreen.kt` | Replace sprite `AsyncImage` with `PokemonImage` |
| Modify: `ui/battle/TrainerSelectScreen.kt` | Replace sprite `AsyncImage` calls with `PokemonImage` (2 sites) |

---

### Task 1: Fix BattleSetup.teamOverrides to key by pokemonId

**Files:**
- Modify: `ui/battle/TurnBattleViewModel.kt`

Context: `BattleSetup.teamOverrides: Map<Int, SlotOverride>` currently uses slot index (0, 1, 2, …) as the key. All slot mutation functions (`toggleSlotMove`, `setSlotLevel`, `setSlotNature`, `setSlotStatConfig`, `setSlotOverride`) and `startBattleFromSetup`/`startTrainerBattle` use `s.teamOverrides[idx]` where `idx` is slot index. The fix: key by pokemonId (the actual Pokémon ID in that slot). The ViewModel needs to store `teamIds` to do slot→pokemonId conversion.

- [ ] **Step 1: Add `_teamIds` storage to TurnBattleViewModel**

Add a private field just below the existing `_selectedSetupSlot` declaration (around line 103):

```kotlin
private var _teamIds: List<Int> = emptyList()
```

- [ ] **Step 2: Store teamIds in loadSetup and loadTrainerSetup**

In `loadSetup(teamIds: List<Int>, pickIndex: Int = 0)`, add as the first line of the function body (before the `if (_setup.value != null || _isLoading.value) return` guard — actually add after the guard since teamIds should always be stored):

```kotlin
fun loadSetup(teamIds: List<Int>, pickIndex: Int = 0) {
    _teamIds = teamIds  // store for pokemonId lookups
    if (_setup.value != null || _isLoading.value) return
    // ... rest unchanged
```

In `loadTrainerSetup(trainer: Trainer, rosterIndex: Int, teamIds: List<Int>)`:

```kotlin
fun loadTrainerSetup(trainer: Trainer, rosterIndex: Int, teamIds: List<Int>) {
    _teamIds = teamIds  // store for pokemonId lookups
    _battleTrainer.value = SelectedTrainer(trainer, rosterIndex)
    _setup.value = null
    loadSetup(teamIds)
}
```

- [ ] **Step 3: Change setSlotOverride to accept pokemonId**

`setSlotOverride` currently accepts `slotIndex: Int`. Rename the parameter to `pokemonId` (no logic change — the map key just has a different semantic meaning now):

```kotlin
fun setSlotOverride(pokemonId: Int, override: SlotOverride?) {
    val s = _setup.value ?: return
    val newOverrides = s.teamOverrides.toMutableMap()
    if (override == null) newOverrides.remove(pokemonId)
    else newOverrides[pokemonId] = override
    _setup.value = s.copy(teamOverrides = newOverrides)
}
```

- [ ] **Step 4: Update toggleSlotMove to use pokemonId**

```kotlin
fun toggleSlotMove(slot: Int, moveName: String) {
    if (slot == 0) { toggleSetupMove(moveName); return }
    val s = _setup.value ?: return
    val pokemonId = _teamIds.getOrNull(slot) ?: return
    val ov = s.teamOverrides[pokemonId]
    val detail = _slotDetails.value[slot] ?: return
    val level = ov?.level ?: s.level
    val autoMoves = learnableMoves(detail, level).filter { it.available }.take(4).map { it.name }
    val current = ov?.selectedMoveNames ?: autoMoves
    val newSelected = when {
        moveName in current -> current - moveName
        current.size < 4 -> current + moveName
        else -> current
    }
    val newOv = (ov ?: SlotOverride()).copy(selectedMoveNames = newSelected)
    setSlotOverride(pokemonId, newOv)
}
```

- [ ] **Step 5: Update setSlotLevel to use pokemonId**

```kotlin
fun setSlotLevel(slot: Int, level: Int) {
    if (slot == 0) { setSetupLevel(level); return }
    val s = _setup.value ?: return
    val pokemonId = _teamIds.getOrNull(slot) ?: return
    val clamped = level.coerceIn(1, 100)
    val detail = _slotDetails.value[slot] ?: return
    val ov = s.teamOverrides[pokemonId]
    val availableNames = learnableMoves(detail, clamped).filter { it.available }.map { it.name }.toSet()
    val filteredMoves = ov?.selectedMoveNames?.filter { it in availableNames }
    val newOv = (ov ?: SlotOverride()).copy(level = clamped, selectedMoveNames = filteredMoves)
    val effective = if (newOv.level == s.level && newOv.nature == null && newOv.selectedMoveNames == null && newOv.heldItem == null && newOv.statConfig == null) null else newOv
    setSlotOverride(pokemonId, effective)
}
```

- [ ] **Step 6: Update setSlotNature to use pokemonId**

```kotlin
fun setSlotNature(slot: Int, nature: Nature) {
    if (slot == 0) { setNature(nature); return }
    val s = _setup.value ?: return
    val pokemonId = _teamIds.getOrNull(slot) ?: return
    val ov = s.teamOverrides[pokemonId]
    val newOv = (ov ?: SlotOverride()).copy(nature = nature)
    setSlotOverride(pokemonId, newOv)
}
```

- [ ] **Step 7: Update setSlotStatConfig to use pokemonId**

```kotlin
fun setSlotStatConfig(slot: Int, config: StatConfig) {
    if (slot == 0) { setStatConfig(config); return }
    val s = _setup.value ?: return
    val pokemonId = _teamIds.getOrNull(slot) ?: return
    val ov = s.teamOverrides[pokemonId]
    val newOv = (ov ?: SlotOverride()).copy(statConfig = config)
    setSlotOverride(pokemonId, newOv)
}
```

- [ ] **Step 8: Update startBattleFromSetup to look up override by pokemonId**

In `startBattleFromSetup`, find the `val ov = s.teamOverrides[idx]` line and change:

```kotlin
val playerTeam = teamIds.mapIndexed { idx, pokemonId ->
    val detail = if (idx == 0) s.playerDetail else {
        try { repo.getPokemonDetail(pokemonId) } catch (e: Exception) { s.playerDetail }
    }
    val ov = s.teamOverrides[pokemonId]  // ← was s.teamOverrides[idx]
    val level = ov?.level ?: s.level
    val statConfig = ov?.statConfig ?: s.statConfig
    val nature = ov?.nature ?: s.nature
    val heldItem = ov?.heldItem ?: s.heldItem
    val moves = when {
        idx == 0 -> resolveMoves(s.selectedMoveNames)
        ov?.selectedMoveNames != null -> resolveMoves(ov.selectedMoveNames)
        else -> resolveMoves(learnableMoves(detail, level).filter { it.available }.take(4).map { it.name })
    }
    BattleEngine.buildBattlePokemon(detail, level, moves, statConfig, nature, heldItem)
}
```

- [ ] **Step 9: Update startTrainerBattle same way**

In `startTrainerBattle`, change `val ov = s.teamOverrides[idx]` to `val ov = s.teamOverrides[pokemonId]` in the `playerTeam` construction block (same pattern as step 8).

- [ ] **Step 10: Build and verify no compilation errors**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 11: Commit**

```bash
git add app/src/main/java/com/madmaxlgndklr/pokedex/ui/battle/TurnBattleViewModel.kt
git commit -m "fix: key BattleSetup.teamOverrides by pokemonId instead of slot index"
```

---

### Task 2: Update BattleConfigStore.kt deserialization filter

**Files:**
- Modify: `ui/battle/BattleConfigStore.kt`

Context: In `loadSetup` inside `TurnBattleViewModel.kt`, the saved config's `slots` map is deserialized like:
```kotlin
val slots = savedDto.slots
    .mapKeys { it.key.toIntOrNull() ?: -1 }
    .filter { it.key >= 1 }
```
The `>= 1` filter was designed to skip slot index 0 (the player's main Pokémon, handled separately). With pokemonId keys, all valid IDs are ≥ 1, but the correct filter is `> 0` (to strip the -1 parse-failure sentinel). The behaviour is identical for valid new configs; old slot-indexed configs (keys "0"–"5") will map to pokemonIds 0–5 which won't match any team Pokémon in practice → overrides just don't apply.

- [ ] **Step 1: Update the filter in loadSetup**

In `TurnBattleViewModel.kt`, find (around line 253–256):
```kotlin
val slots = savedDto.slots
    .mapKeys { it.key.toIntOrNull() ?: -1 }
    .filter { it.key >= 1 }
```

Change to:
```kotlin
val slots = savedDto.slots
    .mapKeys { it.key.toIntOrNull() ?: -1 }
    .filter { it.key > 0 }
```

(This file was already modified in Task 1; this is a follow-on change in the same file.)

- [ ] **Step 2: Build and verify**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/madmaxlgndklr/pokedex/ui/battle/TurnBattleViewModel.kt
git commit -m "fix: update battle config deserialization filter for pokemonId keys"
```

---

### Task 3: Add sprite_mode to SettingsDataStore

**Files:**
- Modify: `data/local/SettingsDataStore.kt`

- [ ] **Step 1: Add the sprite mode preference**

Add the following at the end of `SettingsRepository`, before the closing brace:

```kotlin
private val SPRITE_MODE_KEY = stringPreferencesKey("sprite_mode")

val spriteMode: Flow<String> = dataStore.data.map { it[SPRITE_MODE_KEY] ?: "modern" }

suspend fun setSpriteMode(mode: String) {
    dataStore.edit { it[SPRITE_MODE_KEY] = mode }
}
```

- [ ] **Step 2: Build**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/madmaxlgndklr/pokedex/data/local/SettingsDataStore.kt
git commit -m "feat: add sprite_mode preference to SettingsDataStore"
```

---

### Task 4: Add sprite URL overload to RetrofitClient

**Files:**
- Modify: `data/remote/RetrofitClient.kt`

Context: `RetrofitClient.kt` currently has:
```kotlin
fun spriteUrl(id: Int) = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/$id.png"
```
Add a mode-aware overload and a generation lookup helper.

- [ ] **Step 1: Add the new functions to the RetrofitClient companion object**

```kotlin
companion object {
    const val SERVER_ROOT = "https://madmaxlgndklrpokeapi.com"
    private const val BASE_URL = "$SERVER_ROOT/api/v2/"
    
    // existing — keep for callers that don't need mode awareness (shiny, evolutions)
    fun spriteUrl(id: Int): String =
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/$id.png"
    
    fun shinySpriteUrl(id: Int): String =
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/$id.png"
    
    fun spriteUrl(id: Int, name: String, mode: String): String {
        val padded = id.toString().padStart(3, '0')
        val fallback = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/$id.png"
        return when (mode) {
            "retro" -> if (id in 1..251) {
                "$SERVER_ROOT/assets/pokemon_gen1sprites/crystal-jp-$padded.png"
            } else fallback
            "ds" -> if (id in 1..649) {
                "$SERVER_ROOT/assets/pokemon_gen5_anim_sprites/$padded.gif"
            } else fallback
            else -> "$SERVER_ROOT/assets/pokemon_generation_${genFromId(id)}_gifs/$name.gif"
        }
    }
    
    private fun genFromId(id: Int): Int = when (id) {
        in 1..151   -> 1
        in 152..251 -> 2
        in 252..386 -> 3
        in 387..493 -> 4
        in 494..649 -> 5
        in 650..721 -> 6
        in 722..809 -> 7
        else        -> 8
    }
    
    // ... rest of companion object unchanged
}
```

- [ ] **Step 2: Build**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/java/com/madmaxlgndklr/pokedex/data/remote/RetrofitClient.kt
git commit -m "feat: add mode-aware spriteUrl overload to RetrofitClient"
```

---

### Task 5: Create LocalSpriteMode CompositionLocal and PokemonImage composable

**Files:**
- Create: `ui/common/SpriteModeProvider.kt`
- Create: `ui/common/PokemonImage.kt`

- [ ] **Step 1: Create SpriteModeProvider.kt**

```kotlin
// ui/common/SpriteModeProvider.kt
package com.madmaxlgndklr.pokedex.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf

val LocalSpriteMode = compositionLocalOf { "modern" }

@Composable
fun SpriteModeProvider(mode: String, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalSpriteMode provides mode) {
        content()
    }
}
```

- [ ] **Step 2: Create PokemonImage.kt**

```kotlin
// ui/common/PokemonImage.kt
package com.madmaxlgndklr.pokedex.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import androidx.compose.ui.platform.LocalContext
import com.madmaxlgndklr.pokedex.data.remote.RetrofitClient

@Composable
fun PokemonImage(
    id: Int,
    name: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    contentDescription: String = name
) {
    val mode = LocalSpriteMode.current
    val context = LocalContext.current
    var errored by remember(id, mode) { mutableStateOf(false) }
    val url = if (errored) RetrofitClient.spriteUrl(id)
               else RetrofitClient.spriteUrl(id, name, mode)

    AsyncImage(
        model = ImageRequest.Builder(context)
            .data(url)
            .crossfade(true)
            .listener(onError = { _, _ -> errored = true })
            .build(),
        contentDescription = contentDescription,
        contentScale = contentScale,
        modifier = modifier
    )
}
```

Note: `remember(id, mode)` resets `errored` to false whenever the Pokémon ID or sprite mode changes, so switching modes re-attempts the asset server before falling back.

- [ ] **Step 3: Build**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/madmaxlgndklr/pokedex/ui/common/SpriteModeProvider.kt \
        app/src/main/java/com/madmaxlgndklr/pokedex/ui/common/PokemonImage.kt
git commit -m "feat: add LocalSpriteMode CompositionLocal and PokemonImage composable"
```

---

### Task 6: Expose spriteMode in SettingsViewModel and wire SpriteModeProvider in MainActivity

**Files:**
- Modify: `ui/settings/SettingsViewModel.kt`
- Modify: `ui/settings/SettingsScreen.kt`
- Modify: `MainActivity.kt`

- [ ] **Step 1: Add spriteMode to SettingsViewModel**

Read `SettingsViewModel.kt` to find the existing StateFlow declarations. Add after the last existing StateFlow:

```kotlin
val spriteMode: StateFlow<String> = settingsRepo.spriteMode
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "modern")

fun setSpriteMode(mode: String) {
    viewModelScope.launch { settingsRepo.setSpriteMode(mode) }
}
```

- [ ] **Step 2: Add sprite mode selector to SettingsScreen**

Read `SettingsScreen.kt` to find the existing settings rows structure. Add a sprite mode section (find where `selectedGen` or `musicOnLaunch` is collected, follow the same pattern):

```kotlin
val spriteMode by viewModel.spriteMode.collectAsState()
```

Then add a row in the settings list (follow existing row style in the file):

```kotlin
// Sprite mode row
Row(
    modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 10.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
) {
    Text(
        "SPRITE MODE",
        fontFamily = PressStart2P,
        fontSize = 7.sp,
        color = PokedexCream
    )
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf("modern" to "3D GIF", "retro" to "GAME BOY", "ds" to "DS ANIM").forEach { (mode, label) ->
            val selected = spriteMode == mode
            Button(
                onClick = { viewModel.setSpriteMode(mode) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selected) Color(0xFFF0C040) else PokedexDark,
                    contentColor = if (selected) Color.Black else PokedexCream.copy(alpha = 0.6f)
                ),
                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp)
            ) {
                Text(label, fontFamily = PressStart2P, fontSize = 5.sp)
            }
        }
    }
}
```

Add the necessary imports at the top: `ButtonDefaults`, `PaddingValues`, `Row`, `Arrangement`, `Alignment`, `Color`.

- [ ] **Step 3: Wrap app content with SpriteModeProvider in MainActivity**

Read `MainActivity.kt` to find the `setContent { ... }` block. The `SettingsViewModel` must be obtained at the activity level (or from the same factory already in use). Add `spriteMode` collection and wrap the nav content:

```kotlin
// In MainActivity.onCreate, inside setContent { PokedexTheme { ... } }
val settingsViewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.factory(settingsRepository))
val spriteMode by settingsViewModel.spriteMode.collectAsState()

SpriteModeProvider(mode = spriteMode) {
    // existing NavHost / Scaffold content
}
```

If `SettingsViewModel` is already provided elsewhere via a shared `ViewModelStoreOwner`, reuse the same instance. The goal is to read `spriteMode` once at the root so it flows to all `PokemonImage` composables via `LocalSpriteMode`.

- [ ] **Step 4: Build**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/madmaxlgndklr/pokedex/ui/settings/SettingsViewModel.kt \
        app/src/main/java/com/madmaxlgndklr/pokedex/ui/settings/SettingsScreen.kt \
        app/src/main/java/com/madmaxlgndklr/pokedex/MainActivity.kt
git commit -m "feat: wire spriteMode into SettingsViewModel and SpriteModeProvider root"
```

---

### Task 7: Replace direct sprite AsyncImage calls with PokemonImage

**Files:** Multiple — see list below. This is a mechanical find-and-replace task.

Pattern to replace in each file:
- Old: `AsyncImage(model = RetrofitClient.spriteUrl(someId), contentDescription = ..., contentScale = ..., modifier = ...)`
- New: `PokemonImage(id = someId, name = someName, contentScale = ..., modifier = ...)`

Where `someName` is the nearby `name` variable (Pokémon lowercase name string). If only `id` is available and no `name` is in scope, use `""` as the name (modern mode will produce a wrong URL and fall back to CDN, which is acceptable — trainer/record screens with no name will get the CDN sprite in modern mode).

- [ ] **Step 1: Update PokemonSpriteGrid.kt**

In `SpriteGridItem`, replace:
```kotlin
AsyncImage(
    model = RetrofitClient.spriteUrl(id),
    contentDescription = name,
    contentScale = ContentScale.Fit,
    modifier = Modifier.size(72.dp)
)
```
with:
```kotlin
PokemonImage(
    id = id,
    name = name,
    contentDescription = name,
    contentScale = ContentScale.Fit,
    modifier = Modifier.size(72.dp)
)
```

Add import: `import com.madmaxlgndklr.pokedex.ui.common.PokemonImage`

- [ ] **Step 2: Update TurnBattleScreen.kt (4 sites)**

Find all 4 occurrences of `AsyncImage(model = RetrofitClient.spriteUrl(...)`. Each has a nearby `detail.id` and `detail.name` (from `poke.detail.id` / `poke.detail.name` / `activeDetail.id` etc.). Replace each with `PokemonImage(id = ..., name = ..., modifier = ...)`. The exact context:

Site 1 (around line 179): `poke.detail.id` → `PokemonImage(id = poke.detail.id, name = poke.detail.name, ...)`
Site 2 (around line 275): `activeDetail.id` → `PokemonImage(id = activeDetail.id, name = activeDetail.name, ...)`
Site 3 (around line 934): same `poke.detail.id` pattern
Site 4 (around line 970): `pokemon.detail.id` → `PokemonImage(id = pokemon.detail.id, name = pokemon.detail.name, ...)`

Read the file before making changes to confirm exact variable names.

- [ ] **Step 3: Update DetailScreen.kt (2 sites)**

Site 1 (around line 259): The shiny sprite toggle case. For the non-shiny case, the current code uses `detail.spriteUrl` (the GitHub CDN URL from Room cache). Replace with `PokemonImage` using `detail.id` and `detail.name`. The shiny case still uses `RetrofitClient.shinySpriteUrl(detail.id)` directly — leave that as-is (shiny sprites are CDN only).

```kotlin
// Replace only the non-shiny model with PokemonImage:
if (showShiny) {
    AsyncImage(model = RetrofitClient.shinySpriteUrl(detail.id), ...)
} else {
    PokemonImage(id = detail.id, name = detail.name, modifier = ..., contentScale = ...)
}
```

Site 2 (around line 581): evolution chain node sprite `RetrofitClient.spriteUrl(node.id)`. Replace with `PokemonImage(id = node.id, name = node.name, ...)`. Confirm `node.name` is available in scope.

- [ ] **Step 4: Update TeamScreen.kt**

Find `AsyncImage(model = RetrofitClient.spriteUrl(entry.id), ...)`. Replace with `PokemonImage(id = entry.id, name = entry.name, ...)`. Confirm `entry.name` is available.

- [ ] **Step 5: Update remaining screens (MatchupScreen, RecordScreen x2, DamageCalcScreen, FullListScreen, MyCollectionScreen, TrainerSelectScreen x2)**

For each file, find the `AsyncImage(model = RetrofitClient.spriteUrl(...))` call, identify the nearby `id` and `name` variables, and replace with `PokemonImage(id = ..., name = ..., ...)`. For screens where `name` isn't immediately in scope (e.g., `RecordScreen` uses `record.pokemonId` but may not have name), use `""` for name — the fallback URL will still load the GitHub CDN sprite.

Files to update:
- `ui/battle/MatchupScreen.kt`: `pokemon.id` → check for `pokemon.name`
- `ui/battle/RecordScreen.kt` line ~305: `record.pokemonId`, name may not be available → use `""`
- `ui/battle/RecordScreen.kt` line ~449: `tp.pokemonId`, name may be `tp.name` — check
- `ui/battle/DamageCalcScreen.kt`: `detail.id` + `detail.name`
- `ui/list/FullListScreen.kt`: `pokemon.id` + `pokemon.name`
- `ui/mycollection/MyCollectionScreen.kt`: `pokemon.id` + `pokemon.name` (or similar)
- `ui/battle/TrainerSelectScreen.kt` line ~166: `tp.pokemonId`, name may be `tp.name`
- `ui/battle/TrainerSelectScreen.kt` line ~242: same pattern

Read each file before editing to confirm variable names and modifier/size parameters.

- [ ] **Step 6: Build**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL. Fix any missing imports or wrong variable names flagged by the compiler.

- [ ] **Step 7: Commit**

```bash
git add \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/common/PokemonSpriteGrid.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/battle/TurnBattleScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/detail/DetailScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/team/TeamScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/battle/MatchupScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/battle/RecordScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/battle/DamageCalcScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/list/FullListScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/mycollection/MyCollectionScreen.kt \
  app/src/main/java/com/madmaxlgndklr/pokedex/ui/battle/TrainerSelectScreen.kt
git commit -m "feat: replace sprite AsyncImage calls with PokemonImage composable"
```
