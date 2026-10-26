import { describe, expect, it } from 'vitest'

import { toPublicErrorPayload } from '@/lib/errors/public-error'

describe('NOVA credential error', () => {
  it('preserves the safe configuration message after stream serialization', () => {
    const error = new Error(JSON.stringify({ error: 'NOVA’s OpenRouter key is not available on the server yet.', code: 'provider_auth', type: 'general', retryable: false }))
    expect(toPublicErrorPayload(error).error).toBe('NOVA’s OpenRouter key is not available on the server yet.')
    expect(toPublicErrorPayload(error).retryable).toBe(false)
  })
  it('does not preserve arbitrary provider text with the same error code', () => {
    const error = new Error(JSON.stringify({ error: 'private-provider-secret', code: 'provider_auth', type: 'general' }))
    expect(toPublicErrorPayload(error).error).not.toContain('private-provider-secret')
  })
})
