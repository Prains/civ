import type { FactionId, Resources, AdvisorType } from './game-types'

export interface FactionDef {
  id: FactionId
  name: string
  description: string
  resourceModifiers: Resources
  combatStrengthModifier: number
  aiModifiers: {
    territoriality: number
    aggression: number
    greed: number
    curiosity: number
    safety: number
  }
  uniqueUnitType: string
  uniqueBuildingType: string
  startingAdvisorLoyalty: Record<AdvisorType, number>
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  solar_empire: {
    id: 'solar_empire',
    name: 'Solar Empire',
    description: 'Expansion and conquest. More territory = more power.',
    resourceModifiers: { food: 1, production: 1.2, gold: 1, science: 0.9, culture: 1 },
    combatStrengthModifier: 1,
    aiModifiers: { territoriality: 1.5, aggression: 1.3, greed: 1, curiosity: 1, safety: 1 },
    uniqueUnitType: 'legionnaire',
    uniqueBuildingType: 'fort',
    startingAdvisorLoyalty: { general: 70, treasurer: 50, priest: 40, scholar: 40, tribune: 50 }
  },
  merchant_league: {
    id: 'merchant_league',
    name: 'Merchant League',
    description: 'Gold solves everything. Trade and diplomacy.',
    resourceModifiers: { food: 1, production: 1, gold: 1.3, science: 1, culture: 1 },
    combatStrengthModifier: 0.85,
    aiModifiers: { territoriality: 0.8, aggression: 0.7, greed: 1.5, curiosity: 1, safety: 1.3 },
    uniqueUnitType: 'caravan',
    uniqueBuildingType: 'grand_market',
    startingAdvisorLoyalty: { general: 40, treasurer: 70, priest: 50, scholar: 50, tribune: 50 }
  },
  forest_keepers: {
    id: 'forest_keepers',
    name: 'Forest Keepers',
    description: 'Quality over quantity. Deep development, not wide.',
    resourceModifiers: { food: 1, production: 1, gold: 1, science: 1, culture: 1.2 },
    combatStrengthModifier: 1,
    aiModifiers: { territoriality: 0.6, aggression: 0.8, greed: 1, curiosity: 1, safety: 0.7 },
    uniqueUnitType: 'ranger',
    uniqueBuildingType: 'sacred_grove',
    startingAdvisorLoyalty: { general: 40, treasurer: 50, priest: 70, scholar: 50, tribune: 50 }
  },
  seekers: {
    id: 'seekers',
    name: 'The Seekers',
    description: 'Science and progress. Technological superiority.',
    resourceModifiers: { food: 1, production: 0.85, gold: 1, science: 1.3, culture: 1 },
    combatStrengthModifier: 1,
    aiModifiers: { territoriality: 0.8, aggression: 0.5, greed: 1, curiosity: 2.0, safety: 1 },
    uniqueUnitType: 'scholar_unit',
    uniqueBuildingType: 'academy',
    startingAdvisorLoyalty: { general: 40, treasurer: 50, priest: 40, scholar: 70, tribune: 50 }
  }
}

export function getFaction(id: FactionId): FactionDef {
  return FACTIONS[id]
}
