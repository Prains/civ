import { describe, expect, it } from 'vitest'
import { UNIT_DEFS, getUnitDef } from '../../shared/unit-defs'
import { UNIT_TYPES } from '../../shared/game-types'

describe('unit-defs', () => {
  it('defines all unit types', () => {
    for (const type of UNIT_TYPES) {
      expect(UNIT_DEFS[type]).toBeDefined()
    }
  })

  it('each unit has cost and stats', () => {
    for (const def of Object.values(UNIT_DEFS)) {
      expect(def.name).toBeTruthy()
      expect(def.goldCost).toBeGreaterThanOrEqual(0)
      expect(def.maxHp).toBeGreaterThan(0)
      expect(def.visionRange).toBeGreaterThan(0)
    }
  })

  it('scout has high vision range', () => {
    const scout = getUnitDef('scout')
    expect(scout.visionRange).toBe(4)
  })

  it('warrior has higher strength than scout', () => {
    const warrior = getUnitDef('warrior')
    const scout = getUnitDef('scout')
    expect(warrior.strength).toBeGreaterThan(scout.strength)
  })

  it('settler has no combat strength', () => {
    const settler = getUnitDef('settler')
    expect(settler.strength).toBe(0)
  })

  it('scout has correct stats', () => {
    const scout = getUnitDef('scout')
    expect(scout.goldCost).toBe(20)
    expect(scout.productionCost).toBe(10)
    expect(scout.maxHp).toBe(50)
    expect(scout.strength).toBe(2)
    expect(scout.moveSpeed).toBe(2)
    expect(scout.foodUpkeep).toBe(1)
  })

  it('warrior has correct stats', () => {
    const warrior = getUnitDef('warrior')
    expect(warrior.goldCost).toBe(40)
    expect(warrior.productionCost).toBe(30)
    expect(warrior.maxHp).toBe(100)
    expect(warrior.strength).toBe(8)
    expect(warrior.moveSpeed).toBe(1)
    expect(warrior.foodUpkeep).toBe(2)
  })

  it('settler has correct stats', () => {
    const settler = getUnitDef('settler')
    expect(settler.goldCost).toBe(60)
    expect(settler.productionCost).toBe(50)
    expect(settler.maxHp).toBe(60)
    expect(settler.moveSpeed).toBe(1)
    expect(settler.foodUpkeep).toBe(2)
  })

  it('gatherer has correct stats', () => {
    const gatherer = getUnitDef('gatherer')
    expect(gatherer.goldCost).toBe(15)
    expect(gatherer.productionCost).toBe(10)
    expect(gatherer.maxHp).toBe(40)
    expect(gatherer.strength).toBe(1)
    expect(gatherer.moveSpeed).toBe(1)
    expect(gatherer.foodUpkeep).toBe(1)
  })

  it('builder has correct stats', () => {
    const builder = getUnitDef('builder')
    expect(builder.goldCost).toBe(25)
    expect(builder.productionCost).toBe(15)
    expect(builder.maxHp).toBe(50)
    expect(builder.strength).toBe(1)
    expect(builder.moveSpeed).toBe(1)
    expect(builder.foodUpkeep).toBe(1)
  })

  it('all units have positive production cost', () => {
    for (const def of Object.values(UNIT_DEFS)) {
      expect(def.productionCost).toBeGreaterThan(0)
    }
  })

  it('all units have non-negative food upkeep', () => {
    for (const def of Object.values(UNIT_DEFS)) {
      expect(def.foodUpkeep).toBeGreaterThanOrEqual(0)
    }
  })
})
