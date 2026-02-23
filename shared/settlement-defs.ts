import type { SettlementTier } from './game-types'

export interface SettlementDef {
  tier: SettlementTier
  name: string
  productionCost: number
  buildingSlots: number
  gatherRadius: number
  maxHp: number
  baseDefense: number
}

export const SETTLEMENT_DEFS: Record<SettlementTier, SettlementDef> = {
  outpost: {
    tier: 'outpost',
    name: 'Outpost',
    productionCost: 50,
    buildingSlots: 2,
    gatherRadius: 2,
    maxHp: 100,
    baseDefense: 5
  },
  settlement: {
    tier: 'settlement',
    name: 'Settlement',
    productionCost: 150,
    buildingSlots: 4,
    gatherRadius: 3,
    maxHp: 200,
    baseDefense: 10
  },
  city: {
    tier: 'city',
    name: 'City',
    productionCost: 300,
    buildingSlots: 8,
    gatherRadius: 4,
    maxHp: 400,
    baseDefense: 20
  }
}

export function getSettlementDef(tier: SettlementTier): SettlementDef {
  return SETTLEMENT_DEFS[tier]
}
