# Web: Trainer Name + Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread `trainer_name` through the existing sync layer and add a `/profile` page where users set their trainer name and see auth state.

**Architecture:** Four targeted file edits (sync-merge, sync, db, Sidebar) + one new page. The web app's auth, sync, AuthProvider, and login are already fully implemented — this plan only adds the trainer name field and the profile UI surface.

**Tech Stack:** Next.js 14 App Router, Supabase (existing `lib/supabase.ts`), Dexie (existing `lib/db.ts`), Vitest

**Prerequisite:** Run `ALTER TABLE settings ADD COLUMN IF NOT EXISTS trainer_name text NOT NULL DEFAULT '';` in the Supabase SQL editor before deploying.

---

### File Map

| File | Change |
|---|---|
| `lib/sync-merge.ts` | Add `trainerName` to `RemoteSettingsRow`, `LocalSettings`, `mergeSettings` |
| `lib/sync.ts` | Update `pullAll` select, `getLocalSettings`, `writeLocal`, `pushSettings` |
| `lib/db.ts` | Update `useSetting` to push `trainerName` to Supabase |
| `components/nav/Sidebar.tsx` | Add `PROFILE` entry to `NAV` array |
| `app/profile/page.tsx` | New — trainer name input + auth state display |
| `src/test/sync.test.ts` | Add `trainerName` coverage to `mergeSettings` tests |

---

### Task 1: Add `trainerName` to sync-merge types and merge function

**Files:**
- Modify: `lib/sync-merge.ts`
- Test: `src/test/sync.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `src/test/sync.test.ts` and add inside the `mergeSettings` describe block (or add a new describe if none exists):

```typescript
describe('mergeSettings trainerName', () => {
  it('remote wins when newer', () => {
    const local = { generation: 5, musicOnLaunch: false, trainerName: 'ASH', updatedAt: 100 }
    const remote = { generation: 3, musicOnLaunch: true, trainerName: 'MISTY', updatedAt: 200 }
    const result = mergeSettings(local, remote)
    expect(result.trainerName).toBe('MISTY')
  })

  it('local wins when newer', () => {
    const local = { generation: 5, musicOnLaunch: false, trainerName: 'ASH', updatedAt: 300 }
    const remote = { generation: 3, musicOnLaunch: true, trainerName: 'MISTY', updatedAt: 200 }
    const result = mergeSettings(local, remote)
    expect(result.trainerName).toBe('ASH')
  })

  it('local returned when remote is null', () => {
    const local = { generation: 5, musicOnLaunch: false, trainerName: 'ASH', updatedAt: 100 }
    const result = mergeSettings(local, null)
    expect(result.trainerName).toBe('ASH')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npx vitest run src/test/sync.test.ts
```

Expected: FAIL — `trainerName` property does not exist on type.

- [ ] **Step 3: Update `RemoteSettingsRow` in `lib/sync-merge.ts`**

Current line 20:
```typescript
export interface RemoteSettingsRow { generation: number; music_on_launch: boolean; updated_at: number }
```

Replace with:
```typescript
export interface RemoteSettingsRow { generation: number; music_on_launch: boolean; trainer_name: string; updated_at: number }
```

- [ ] **Step 4: Update `LocalSettings` in `lib/sync-merge.ts`**

Current lines 31–35:
```typescript
export interface LocalSettings {
  generation: number
  musicOnLaunch: boolean
  updatedAt: number
}
```

Replace with:
```typescript
export interface LocalSettings {
  generation: number
  musicOnLaunch: boolean
  trainerName: string
  updatedAt: number
}
```

- [ ] **Step 5: Update `mergeSettings` in `lib/sync-merge.ts`**

Current function (lines 123–130):
```typescript
export function mergeSettings(
  local: LocalSettings,
  remote: { generation: number; musicOnLaunch: boolean; updatedAt: number } | null
): LocalSettings {
  if (remote === null) return local
  return remote.updatedAt > local.updatedAt
    ? { generation: remote.generation, musicOnLaunch: remote.musicOnLaunch, updatedAt: remote.updatedAt }
    : local
}
```

Replace with:
```typescript
export function mergeSettings(
  local: LocalSettings,
  remote: { generation: number; musicOnLaunch: boolean; trainerName: string; updatedAt: number } | null
): LocalSettings {
  if (remote === null) return local
  return remote.updatedAt > local.updatedAt
    ? { generation: remote.generation, musicOnLaunch: remote.musicOnLaunch, trainerName: remote.trainerName, updatedAt: remote.updatedAt }
    : local
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npx vitest run src/test/sync.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git -C /home/madmaxlgndklr/Git/web-pokedex add lib/sync-merge.ts src/test/sync.test.ts
git -C /home/madmaxlgndklr/Git/web-pokedex commit -m "feat: add trainerName to sync-merge types and mergeSettings"
```

---

### Task 2: Wire `trainerName` through sync I/O

**Files:**
- Modify: `lib/sync.ts`

The sync.ts file has four places that touch settings: `pullAll`, `getLocalSettings`, `writeLocal`, and `pushSettings`. Update all four.

- [ ] **Step 1: Update `pullAll` — add `trainer_name` to select**

Find line 57 in `lib/sync.ts`:
```typescript
    supabase.from('settings').select('generation, music_on_launch, updated_at').eq('user_id', userId).maybeSingle(),
```

Replace with:
```typescript
    supabase.from('settings').select('generation, music_on_launch, trainer_name, updated_at').eq('user_id', userId).maybeSingle(),
```

- [ ] **Step 2: Update `getLocalSettings` — read `trainerName` from Dexie**

Find the `getLocalSettings` function (lines 73–84). Replace entirely:
```typescript
async function getLocalSettings(): Promise<LocalSettings> {
  const [gen, music, trainerName, ts] = await Promise.all([
    db.settings.get('generation'),
    db.settings.get('musicOnLaunch'),
    db.settings.get('trainerName'),
    db.settings.get('settings_updated_at'),
  ])
  return {
    generation: gen ? parseInt(gen.value) : 3,
    musicOnLaunch: music?.value === 'true',
    trainerName: trainerName?.value ?? '',
    updatedAt: ts ? parseInt(ts.value) : 0,
  }
}
```

- [ ] **Step 3: Update `writeLocal` — persist merged trainerName**

Find the `db.settings.bulkPut` call inside the transaction in `writeLocal` (lines 138–142):
```typescript
    await db.settings.bulkPut([
      { key: 'generation', value: String(mergedSettings.generation) },
      { key: 'musicOnLaunch', value: String(mergedSettings.musicOnLaunch) },
      { key: 'settings_updated_at', value: String(mergedSettings.updatedAt || now) },
    ])
```

Replace with:
```typescript
    await db.settings.bulkPut([
      { key: 'generation', value: String(mergedSettings.generation) },
      { key: 'musicOnLaunch', value: String(mergedSettings.musicOnLaunch) },
      { key: 'trainerName', value: mergedSettings.trainerName },
      { key: 'settings_updated_at', value: String(mergedSettings.updatedAt || now) },
    ])
```

Also update the `remoteSettings` construction a few lines above (around line 116):
```typescript
  const remoteSettings = remote.settings
    ? { generation: remote.settings.generation, musicOnLaunch: remote.settings.music_on_launch, updatedAt: remote.settings.updated_at }
    : null
```

Replace with:
```typescript
  const remoteSettings = remote.settings
    ? { generation: remote.settings.generation, musicOnLaunch: remote.settings.music_on_launch, trainerName: remote.settings.trainer_name, updatedAt: remote.settings.updated_at }
    : null
```

- [ ] **Step 4: Update `pushSettings` — add `trainerName` parameter and upsert field**

Find `pushSettings` (lines 264–271):
```typescript
export async function pushSettings(userId: string, generation: number, musicOnLaunch: boolean, updatedAt: number): Promise<void> {
  await supabase.from('settings').upsert({
    user_id: userId,
    generation,
    music_on_launch: musicOnLaunch,
    updated_at: updatedAt,
  })
}
```

Replace with:
```typescript
export async function pushSettings(userId: string, generation: number, musicOnLaunch: boolean, trainerName: string, updatedAt: number): Promise<void> {
  await supabase.from('settings').upsert({
    user_id: userId,
    generation,
    music_on_launch: musicOnLaunch,
    trainer_name: trainerName,
    updated_at: updatedAt,
  })
}
```

- [ ] **Step 5: Run TypeScript check to confirm no type errors**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npx tsc --noEmit 2>&1 | head -30
```

Expected: Errors for `pushSettings` callers in `db.ts` (not updated yet) — that's fine; we fix db.ts in Task 3.

- [ ] **Step 6: Commit**

```bash
git -C /home/madmaxlgndklr/Git/web-pokedex add lib/sync.ts
git -C /home/madmaxlgndklr/Git/web-pokedex commit -m "feat: thread trainer_name through sync I/O (pullAll, writeLocal, pushSettings)"
```

---

### Task 3: Wire `trainerName` writes in `lib/db.ts`

**Files:**
- Modify: `lib/db.ts`

The `useSetting` hook currently only syncs `generation` and `musicOnLaunch`. Update it to also sync `trainerName`.

- [ ] **Step 1: Replace the `useSetting` set function**

Find the `set` function inside `useSetting` (lines 198–213):
```typescript
  const set = async (v: string) => {
    const now = Date.now()
    await db.settings.put({ key, value: v })
    // Only generation and musicOnLaunch are synced to Supabase
    if (key === 'generation' || key === 'musicOnLaunch') {
      await db.settings.put({ key: 'settings_updated_at', value: String(now) })
      const otherKey = key === 'generation' ? 'musicOnLaunch' : 'generation'
      const otherRow = await db.settings.get(otherKey)
      const generation = key === 'generation' ? parseInt(v, 10) : parseInt(otherRow?.value ?? '3', 10)
      const musicOnLaunch = key === 'musicOnLaunch' ? v === 'true' : otherRow?.value === 'true'
      const userId = await getUserId()
      if (userId) pushSettings(userId, generation, musicOnLaunch, now).catch(() => {})
    }
  }
```

Replace with:
```typescript
  const set = async (v: string) => {
    const now = Date.now()
    await db.settings.put({ key, value: v })
    if (key === 'generation' || key === 'musicOnLaunch' || key === 'trainerName') {
      await db.settings.put({ key: 'settings_updated_at', value: String(now) })
      const [genRow, musicRow, nameRow] = await Promise.all([
        db.settings.get('generation'),
        db.settings.get('musicOnLaunch'),
        db.settings.get('trainerName'),
      ])
      const generation = key === 'generation' ? parseInt(v, 10) : parseInt(genRow?.value ?? '3', 10)
      const musicOnLaunch = key === 'musicOnLaunch' ? v === 'true' : musicRow?.value === 'true'
      const trainerName = key === 'trainerName' ? v : (nameRow?.value ?? '')
      const userId = await getUserId()
      if (userId) pushSettings(userId, generation, musicOnLaunch, trainerName, now).catch(() => {})
    }
  }
```

- [ ] **Step 2: Run TypeScript check — should now be clean**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git -C /home/madmaxlgndklr/Git/web-pokedex add lib/db.ts
git -C /home/madmaxlgndklr/Git/web-pokedex commit -m "feat: sync trainerName on every settings write"
```

---

### Task 4: Create `app/profile/page.tsx`

**Files:**
- Create: `app/profile/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'
import { useAuth } from '@/components/auth/AuthProvider'
import { useSetting } from '@/lib/db'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [trainerName, setTrainerName] = useSetting('trainerName', '')
  const [draft, setDraft] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  if (loading) return null

  const isAnonymous = !user || user.is_anonymous
  const displayed = draft ?? trainerName

  const handleSave = async () => {
    if (draft !== null) {
      await setTrainerName(draft)
      setDraft(null)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try { await signOut() } finally { setSigningOut(false) }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text)',
    fontFamily: 'monospace',
    fontSize: '13px',
  }

  const pixelLabel: React.CSSProperties = {
    fontFamily: 'var(--font-pixel)',
    fontSize: '6px',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: '480px' }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#f0c040', letterSpacing: '1px', marginBottom: '28px' }}>
        TRAINER PROFILE
      </div>

      {/* ── Trainer Name ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
        <div style={pixelLabel}>TRAINER NAME</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={displayed}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            maxLength={16}
            placeholder="YOUR NAME"
            style={inputStyle}
          />
          <button
            onClick={handleSave}
            disabled={draft === null}
            style={{
              padding: '8px 14px',
              background: 'var(--blue)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'var(--font-pixel)',
              fontSize: '6px',
              cursor: draft === null ? 'not-allowed' : 'pointer',
              opacity: draft === null ? 0.45 : 1,
            }}
          >
            SAVE
          </button>
        </div>
      </div>

      {/* ── Auth / Sync ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={pixelLabel}>SYNC ACCOUNT</div>

        {isAnonymous ? (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Not signed in. Your data stays on this device.
            </div>
            <button
              onClick={() => router.push('/login')}
              style={{ padding: '10px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              SIGN IN / CREATE ACCOUNT
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: '#f0c040', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(user.email ?? 'GOOGLE ACCOUNT').toUpperCase()}
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', cursor: signingOut ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
            >
              {signingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/web-pokedex add app/profile/page.tsx
git -C /home/madmaxlgndklr/Git/web-pokedex commit -m "feat: add profile page with trainer name and auth state"
```

---

### Task 5: Add PROFILE link to Sidebar

**Files:**
- Modify: `components/nav/Sidebar.tsx`

- [ ] **Step 1: Add profile to the NAV array**

Find lines 9–15 in `components/nav/Sidebar.tsx`:
```typescript
const NAV = [
  { href: '/list',       label: 'LIST'     },
  { href: '/collection', label: 'COLLECT'  },
  { href: '/team',       label: 'TEAM'     },
  { href: '/battle',     label: 'BATTLE'   },
  { href: '/settings',   label: 'SETTINGS' },
]
```

Replace with:
```typescript
const NAV = [
  { href: '/list',       label: 'LIST'     },
  { href: '/collection', label: 'COLLECT'  },
  { href: '/team',       label: 'TEAM'     },
  { href: '/battle',     label: 'BATTLE'   },
  { href: '/settings',   label: 'SETTINGS' },
  { href: '/profile',    label: 'PROFILE'  },
]
```

- [ ] **Step 2: Run all tests**

```bash
cd /home/madmaxlgndklr/Git/web-pokedex && npx vitest run
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
git -C /home/madmaxlgndklr/Git/web-pokedex add components/nav/Sidebar.tsx
git -C /home/madmaxlgndklr/Git/web-pokedex commit -m "feat: add Profile link to sidebar nav"
```

---

### Done

After all tasks: verify the profile page is visible at `/profile`, the Trainer Name field persists on reload (written to Dexie), and after signing in the field syncs to Supabase (check `settings` table in Supabase dashboard). Run `npx vitest run` one last time to confirm clean state.
