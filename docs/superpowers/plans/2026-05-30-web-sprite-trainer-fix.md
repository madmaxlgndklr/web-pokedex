# Web App: Sprite Toggle + Trainer Battle Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the trainer battle routing bug (selecting a trainer currently switches to the WILD tab and starts a random wild battle instead of a trainer battle) and add a three-mode sprite toggle (Modern 3D GIFs / Retro Game Boy / DS Animated) that persists in Dexie settings.

**Architecture:**
- **Trainer fix:** Add `activeTrainer: Trainer | null` state to `app/battle/page.tsx`. When trainer is selected, stay on TRAIN tab and render `TurnBattleScreen` with the trainer passed as a prop. `TurnBattleScreen` detects the trainer prop and auto-starts a trainer battle instead of showing the wild battle setup UI.
- **Sprite toggle:** A new `lib/spriteMode.ts` exports `getSpriteUrl(id, name, mode)` with mode-aware URL construction and GitHub CDN fallback. `SpriteImage.tsx` reads mode from `useSetting('sprite_mode', 'modern')` internally, so no callers change. A mode selector is added to the settings page.

**Tech Stack:** Next.js 14 App Router, TypeScript, Dexie (via existing `useSetting` hook), self-hosted PokeAPI asset server at `https://madmaxlgndklrpokeapi.com`

---

## File Map

| File | Change |
|---|---|
| Create: `lib/spriteMode.ts` | `getSpriteUrl(id, name, mode)` + `ASSET_BASE` constant + generation lookup |
| Modify: `components/pokemon/SpriteImage.tsx` | Read `sprite_mode` from `useSetting`; add `onError` fallback to GitHub CDN |
| Modify: `app/settings/page.tsx` | Add sprite mode selector row using existing `row()` pattern |
| Modify: `app/battle/page.tsx` | Add `activeTrainer` state; fix TRAIN tab to show `TurnBattleScreen` with trainer |
| Modify: `components/battle/TurnBattleScreen.tsx` | Add `trainer?: Trainer` + `onBack?: () => void` props; auto-start trainer battle when trainer provided |

---

### Task 1: Create lib/spriteMode.ts

**Files:**
- Create: `lib/spriteMode.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/spriteMode.ts
export type SpriteMode = 'modern' | 'retro' | 'ds'

const ASSET_BASE = 'https://madmaxlgndklrpokeapi.com/assets'

function genFromId(id: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  if (id <= 151)  return 1
  if (id <= 251)  return 2
  if (id <= 386)  return 3
  if (id <= 493)  return 4
  if (id <= 649)  return 5
  if (id <= 721)  return 6
  if (id <= 809)  return 7
  return 8
}

function pad3(id: number): string {
  return id.toString().padStart(3, '0')
}

export function getFallbackUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

export function getSpriteUrl(id: number, name: string, mode: SpriteMode): string {
  if (mode === 'retro') {
    if (id < 1 || id > 251) return getFallbackUrl(id)
    return `${ASSET_BASE}/pokemon_gen1sprites/crystal-jp-${pad3(id)}.png`
  }
  if (mode === 'ds') {
    if (id < 1 || id > 649) return getFallbackUrl(id)
    return `${ASSET_BASE}/pokemon_gen5_anim_sprites/${pad3(id)}.gif`
  }
  // modern
  const gen = genFromId(id)
  return `${ASSET_BASE}/pokemon_generation_${gen}_gifs/${name}.gif`
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/spriteMode.ts
git commit -m "feat: add sprite mode URL utility (modern/retro/ds)"
```

---

### Task 2: Update SpriteImage.tsx to use mode and add onError fallback

**Files:**
- Modify: `components/pokemon/SpriteImage.tsx`

Context: `SpriteImage` currently imports `spriteUrl`/`shinySpriteUrl` from `@/lib/constants` and renders a Next.js `<Image>`. We need it to read `sprite_mode` from the Dexie settings hook and fall back to the GitHub CDN on image load error.

- [ ] **Step 1: Rewrite the file**

```typescript
// components/pokemon/SpriteImage.tsx
'use client'
import Image from 'next/image'
import { useState } from 'react'
import { shinySpriteUrl } from '@/lib/constants'
import { getSpriteUrl, getFallbackUrl, type SpriteMode } from '@/lib/spriteMode'
import { useSetting } from '@/lib/db'

interface Props { id: number; name: string; size?: number; showShinyToggle?: boolean }

export function SpriteImage({ id, name, size = 96, showShinyToggle = false }: Props) {
  const [shiny, setShiny] = useState(false)
  const [errored, setErrored] = useState(false)
  const [spriteModeRaw] = useSetting('sprite_mode', 'modern')
  const mode = (spriteModeRaw ?? 'modern') as SpriteMode

  const src = shiny
    ? shinySpriteUrl(id)
    : errored
      ? getFallbackUrl(id)
      : getSpriteUrl(id, name, mode)

  return (
    <div className="relative flex flex-col items-center gap-1">
      <Image
        key={src}
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="pixelated"
        style={{ imageRendering: 'pixelated' }}
        onError={() => setErrored(true)}
      />
      {showShinyToggle && (
        <button
          onClick={() => setShiny(s => !s)}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: '5px',
            color: shiny ? 'var(--gold)' : 'var(--text-muted)',
          }}
        >
          {shiny ? '★ SHINY' : '☆ SHINY'}
        </button>
      )}
    </div>
  )
}
```

Note: `key={src}` forces a new Image mount when `src` changes (e.g. mode or shiny toggle), which resets the `errored` state.

- [ ] **Step 2: Check useSetting signature**

`useSetting` returns `[value: string | undefined, setValue: (v: string) => void]`. The `spriteModeRaw` may be `undefined` before the Dexie query resolves, so we coalesce with `?? 'modern'`.

Verify by running: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/pokemon/SpriteImage.tsx
git commit -m "feat: wire sprite mode and onError fallback into SpriteImage"
```

---

### Task 3: Add sprite mode selector to settings page

**Files:**
- Modify: `app/settings/page.tsx`

Context: `app/settings/page.tsx` uses a `row(label, control)` helper that renders a labeled row with a bottom border. Existing rows use `useSetting('generation', '3')` and `useSetting('musicOnLaunch', 'false')`. The sprite mode selector follows the same pattern.

- [ ] **Step 1: Read the current settings file**

Read `app/settings/page.tsx` to confirm the exact `row()` helper signature and the position to insert the new row. (Insert after the generation row and before the musicOnLaunch row, or at the end — pick wherever it flows best visually.)

- [ ] **Step 2: Add sprite mode state and selector**

Inside `SettingsPageInner` (the `'use client'` component), add:

```typescript
const [spriteMode, setSpriteMode] = useSetting('sprite_mode', 'modern')
```

Then add this row in the JSX (use the same `row()` helper pattern as existing rows):

```typescript
row(
  'SPRITE MODE',
  <div style={{ display: 'flex', gap: '6px' }}>
    {(['modern', 'retro', 'ds'] as const).map(m => (
      <button
        key={m}
        onClick={() => setSpriteMode(m)}
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: '6px',
          letterSpacing: '1px',
          padding: '4px 8px',
          border: '1px solid var(--border)',
          background: spriteMode === m ? 'var(--gold)' : 'var(--surface)',
          color: spriteMode === m ? '#000' : 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        {m === 'modern' ? '3D GIF' : m === 'retro' ? 'GAME BOY' : 'DS ANIM'}
      </button>
    ))}
  </div>
)
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Test manually**

Start dev server: `npm run dev`
Navigate to `/settings`. Confirm the SPRITE MODE row appears with three buttons. Click each — the active button should highlight in gold. Navigate to `/list`, find a Pokémon — sprite should change with mode. Retro shows the crystal-jp PNG (or GitHub CDN fallback for IDs > 251). DS shows the gen5 GIF (or fallback for IDs > 649). Modern shows the gen GIF (or fallback if GIF 404s).

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: add sprite mode selector to settings (modern/retro/ds)"
```

---

### Task 4: Fix trainer battle routing in app/battle/page.tsx

**Files:**
- Modify: `app/battle/page.tsx`

Context: The bug is on line 59:
```tsx
{tab === 'TRAIN' && <TrainerSelectScreen teamIds={teamIds} onStartBattle={() => { setTab('WILD') }} />}
```
`onStartBattle` receives a `Trainer` argument (see `TrainerSelectScreen` Props: `onStartBattle: (trainer: Trainer) => void`) but the callback ignores it and switches to the WILD tab. The WILD tab renders `TurnBattleScreen` without any trainer context, so a random wild battle happens.

Fix: Add `activeTrainer: Trainer | null` state. When trainer is selected, stay on TRAIN tab and conditionally render `TurnBattleScreen` with the trainer.

- [ ] **Step 1: Add Trainer import and activeTrainer state**

Change the top of `BattlePageInner`:

```typescript
// app/battle/page.tsx
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTeam } from '@/lib/db'
import { DamageCalcScreen } from '@/components/battle/DamageCalcScreen'
import { TurnBattleScreen } from '@/components/battle/TurnBattleScreen'
import { MatchupScreen } from '@/components/battle/MatchupScreen'
import { RecordScreen } from '@/components/battle/RecordScreen'
import { TrainerSelectScreen } from '@/components/battle/TrainerSelectScreen'
import { TabErrorBoundary } from '@/components/ui/TabErrorBoundary'
import { type Trainer } from '@/lib/battle/TrainerRoster'

type Tab = 'CALC' | 'WILD' | 'TRAIN' | 'MATCH' | 'LOG'
const TABS: Tab[] = ['CALC', 'WILD', 'TRAIN', 'MATCH', 'LOG']

function BattlePageInner() {
  const [tab, setTab] = useState<Tab>('CALC')
  const [activeTrainer, setActiveTrainer] = useState<Trainer | null>(null)
  const { teamIds } = useTeam()
  const params = useSearchParams()
  const preloadId = params.get('preloadId') ? parseInt(params.get('preloadId')!) : undefined

  useEffect(() => { if (preloadId) setTab('CALC') }, [preloadId])
```

- [ ] **Step 2: Fix the TRAIN tab render and onStartBattle callback**

Change the tab content section. Replace the TRAIN tab line:

Old:
```tsx
{tab === 'TRAIN' && <TrainerSelectScreen teamIds={teamIds} onStartBattle={() => { setTab('WILD') }} />}
```

New:
```tsx
{tab === 'TRAIN' && (
  activeTrainer
    ? <TurnBattleScreen teamIds={teamIds} trainer={activeTrainer} onBack={() => setActiveTrainer(null)} />
    : <TrainerSelectScreen teamIds={teamIds} onStartBattle={(t) => setActiveTrainer(t)} />
)}
```

- [ ] **Step 3: Verify TypeScript (will fail until Task 5 adds trainer prop to TurnBattleScreen)**

Run: `npx tsc --noEmit`
Expected: error on `trainer` and `onBack` props since `TurnBattleScreen` doesn't accept them yet. This is expected — Task 5 resolves this.

- [ ] **Step 4: Commit (with TS errors noted — resolve after Task 5)**

```bash
git add app/battle/page.tsx
git commit -m "fix: add activeTrainer state to battle page for trainer routing"
```

---

### Task 5: Update TurnBattleScreen to accept trainer prop and run trainer battles

**Files:**
- Modify: `components/battle/TurnBattleScreen.tsx`

Context: `TurnBattleScreen` currently only handles wild battles. The `trainer?: Trainer` prop signals a trainer battle. When present, skip the setup UI and immediately start the battle using the trainer's first roster's first Pokémon as the enemy. `useTrainerRecords().recordBattle` is already imported (as a no-op call); wire it up for win/loss recording.

`useTrainerRecords().recordBattle` signature:
```typescript
recordBattle(
  trainerData: Omit<TrainerRecord, 'wins' | 'losses' | 'firstDefeatedAt' | 'lastBattledAt'>,
  won: boolean
): Promise<void>
```

Where `TrainerRecord` has: `trainerId, name, title, region, trainerClass, typeSpecialty` (matching the `Trainer` type's `id, name, title, region, trainerClass, typeSpecialty` fields).

- [ ] **Step 1: Rewrite TurnBattleScreen.tsx**

```typescript
// components/battle/TurnBattleScreen.tsx
'use client'
import { useState, useCallback, useEffect } from 'react'
import { fetchPokemonDetail } from '@/lib/api'
import { SpriteImage } from '@/components/pokemon/SpriteImage'
import { useWildRecords, useTrainerRecords } from '@/lib/db'
import { resolvePlayerAttack, resolveEnemyAttack, buildBattlePokemon, type BattlePokemon, type BattleState } from '@/lib/battle/BattleEngine'
import { resolveStats } from '@/lib/battle/StatConfig'
import { Button } from '@/components/ui/Button'
import { type Trainer } from '@/lib/battle/TrainerRoster'

interface Props {
  teamIds: number[]
  trainer?: Trainer
  onBack?: () => void
}

const DEFAULT_STAT_CONFIG = { kind: 'gen3plus' as const, ivs: [31,31,31,31,31,31], evs: [0,0,0,0,0,0] }
const DEFAULT_NATURE = { name: 'Hardy', boosted: null, dropped: null }

export function TurnBattleScreen({ teamIds, trainer, onBack }: Props) {
  const [state, setState] = useState<BattleState>({ phase: 'setup' })
  const [player, setPlayer] = useState<BattlePokemon | null>(null)
  const [enemy, setEnemy] = useState<BattlePokemon | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [enemyIdInput, setEnemyIdInput] = useState('')
  const [typeChart, setTypeChart] = useState<Record<string, { double_damage_to: {name:string}[]; half_damage_to: {name:string}[]; no_damage_to: {name:string}[] }>>({})
  const { recordBattle: recordWild } = useWildRecords()
  const { recordBattle: recordTrainer } = useTrainerRecords()

  const buildPkmn = (detail: Awaited<ReturnType<typeof fetchPokemonDetail>>, level = 50) =>
    buildBattlePokemon(
      detail, level,
      detail.moves.slice(0, 4).map(m => ({ name: m.move.name, type: 'normal', category: 'physical' as const, power: 60, accuracy: 100, pp: 15, currentPp: 15 })),
      resolveStats(detail.stats.map(s => s.base_stat), DEFAULT_STAT_CONFIG, level, DEFAULT_NATURE)
    )

  // Auto-start when trainer prop is provided
  useEffect(() => {
    if (!trainer || teamIds.length === 0) return
    const trainerPkmn = trainer.rosters[0]?.[0]
    if (!trainerPkmn) return
    ;(async () => {
      const { fetchTypeChart } = await import('@/lib/api')
      const [enemyDetail, playerDetail, chart] = await Promise.all([
        fetchPokemonDetail(trainerPkmn.id),
        fetchPokemonDetail(teamIds[0]),
        fetchTypeChart(),
      ])
      setTypeChart(chart)
      setPlayer(buildPkmn(playerDetail))
      setEnemy(buildPkmn(enemyDetail, trainerPkmn.level))
      setLog([`${trainer.name.toUpperCase()} sent out ${trainerPkmn.name.toUpperCase()}!`])
      setState({ phase: 'player_turn' })
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer, teamIds])

  const startWildBattle = useCallback(async () => {
    const enemyId = parseInt(enemyIdInput)
    if (isNaN(enemyId) || teamIds.length === 0) return
    const [enemyDetail, playerDetail, { fetchTypeChart }] = await Promise.all([
      fetchPokemonDetail(enemyId),
      fetchPokemonDetail(teamIds[0]),
      import('@/lib/api'),
    ])
    const chart = await fetchTypeChart()
    setTypeChart(chart)
    setPlayer(buildPkmn(playerDetail))
    setEnemy(buildPkmn(enemyDetail))
    setLog([`A wild ${enemyDetail.name.toUpperCase()} appeared!`])
    setState({ phase: 'player_turn' })
  }, [enemyIdInput, teamIds])

  const playerAttack = useCallback((moveIdx: number) => {
    if (!player || !enemy || state.phase !== 'player_turn') return
    const { updatedEnemy, log: attackLog } = resolvePlayerAttack(player, enemy, moveIdx, typeChart)
    const newLog = [...log, attackLog]
    if (updatedEnemy.currentHp === 0) {
      setEnemy(updatedEnemy)
      setLog([...newLog, trainer ? `You defeated ${trainer.name.toUpperCase()}!` : 'You won!'])
      setState({ phase: 'won' })
      if (trainer) {
        recordTrainer({ trainerId: trainer.id, name: trainer.name, title: trainer.title, region: trainer.region, trainerClass: trainer.trainerClass, typeSpecialty: trainer.typeSpecialty }, true)
      } else {
        recordWild(enemy.id, enemy.name, true)
      }
      return
    }
    const { updatedPlayer, log: enemyLog } = resolveEnemyAttack(updatedEnemy, player, typeChart)
    setEnemy(updatedEnemy)
    setPlayer(updatedPlayer)
    setLog([...newLog, enemyLog])
    if (updatedPlayer.currentHp === 0) {
      setState({ phase: 'lost' })
      if (trainer) {
        recordTrainer({ trainerId: trainer.id, name: trainer.name, title: trainer.title, region: trainer.region, trainerClass: trainer.trainerClass, typeSpecialty: trainer.typeSpecialty }, false)
      } else {
        recordWild(enemy.id, enemy.name, false)
      }
    }
  }, [player, enemy, state, typeChart, log, recordWild, recordTrainer, trainer])

  const hpBar = (current: number, max: number, color = '#78c850') => (
    <div style={{ background: 'var(--border)', borderRadius: '3px', height: '8px', width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, (current / max) * 100)}%`, background: color, height: '100%', transition: 'width 0.3s' }} />
    </div>
  )

  if (state.phase === 'setup' && !trainer) return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--gold)', marginBottom: '10px' }}>WILD BATTLE</div>
      <div className="flex gap-2 mb-4">
        <input value={enemyIdInput} onChange={e => setEnemyIdInput(e.target.value)} placeholder="ENEMY POKÉMON #ID"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '7px', padding: '6px 10px', borderRadius: '3px' }} />
        <Button onClick={startWildBattle}>START</Button>
      </div>
      {teamIds.length === 0 && (
        <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>Add Pokémon to your team first!</p>
      )}
    </div>
  )

  if (state.phase === 'setup' && trainer) return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)' }}>Loading trainer battle...</div>
    </div>
  )

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {enemy && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px' }}>
          <div className="flex items-center gap-3">
            <SpriteImage id={enemy.id} name={enemy.name} size={56} />
            <div className="flex-1">
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text)' }}>{enemy.name.toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>HP {enemy.currentHp}/{enemy.maxHp}</div>
              {hpBar(enemy.currentHp, enemy.maxHp)}
            </div>
          </div>
        </div>
      )}
      {player && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px' }}>
          <div className="flex items-center gap-3">
            <SpriteImage id={player.id} name={player.name} size={56} />
            <div className="flex-1">
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: 'var(--text)' }}>{player.name.toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>HP {player.currentHp}/{player.maxHp}</div>
              {hpBar(player.currentHp, player.maxHp, '#6890f0')}
            </div>
          </div>
        </div>
      )}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', padding: '8px', flex: 1, overflowY: 'auto', maxHeight: '120px' }}>
        {log.map((l, i) => (
          <div key={i} style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text)', lineHeight: '1.8' }}>{l}</div>
        ))}
      </div>
      {state.phase === 'player_turn' && player && (
        <div className="grid grid-cols-2 gap-2">
          {player.moves.slice(0, 4).map((m, i) => (
            <Button key={i} onClick={() => playerAttack(i)} variant="secondary" style={{ fontSize: '6px', padding: '6px' }}>
              {m.name.toUpperCase()}
            </Button>
          ))}
        </div>
      )}
      {(state.phase === 'won' || state.phase === 'lost') && (
        <Button onClick={() => {
          setState({ phase: 'setup' })
          setPlayer(null)
          setEnemy(null)
          setLog([])
          if (onBack) onBack()
        }}>
          {state.phase === 'won' ? 'VICTORY!' : 'DEFEAT'} — {trainer ? 'BACK' : 'RESET'}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Test trainer battle flow manually**

Start dev server: `npm run dev`
1. Add at least one Pokémon to your team (`/collection` → catch a Pokémon, `/team` → add it).
2. Navigate to `/battle` → TRAIN tab.
3. Select any trainer and click BATTLE!.
4. Expected: stays on TRAIN tab, shows a battle screen with the trainer's Pokémon as enemy.
5. Play through the battle. Win or lose.
6. Click VICTORY!/DEFEAT — BACK.
7. Expected: returns to trainer select list (not WILD tab).

- [ ] **Step 4: Test wild battle is unaffected**

Navigate to WILD tab. Enter a Pokémon ID, click START.
Expected: wild battle works as before.

- [ ] **Step 5: Commit**

```bash
git add components/battle/TurnBattleScreen.tsx
git commit -m "fix: add trainer prop to TurnBattleScreen; fix trainer battle routing"
```
