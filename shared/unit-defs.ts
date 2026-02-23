import type { UnitType } from './game-types'

export interface UnitDef {
  type: UnitType
  name: string
  goldCost: number
  productionCost: number
  foodUpkeep: number
  maxHp: number
  strength: number
  visionRange: number
  moveSpeed: number
}

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  scout: {
    type: 'scout',
    name: 'Scout',
    goldCost: 20,
    productionCost: 10,
    foodUpkeep: 1,
    maxHp: 50,
    strength: 2,
    visionRange: 4,
    moveSpeed: 2
  },
  gatherer: {
    type: 'gatherer',
    name: 'Gatherer',
    goldCost: 15,
    productionCost: 10,
    foodUpkeep: 1,
    maxHp: 40,
    strength: 1,
    visionRange: 2,
    moveSpeed: 1
  },
  warrior: {
    type: 'warrior',
    name: 'Warrior',
    goldCost: 40,
    productionCost: 30,
    foodUpkeep: 2,
    maxHp: 100,
    strength: 8,
    visionRange: 2,
    moveSpeed: 1
  },
  settler: {
    type: 'settler',
    name: 'Settler',
    goldCost: 60,
    productionCost: 50,
    foodUpkeep: 2,
    maxHp: 60,
    strength: 0,
    visionRange: 2,
    moveSpeed: 1
  },
  builder: {
    type: 'builder',
    name: 'Builder',
    goldCost: 25,
    productionCost: 15,
    foodUpkeep: 1,
    maxHp: 50,
    strength: 1,
    visionRange: 2,
    moveSpeed: 1
  }
}

export function getUnitDef(type: UnitType): UnitDef {
  return UNIT_DEFS[type]
}
