import { describe, expect, it } from 'vitest'
import { FACTIONS, getFaction } from '../../shared/faction-defs'
import { FACTION_IDS } from '../../shared/game-types'

describe('faction-defs', () => {
  it('defines all 4 factions', () => {
    expect(Object.keys(FACTIONS)).toHaveLength(4)
    for (const id of FACTION_IDS) {
      expect(FACTIONS[id]).toBeDefined()
    }
  })

  it('each faction has required fields', () => {
    for (const faction of Object.values(FACTIONS)) {
      expect(faction.name).toBeTruthy()
      expect(faction.resourceModifiers).toBeDefined()
      expect(faction.aiModifiers).toBeDefined()
      expect(faction.uniqueUnitType).toBeTruthy()
      expect(faction.uniqueBuildingType).toBeTruthy()
      expect(faction.startingAdvisorLoyalty).toBeDefined()
    }
  })

  it('getFaction returns correct faction', () => {
    const solar = getFaction('solar_empire')
    expect(solar.name).toBe('Solar Empire')
    expect(solar.resourceModifiers.production).toBe(1.2)
  })

  it('Solar Empire has production bonus and science penalty', () => {
    const f = getFaction('solar_empire')
    expect(f.resourceModifiers.production).toBeGreaterThan(1)
    expect(f.resourceModifiers.science).toBeLessThan(1)
  })

  it('Merchant League has gold bonus and combat penalty', () => {
    const f = getFaction('merchant_league')
    expect(f.resourceModifiers.gold).toBeGreaterThan(1)
    expect(f.combatStrengthModifier).toBeLessThan(1)
  })
})
