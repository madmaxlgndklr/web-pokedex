import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

import { resetPasswordForEmail } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const mockReset = supabase.auth.resetPasswordForEmail as ReturnType<typeof vi.fn>

describe('resetPasswordForEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls supabase with email and a redirectTo pointing to /auth/reset-password', async () => {
    mockReset.mockResolvedValue({ data: {}, error: null })

    await resetPasswordForEmail('user@example.com')

    expect(mockReset).toHaveBeenCalledOnce()
    const [calledEmail, opts] = mockReset.mock.calls[0]
    expect(calledEmail).toBe('user@example.com')
    expect(opts.redirectTo).toContain('/auth/reset-password')
  })

  it('throws when supabase returns an error', async () => {
    mockReset.mockResolvedValue({ data: {}, error: { message: 'Rate limit exceeded' } })

    await expect(resetPasswordForEmail('user@example.com')).rejects.toThrow('Rate limit exceeded')
  })
})
