// components/nav/MobileMenu.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface Props {
  nav: { href: string; label: string }[]
  pathname: string
}

export function MobileMenu({ nav, pathname }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ color: '#fff', fontFamily: 'var(--font-pixel)', fontSize: '10px' }}
        aria-label="Open menu"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
            className="w-64 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: 'var(--header)' }} className="p-4 flex items-center justify-between">
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: '#fff', letterSpacing: '2px' }}>
                POKÉDEX
              </span>
              <button onClick={() => setOpen(false)} style={{ color: '#fff', fontSize: '14px' }}>✕</button>
            </div>
            <nav className="flex-1 py-4">
              {nav.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    style={{
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '7px',
                      letterSpacing: '1px',
                      color: active ? 'var(--gold)' : 'var(--text-muted)',
                      borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                    }}
                    className="block px-4 py-3"
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <ThemeToggle />
            </div>
          </div>
          <div className="flex-1 bg-black/50" />
        </div>
      )}
    </>
  )
}
