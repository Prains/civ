import { describe, expect, it } from 'vitest'
import { isValidFactionId, FACTION_IDS } from '../../shared/game-types'

describe('game-types', () => {
  it('validates faction IDs', () => {
    expect(isValidFactionId('solar_empire')).toBe(true)
    expect(isValidFactionId('merchant_league')).toBe(true)
    expect(isValidFactionId('invalid')).toBe(false)
  })

  it('exports all 4 faction IDs', () => {
    expect(FACTION_IDS).toHaveLength(4)
  })
})
