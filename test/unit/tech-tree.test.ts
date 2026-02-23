import { describe, expect, it } from 'vitest'
import { TECH_TREE, getTech, getAvailableTechs, getEpochTechs } from '../../shared/tech-tree'

describe('tech-tree', () => {
  it('has 12 common techs (4 per epoch)', () => {
    const common = Object.values(TECH_TREE).filter(t => !t.factionOnly)
    expect(common).toHaveLength(12)
  })

  it('has 4 techs per faction branch', () => {
    for (const factionId of ['solar_empire', 'merchant_league', 'forest_keepers', 'seekers']) {
      const factionTechs = Object.values(TECH_TREE).filter(t => t.factionOnly === factionId)
      expect(factionTechs).toHaveLength(4)
    }
  })

  it('epoch 1 techs have no common prerequisites', () => {
    const epoch1 = getEpochTechs(1)
    for (const tech of epoch1) {
      expect(tech.requires).toHaveLength(0)
    }
  })

  it('getAvailableTechs returns epoch 1 techs when nothing researched', () => {
    const available = getAvailableTechs([], 'solar_empire')
    const ids = available.map(t => t.id)
    expect(ids).toContain('agriculture')
    expect(ids).toContain('mining')
    expect(ids).not.toContain('trade') // epoch 2
  })

  it('getAvailableTechs excludes already researched', () => {
    const available = getAvailableTechs(['agriculture'], 'solar_empire')
    expect(available.find(t => t.id === 'agriculture')).toBeUndefined()
  })

  it('epoch 2 unlocks after 3 epoch-1 techs', () => {
    const researched = ['agriculture', 'mining', 'scouting']
    const available = getAvailableTechs(researched, 'solar_empire')
    const ids = available.map(t => t.id)
    expect(ids).toContain('trade') // epoch 2
    expect(ids).toContain('military') // epoch 2
  })

  it('faction techs not available to other factions', () => {
    const available = getAvailableTechs([], 'merchant_league')
    expect(available.find(t => t.id === 'phalanx_formation')).toBeUndefined()
  })

  it('getTech returns correct tech by id', () => {
    const tech = getTech('agriculture')
    expect(tech.name).toBe('Agriculture')
    expect(tech.epoch).toBe(1)
  })

  it('getTech throws for unknown id', () => {
    expect(() => getTech('nonexistent')).toThrow()
  })

  it('all techs have valid requires references', () => {
    for (const tech of Object.values(TECH_TREE)) {
      for (const reqId of tech.requires) {
        expect(TECH_TREE[reqId], `${tech.id} requires unknown tech ${reqId}`).toBeDefined()
      }
    }
  })

  it('faction branch techs are chained sequentially', () => {
    // Solar Empire chain
    expect(getTech('phalanx_formation').requires).toEqual([])
    expect(getTech('siege_weapons').requires).toEqual(['phalanx_formation'])
    expect(getTech('fortress_assault').requires).toEqual(['siege_weapons'])
    expect(getTech('total_war').requires).toEqual(['fortress_assault'])

    // Merchant League chain
    expect(getTech('mint').requires).toEqual([])
    expect(getTech('banking').requires).toEqual(['mint'])
    expect(getTech('trade_guilds').requires).toEqual(['banking'])
    expect(getTech('economic_dominance').requires).toEqual(['trade_guilds'])

    // Forest Keepers chain
    expect(getTech('forest_wisdom').requires).toEqual([])
    expect(getTech('camouflage').requires).toEqual(['forest_wisdom'])
    expect(getTech('sacred_groves_tech').requires).toEqual(['camouflage'])
    expect(getTech('great_awakening').requires).toEqual(['sacred_groves_tech'])

    // The Seekers chain
    expect(getTech('experiments').requires).toEqual([])
    expect(getTech('alchemy').requires).toEqual(['experiments'])
    expect(getTech('great_inventions').requires).toEqual(['alchemy'])
    expect(getTech('enlightenment_tech').requires).toEqual(['great_inventions'])
  })

  it('first faction branch tech is available from start for matching faction', () => {
    const solarAvailable = getAvailableTechs([], 'solar_empire')
    expect(solarAvailable.find(t => t.id === 'phalanx_formation')).toBeDefined()

    const merchantAvailable = getAvailableTechs([], 'merchant_league')
    expect(merchantAvailable.find(t => t.id === 'mint')).toBeDefined()

    const forestAvailable = getAvailableTechs([], 'forest_keepers')
    expect(forestAvailable.find(t => t.id === 'forest_wisdom')).toBeDefined()

    const seekerAvailable = getAvailableTechs([], 'seekers')
    expect(seekerAvailable.find(t => t.id === 'experiments')).toBeDefined()
  })

  it('second faction branch tech requires first', () => {
    const available = getAvailableTechs([], 'solar_empire')
    expect(available.find(t => t.id === 'siege_weapons')).toBeUndefined()

    const afterFirst = getAvailableTechs(['phalanx_formation'], 'solar_empire')
    expect(afterFirst.find(t => t.id === 'siege_weapons')).toBeDefined()
  })

  it('epoch 3 unlocks after 3 epoch-2 techs', () => {
    const researched = [
      'agriculture', 'mining', 'scouting', 'construction', // epoch 1
      'trade', 'military', 'architecture' // 3 epoch 2
    ]
    const available = getAvailableTechs(researched, 'solar_empire')
    const ids = available.map(t => t.id)
    expect(ids).toContain('economics') // epoch 3
    expect(ids).toContain('philosophy') // epoch 3
  })

  it('epoch 3 does not unlock with only 2 epoch-2 techs', () => {
    const researched = [
      'agriculture', 'mining', 'scouting', 'construction', // epoch 1
      'trade', 'military' // only 2 epoch 2
    ]
    const available = getAvailableTechs(researched, 'solar_empire')
    const ids = available.map(t => t.id)
    expect(ids).not.toContain('economics')
    expect(ids).not.toContain('philosophy')
  })

  it('getEpochTechs returns only common techs for that epoch', () => {
    const epoch1 = getEpochTechs(1)
    expect(epoch1).toHaveLength(4)
    expect(epoch1.every(t => t.epoch === 1)).toBe(true)
    expect(epoch1.every(t => !t.factionOnly)).toBe(true)

    const epoch2 = getEpochTechs(2)
    expect(epoch2).toHaveLength(4)
    expect(epoch2.every(t => t.epoch === 2)).toBe(true)

    const epoch3 = getEpochTechs(3)
    expect(epoch3).toHaveLength(4)
    expect(epoch3.every(t => t.epoch === 3)).toBe(true)
  })

  it('all techs have at least one effect', () => {
    for (const tech of Object.values(TECH_TREE)) {
      expect(tech.effects.length, `${tech.id} has no effects`).toBeGreaterThanOrEqual(1)
    }
  })

  it('total tech count is 28 (12 common + 16 faction)', () => {
    expect(Object.keys(TECH_TREE)).toHaveLength(28)
  })
})
