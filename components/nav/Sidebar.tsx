// components/nav/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { MobileMenu } from './MobileMenu'
import { AccountBadge } from '@/components/auth/AccountBadge'

const NAV = [
  { href: '/list',       label: 'LIST'     },
  { href: '/collection', label: 'COLLECT'  },
  { href: '/team',       label: 'TEAM'     },
  { href: '/battle',     label: 'BATTLE'   },
  { href: '/settings',   label: 'SETTINGS' },
  { href: '/profile',    label: 'PROFILE'  },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
        className="hidden lg:flex flex-col w-44 xl:w-52 min-h-screen sticky top-0 h-screen shrink-0"
      >
        <Link href="/" style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{ background: 'var(--header)' }} className="p-4 flex items-center gap-2 shrink-0">
            <div
              style={{ background: 'var(--glow)', boxShadow: '0 0 8px var(--glow)' }}
              className="w-3 h-3 rounded-full shrink-0"
            />
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', letterSpacing: '2px', color: '#fff' }}>
              POKÉDEX
            </span>
          </div>
        </Link>

        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '7px',
                  letterSpacing: '1px',
                  color: active ? 'var(--gold)' : 'var(--text-muted)',
                  borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                  background: active ? 'var(--bg)' : 'transparent',
                }}
                className="block px-4 py-3 transition-colors hover:opacity-80"
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }} className="shrink-0">
          <AccountBadge />
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }} className="shrink-0">
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile: top bar with hamburger */}
      <div
        style={{ background: 'var(--header)' }}
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div className="flex items-center gap-2">
            <div style={{ background: 'var(--glow)', boxShadow: '0 0 6px var(--glow)' }} className="w-2 h-2 rounded-full" />
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', letterSpacing: '2px', color: '#fff' }}>
              POKÉDEX
            </span>
          </div>
        </Link>
        <MobileMenu nav={NAV} pathname={pathname} />
      </div>

      {/* Mobile top bar spacer */}
      <div className="lg:hidden h-11" />
    </>
  )
}
