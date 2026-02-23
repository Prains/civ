import { describe, expect, it } from 'vitest'
import { BUILDING_DEFS, getBuildingDef } from '../../shared/building-defs'
import { BUILDING_TYPES } from '../../shared/game-types'

describe('building-defs', () => {
  it('defines all building types', () => {
    for (const type of BUILDING_TYPES) {
      expect(BUILDING_DEFS[type]).toBeDefined()
    }
  })

  it('each building has cost and name', () => {
    for (const def of Object.values(BUILDING_DEFS)) {
      expect(def.name).toBeTruthy()
      expect(def.productionCost).toBeGreaterThan(0)
    }
  })

  it('farm produces food', () => {
    const farm = getBuildingDef('farm')
    expect(farm.productionCost).toBe(30)
    expect(farm.income.food).toBe(3)
  })

  it('barracks enables warrior purchasing', () => {
    const barracks = getBuildingDef('barracks')
    expect(barracks.unlocks).toContain('warrior')
  })

  it('walls boost defense', () => {
    const walls = getBuildingDef('walls')
    expect(walls.defenseBonus).toBeGreaterThan(0)
  })

  it('lumber mill produces production', () => {
    const lumberMill = getBuildingDef('lumber_mill')
    expect(lumberMill.productionCost).toBe(40)
    expect(lumberMill.income.production).toBe(3)
  })

  it('market produces gold', () => {
    const market = getBuildingDef('market')
    expect(market.productionCost).toBe(60)
    expect(market.income.gold).toBe(2)
  })

  it('library produces science', () => {
    const library = getBuildingDef('library')
    expect(library.productionCost).toBe(80)
    expect(library.income.science).toBe(2)
  })

  it('temple produces culture', () => {
    const temple = getBuildingDef('temple')
    expect(temple.productionCost).toBe(70)
    expect(temple.income.culture).toBe(2)
  })

  it('each building has all resource fields in income', () => {
    for (const def of Object.values(BUILDING_DEFS)) {
      expect(def.income.food).toBeDefined()
      expect(def.income.production).toBeDefined()
      expect(def.income.gold).toBeDefined()
      expect(def.income.science).toBeDefined()
      expect(def.income.culture).toBeDefined()
    }
  })

  it('non-wall buildings have zero defense bonus', () => {
    for (const [type, def] of Object.entries(BUILDING_DEFS)) {
      if (type !== 'walls') {
        expect(def.defenseBonus).toBe(0)
      }
    }
  })
})
