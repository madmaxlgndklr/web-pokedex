import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

import { resetPasswordForEmail, signUpWithEmail } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const mockReset = supabase.auth.resetPasswordForEmail as ReturnType<typeof vi.fn>
const mockUpdateUser = supabase.auth.updateUser as ReturnType<typeof vi.fn>

describe('resetPasswordForEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true,
    })
  })

  it('calls supabase with email and a redirectTo pointing to /auth/reset-password', async () => {
    mockReset.mockResolvedValue({ data: {}, error: null })

    await resetPasswordForEmail('user@example.com')

    expect(mockReset).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: 'https://example.com/auth/reset-password' }
    )
  })

  it('throws when supabase returns an error', async () => {
    mockReset.mockResolvedValue({ data: {}, error: { message: 'Rate limit exceeded' } })

    await expect(resetPasswordForEmail('user@example.com')).rejects.toThrow('Rate limit exceeded')
  })
})

describe('signUpWithEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls updateUser (not signUp) to upgrade the anonymous session', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await signUpWithEmail('user@example.com', 'password123')

    expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password123' })
  })

  it('throws when supabase returns an error', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: { message: 'Email already in use' } })

    await expect(signUpWithEmail('user@example.com', 'password123')).rejects.toThrow('Email already in use')
  })
})
