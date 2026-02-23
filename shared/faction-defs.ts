import type { FactionId } from './game-types'

export interface FactionDef {
  id: FactionId
  name: string
  description: string
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  solar_empire: {
    id: 'solar_empire',
    name: 'Solar Empire',
    description: 'Expansion and conquest. More territory = more power.'
  },
  merchant_league: {
    id: 'merchant_league',
    name: 'Merchant League',
    description: 'Gold solves everything. Trade and diplomacy.'
  },
  forest_keepers: {
    id: 'forest_keepers',
    name: 'Forest Keepers',
    description: 'Quality over quantity. Deep development, not wide.'
  },
  seekers: {
    id: 'seekers',
    name: 'The Seekers',
    description: 'Science and progress. Technological superiority.'
  }
}

export function getFaction(id: FactionId): FactionDef {
  return FACTIONS[id]
}
