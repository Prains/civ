import { describe, expect, it } from 'vitest'
import { isValidFactionId, isValidUnitType, isValidResourceType, FACTION_IDS, UNIT_TYPES, RESOURCE_TYPES } from '../../shared/game-types'

describe('game-types', () => {
  it('validates faction IDs', () => {
    expect(isValidFactionId('solar_empire')).toBe(true)
    expect(isValidFactionId('merchant_league')).toBe(true)
    expect(isValidFactionId('invalid')).toBe(false)
  })

  it('exports all 4 faction IDs', () => {
    expect(FACTION_IDS).toHaveLength(4)
  })

  it('exports all 5 resource types', () => {
    expect(RESOURCE_TYPES).toHaveLength(5)
  })

  it('validates resource types', () => {
    expect(isValidResourceType('food')).toBe(true)
    expect(isValidResourceType('gold')).toBe(true)
    expect(isValidResourceType('mana')).toBe(false)
  })

  it('exports all 5 unit types', () => {
    expect(UNIT_TYPES).toHaveLength(5)
  })

  it('validates unit types', () => {
    expect(isValidUnitType('scout')).toBe(true)
    expect(isValidUnitType('warrior')).toBe(true)
    expect(isValidUnitType('dragon')).toBe(false)
  })
})
