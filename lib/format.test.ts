import { describe, expect, it } from 'vitest'
import { formatDate, formatPlaytime } from './format'

describe('formatPlaytime', () => {
  it('shows sub-hour playtime in minutes', () => {
    expect(formatPlaytime(0)).toBe('0m')
    expect(formatPlaytime(59)).toBe('59m')
  })

  it('shows whole hours without a decimal', () => {
    expect(formatPlaytime(120)).toBe('2h')
  })

  it('shows fractional hours with one decimal', () => {
    expect(formatPlaytime(90)).toBe('1.5h')
    expect(formatPlaytime(7205)).toBe('120.1h')
  })
})

describe('formatDate', () => {
  const now = new Date('2026-07-16T00:00:00Z')

  it('omits the year for same-year dates', () => {
    expect(formatDate('2026-07-12T10:00:00Z', now)).toBe('Jul 12')
  })

  it('includes the year for other years', () => {
    expect(formatDate('2025-12-03T10:00:00Z', now)).toBe('Dec 3, 2025')
  })
})
