import { describe, expect, it } from 'vitest'
import { parseLicenseDatesPayload } from './license-dates'

describe('parseLicenseDatesPayload', () => {
  it('rejects non-object payloads', () => {
    expect(parseLicenseDatesPayload(null)).toEqual({
      error: 'Body must be a JSON object with a "dates" array.',
    })
    expect(parseLicenseDatesPayload('nope')).toEqual({
      error: 'Body must be a JSON object with a "dates" array.',
    })
  })

  it('rejects a missing or non-array dates field', () => {
    expect(parseLicenseDatesPayload({})).toEqual({
      error: 'Body must be a JSON object with a "dates" array.',
    })
    expect(parseLicenseDatesPayload({ dates: 'x' })).toEqual({
      error: 'Body must be a JSON object with a "dates" array.',
    })
  })

  it('rejects an empty dates array', () => {
    expect(parseLicenseDatesPayload({ dates: [] })).toEqual({
      error: '"dates" is empty.',
    })
  })

  it('rejects entries with a bad appid', () => {
    for (const appid of [0, -3, 1.5, '440', null, undefined]) {
      const result = parseLicenseDatesPayload({
        dates: [{ appid, acquired: '2026-01-01' }],
      })
      expect('error' in result && result.error).toMatch(/appid/)
    }
  })

  it('rejects entries with a malformed or impossible date', () => {
    for (const acquired of [
      '01/02/2026',
      '2026-13-01',
      '2026-02-30',
      '2026-1-1',
      20260101,
      null,
    ]) {
      const result = parseLicenseDatesPayload({
        dates: [{ appid: 440, acquired }],
      })
      expect('error' in result && result.error).toMatch(/acquired/)
    }
  })

  it('accepts valid entries', () => {
    expect(
      parseLicenseDatesPayload({
        dates: [
          { appid: 440, acquired: '2011-06-24' },
          { appid: 601150, acquired: '2019-03-10' },
        ],
      }),
    ).toEqual({
      dates: [
        { appid: 440, acquired: '2011-06-24' },
        { appid: 601150, acquired: '2019-03-10' },
      ],
    })
  })

  it('reports the index of the first invalid entry', () => {
    const result = parseLicenseDatesPayload({
      dates: [
        { appid: 440, acquired: '2011-06-24' },
        { appid: 440, acquired: 'bad' },
      ],
    })
    expect('error' in result && result.error).toMatch(/index 1/)
  })
})
