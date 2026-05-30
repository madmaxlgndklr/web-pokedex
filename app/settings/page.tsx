'use client'
import { useTheme } from '@/lib/theme'
import { useSetting } from '@/lib/db'
import { GENERATIONS } from '@/lib/constants'

export default function SettingsPage() {
  const { theme, toggle } = useTheme()
  const [gen, setGen] = useSetting('generation', '3')
  const [music, setMusic] = useSetting('musicOnLaunch', 'false')
  const [spriteMode, setSpriteMode] = useSetting('sprite_mode', 'modern')

  const row = (label: string, control: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: 'var(--text)' }}>{label}</span>
      {control}
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '16px', maxWidth: '500px' }}>
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--gold)', marginBottom: '16px' }}>SETTINGS</h1>

      {row('THEME', (
        <button
          onClick={toggle}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '7px', padding: '4px 10px', borderRadius: '3px', cursor: 'pointer' }}
        >
          {theme === 'dark' ? 'DARK ●' : 'LIGHT ☀'}
        </button>
      ))}

      {row('SPRITE MODE', (
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
      ))}

      {row('DEFAULT GEN', (
        <select
          value={gen}
          onChange={e => setGen(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-pixel)', fontSize: '6px', padding: '4px 8px', borderRadius: '3px' }}
        >
          {GENERATIONS.map((g, i) => (
            <option key={i} value={String(i + 1)}>{g.label}</option>
          ))}
        </select>
      ))}

      {row('MUSIC ON LAUNCH', (
        <button
          onClick={() => setMusic(music === 'true' ? 'false' : 'true')}
          style={{
            background: music === 'true' ? 'var(--gold)' : 'var(--surface)',
            border: '1px solid var(--border)',
            color: music === 'true' ? 'var(--surface)' : 'var(--text-muted)',
            fontFamily: 'var(--font-pixel)',
            fontSize: '7px',
            padding: '4px 10px',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {music === 'true' ? 'ON' : 'OFF'}
        </button>
      ))}

      <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '5px', color: 'var(--text-muted)', marginTop: '8px' }}>
        Music toggle saved for future web audio support
      </p>
    </div>
  )
}
