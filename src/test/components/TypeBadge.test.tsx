// src/test/components/TypeBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TypeBadge } from '@/components/pokemon/TypeBadge'

describe('TypeBadge', () => {
  it('renders the type name uppercased', () => {
    render(<TypeBadge type="fire" />)
    expect(screen.getByText('FIRE')).toBeInTheDocument()
  })

  it('applies the correct background colour', () => {
    const { container } = render(<TypeBadge type="water" />)
    const badge = container.firstChild as HTMLElement
    // jsdom normalises hex colours to rgb(); #6890f0 → rgb(104, 144, 240)
    expect(badge.style.background).toBe('rgb(104, 144, 240)')
  })
})
