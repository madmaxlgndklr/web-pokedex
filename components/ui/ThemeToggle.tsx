'use client'
import { useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-pixel)', fontSize: '6px' }}
      className="w-full text-left py-2 px-4 hover:opacity-80 transition-opacity"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀ LIGHT' : '● DARK'}
    </button>
  )
}
