// components/ui/Modal.tsx
'use client'
import { useEffect, type ReactNode } from 'react'

interface Props { open: boolean; onClose: () => void; children: ReactNode }

export function Modal({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}
        className="relative z-10 p-4 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
