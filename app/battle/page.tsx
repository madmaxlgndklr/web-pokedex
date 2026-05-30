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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--header)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '8px', color: '#f0c040', letterSpacing: '1px' }}>BATTLE HUB</span>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontFamily: 'var(--font-pixel)',
              fontSize: '6px',
              letterSpacing: '0.5px',
              color: tab === t ? 'var(--bg)' : 'var(--text-muted)',
              background: tab === t ? 'var(--blue)' : 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--blue)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <TabErrorBoundary key={tab}>
          {tab === 'CALC'  && <DamageCalcScreen preloadId={preloadId} />}
          {tab === 'WILD'  && <TurnBattleScreen teamIds={teamIds} />}
          {tab === 'TRAIN' && (
            activeTrainer
              ? <TurnBattleScreen teamIds={teamIds} trainer={activeTrainer} onBack={() => setActiveTrainer(null)} />
              : <TrainerSelectScreen teamIds={teamIds} onStartBattle={(t) => setActiveTrainer(t)} />
          )}
          {tab === 'MATCH' && <MatchupScreen />}
          {tab === 'LOG'   && <RecordScreen />}
        </TabErrorBoundary>
      </div>
    </div>
  )
}

export default function BattlePage() {
  return <Suspense><BattlePageInner /></Suspense>
}
