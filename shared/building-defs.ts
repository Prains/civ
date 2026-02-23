import type { BuildingType, Resources } from './game-types'

export interface BuildingDef {
  type: BuildingType
  name: string
  productionCost: number
  income: Resources
  upkeep: Resources
  unlocks: string[]
  defenseBonus: number
}

const ZERO_RESOURCES: Resources = { food: 0, production: 0, gold: 0, science: 0, culture: 0 }

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  farm: {
    type: 'farm',
    name: 'Farm',
    productionCost: 30,
    income: { ...ZERO_RESOURCES, food: 3 },
    upkeep: { ...ZERO_RESOURCES },
    unlocks: [],
    defenseBonus: 0
  },
  lumber_mill: {
    type: 'lumber_mill',
    name: 'Lumber Mill',
    productionCost: 40,
    income: { ...ZERO_RESOURCES, production: 3 },
    upkeep: { ...ZERO_RESOURCES },
    unlocks: [],
    defenseBonus: 0
  },
  market: {
    type: 'market',
    name: 'Market',
    productionCost: 60,
    income: { ...ZERO_RESOURCES, gold: 2 },
    upkeep: { ...ZERO_RESOURCES },
    unlocks: [],
    defenseBonus: 0
  },
  library: {
    type: 'library',
    name: 'Library',
    productionCost: 80,
    income: { ...ZERO_RESOURCES, science: 2 },
    upkeep: { ...ZERO_RESOURCES },
    unlocks: [],
    defenseBonus: 0
  },
  temple: {
    type: 'temple',
    name: 'Temple',
    productionCost: 70,
    income: { ...ZERO_RESOURCES, culture: 2 },
    upkeep: { ...ZERO_RESOURCES },
    unlocks: [],
    defenseBonus: 0
  },
  barracks: {
    type: 'barracks',
    name: 'Barracks',
    productionCost: 100,
    income: { ...ZERO_RESOURCES },
    upkeep: { ...ZERO_RESOURCES },
    unlocks: ['warrior'],
    defenseBonus: 0
  },
  walls: {
    type: 'walls',
    name: 'Walls',
    productionCost: 120,
    income: { ...ZERO_RESOURCES },
    upkeep: { ...ZERO_RESOURCES },
    unlocks: [],
    defenseBonus: 50
  }
}

export function getBuildingDef(type: BuildingType): BuildingDef {
  return BUILDING_DEFS[type]
}
