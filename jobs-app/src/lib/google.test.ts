import { describe, expect, it } from 'vitest'
import { GoogleResponseError, isGoogleRefusal, isTerminalClientError } from './google'

describe('isGoogleRefusal', () => {
  it('recognises any answer from Google, and nothing else', () => {
    expect(isGoogleRefusal(new GoogleResponseError('refused', 400))).toBe(true)
    expect(isGoogleRefusal(new GoogleResponseError('server error', 503))).toBe(true)
    expect(isGoogleRefusal(new Error('network down'))).toBe(false)
    expect(isGoogleRefusal(null)).toBe(false)
  })
})

describe('isTerminalClientError', () => {
  it('treats client rejections as proof that nothing was delivered', () => {
    for (const status of [400, 401, 403, 404, 413, 422, 429]) {
      expect(isTerminalClientError(new GoogleResponseError('rejected', status))).toBe(true)
    }
  })

  it('never treats a server failure as proof, because Gmail can fail after accepting', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isTerminalClientError(new GoogleResponseError('server error', status))).toBe(false)
    }
  })

  it('treats a request timeout as unknown rather than refused', () => {
    expect(isTerminalClientError(new GoogleResponseError('timeout', 408))).toBe(false)
  })

  it('treats a transport failure as unknown', () => {
    expect(isTerminalClientError(new Error('Failed to fetch'))).toBe(false)
  })
})
