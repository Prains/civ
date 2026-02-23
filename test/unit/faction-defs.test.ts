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
      expect(faction.id).toBeTruthy()
      expect(faction.name).toBeTruthy()
      expect(faction.description).toBeTruthy()
    }
  })

  it('getFaction returns correct faction', () => {
    const solar = getFaction('solar_empire')
    expect(solar.name).toBe('Solar Empire')
  })
})
