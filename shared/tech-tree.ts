import type { TechNode, FactionId } from './game-types'

// --- Common Core: Epoch 1 (Foundations) ---

const agriculture: TechNode = {
  id: 'agriculture',
  name: 'Agriculture',
  epoch: 1,
  scienceCost: 20,
  requires: [],
  effects: [
    { type: 'unlock_building', target: 'farm' }
  ]
}

const mining: TechNode = {
  id: 'mining',
  name: 'Mining',
  epoch: 1,
  scienceCost: 20,
  requires: [],
  effects: [
    { type: 'unlock_improvement', target: 'mine' }
  ]
}

const scouting: TechNode = {
  id: 'scouting',
  name: 'Scouting',
  epoch: 1,
  scienceCost: 15,
  requires: [],
  effects: [
    { type: 'modifier', target: 'scout_vision', value: 1 }
  ]
}

const construction: TechNode = {
  id: 'construction',
  name: 'Construction',
  epoch: 1,
  scienceCost: 25,
  requires: [],
  effects: [
    { type: 'unlock_building', target: 'walls' },
    { type: 'modifier', target: 'outpost_build_speed', value: 1.5 }
  ]
}

// --- Common Core: Epoch 2 (Development) ---

const trade: TechNode = {
  id: 'trade',
  name: 'Trade',
  epoch: 2,
  scienceCost: 40,
  requires: [],
  effects: [
    { type: 'unlock_building', target: 'market' },
    { type: 'modifier', target: 'trade_routes', value: 1 }
  ]
}

const military: TechNode = {
  id: 'military',
  name: 'Military',
  epoch: 2,
  scienceCost: 40,
  requires: [],
  effects: [
    { type: 'modifier', target: 'warrior_strength', value: 1.25 }
  ]
}

const architecture: TechNode = {
  id: 'architecture',
  name: 'Architecture',
  epoch: 2,
  scienceCost: 45,
  requires: [],
  effects: [
    { type: 'modifier', target: 'city_upgrade_speed', value: 1.5 },
    { type: 'modifier', target: 'building_slots', value: 2 }
  ]
}

const writing: TechNode = {
  id: 'writing',
  name: 'Writing',
  epoch: 2,
  scienceCost: 35,
  requires: [],
  effects: [
    { type: 'unlock_building', target: 'library' },
    { type: 'unlock_building', target: 'temple' }
  ]
}

// --- Common Core: Epoch 3 (Flourishing) ---

const economics: TechNode = {
  id: 'economics',
  name: 'Economics',
  epoch: 3,
  scienceCost: 80,
  requires: [],
  effects: [
    { type: 'modifier', target: 'market_efficiency', value: 1.5 },
    { type: 'modifier', target: 'gold_multiplier', value: 1.5 }
  ]
}

const tactics: TechNode = {
  id: 'tactics',
  name: 'Tactics',
  epoch: 3,
  scienceCost: 80,
  requires: [],
  effects: [
    { type: 'modifier', target: 'coordination_bonus', value: 1.3 }
  ]
}

const engineering: TechNode = {
  id: 'engineering',
  name: 'Engineering',
  epoch: 3,
  scienceCost: 90,
  requires: [],
  effects: [
    { type: 'unlock_building', target: 'wonder' }
  ]
}

const philosophy: TechNode = {
  id: 'philosophy',
  name: 'Philosophy',
  epoch: 3,
  scienceCost: 75,
  requires: [],
  effects: [
    { type: 'modifier', target: 'culture_multiplier', value: 1.5 },
    { type: 'victory_progress', target: 'cultural' }
  ]
}

// --- Faction: Solar Empire ---

const phalanxFormation: TechNode = {
  id: 'phalanx_formation',
  name: 'Phalanx Formation',
  epoch: 0,
  scienceCost: 25,
  requires: [],
  factionOnly: 'solar_empire',
  effects: [
    { type: 'modifier', target: 'melee_defense', value: 1.3 }
  ]
}

const siegeWeapons: TechNode = {
  id: 'siege_weapons',
  name: 'Siege Weapons',
  epoch: 0,
  scienceCost: 45,
  requires: ['phalanx_formation'],
  factionOnly: 'solar_empire',
  effects: [
    { type: 'unlock_unit', target: 'siege_engine' }
  ]
}

const fortressAssault: TechNode = {
  id: 'fortress_assault',
  name: 'Fortress Assault',
  epoch: 0,
  scienceCost: 70,
  requires: ['siege_weapons'],
  factionOnly: 'solar_empire',
  effects: [
    { type: 'modifier', target: 'siege_strength', value: 1.5 }
  ]
}

const totalWar: TechNode = {
  id: 'total_war',
  name: 'Total War',
  epoch: 0,
  scienceCost: 100,
  requires: ['fortress_assault'],
  factionOnly: 'solar_empire',
  effects: [
    { type: 'modifier', target: 'military_production', value: 1.5 },
    { type: 'victory_progress', target: 'military' }
  ]
}

// --- Faction: Merchant League ---

const mint: TechNode = {
  id: 'mint',
  name: 'Mint',
  epoch: 0,
  scienceCost: 25,
  requires: [],
  factionOnly: 'merchant_league',
  effects: [
    { type: 'modifier', target: 'gold_income', value: 1.2 }
  ]
}

const banking: TechNode = {
  id: 'banking',
  name: 'Banking',
  epoch: 0,
  scienceCost: 45,
  requires: ['mint'],
  factionOnly: 'merchant_league',
  effects: [
    { type: 'modifier', target: 'gold_interest', value: 1.1 }
  ]
}

const tradeGuilds: TechNode = {
  id: 'trade_guilds',
  name: 'Trade Guilds',
  epoch: 0,
  scienceCost: 70,
  requires: ['banking'],
  factionOnly: 'merchant_league',
  effects: [
    { type: 'modifier', target: 'trade_route_income', value: 1.5 }
  ]
}

const economicDominance: TechNode = {
  id: 'economic_dominance',
  name: 'Economic Dominance',
  epoch: 0,
  scienceCost: 100,
  requires: ['trade_guilds'],
  factionOnly: 'merchant_league',
  effects: [
    { type: 'modifier', target: 'gold_multiplier', value: 2 },
    { type: 'victory_progress', target: 'economic' }
  ]
}

// --- Faction: Forest Keepers ---

const forestWisdom: TechNode = {
  id: 'forest_wisdom',
  name: 'Forest Wisdom',
  epoch: 0,
  scienceCost: 25,
  requires: [],
  factionOnly: 'forest_keepers',
  effects: [
    { type: 'modifier', target: 'forest_yield', value: 1.3 }
  ]
}

const camouflage: TechNode = {
  id: 'camouflage',
  name: 'Camouflage',
  epoch: 0,
  scienceCost: 45,
  requires: ['forest_wisdom'],
  factionOnly: 'forest_keepers',
  effects: [
    { type: 'modifier', target: 'stealth', value: 1 }
  ]
}

const sacredGrovesTech: TechNode = {
  id: 'sacred_groves_tech',
  name: 'Sacred Groves',
  epoch: 0,
  scienceCost: 70,
  requires: ['camouflage'],
  factionOnly: 'forest_keepers',
  effects: [
    { type: 'unlock_building', target: 'sacred_grove' },
    { type: 'modifier', target: 'culture_per_forest', value: 2 }
  ]
}

const greatAwakening: TechNode = {
  id: 'great_awakening',
  name: 'Great Awakening',
  epoch: 0,
  scienceCost: 100,
  requires: ['sacred_groves_tech'],
  factionOnly: 'forest_keepers',
  effects: [
    { type: 'modifier', target: 'nature_power', value: 2 },
    { type: 'victory_progress', target: 'cultural' }
  ]
}

// --- Faction: The Seekers ---

const experiments: TechNode = {
  id: 'experiments',
  name: 'Experiments',
  epoch: 0,
  scienceCost: 25,
  requires: [],
  factionOnly: 'seekers',
  effects: [
    { type: 'modifier', target: 'science_income', value: 1.2 }
  ]
}

const alchemy: TechNode = {
  id: 'alchemy',
  name: 'Alchemy',
  epoch: 0,
  scienceCost: 45,
  requires: ['experiments'],
  factionOnly: 'seekers',
  effects: [
    { type: 'modifier', target: 'resource_conversion', value: 1 }
  ]
}

const greatInventions: TechNode = {
  id: 'great_inventions',
  name: 'Great Inventions',
  epoch: 0,
  scienceCost: 70,
  requires: ['alchemy'],
  factionOnly: 'seekers',
  effects: [
    { type: 'modifier', target: 'research_speed', value: 1.5 }
  ]
}

const enlightenmentTech: TechNode = {
  id: 'enlightenment_tech',
  name: 'Enlightenment',
  epoch: 0,
  scienceCost: 100,
  requires: ['great_inventions'],
  factionOnly: 'seekers',
  effects: [
    { type: 'modifier', target: 'science_multiplier', value: 2 },
    { type: 'victory_progress', target: 'scientific' }
  ]
}

// --- Tech Tree (flat map of all techs) ---

export const TECH_TREE: Record<string, TechNode> = {
  // Epoch 1
  agriculture,
  mining,
  scouting,
  construction,
  // Epoch 2
  trade,
  military,
  architecture,
  writing,
  // Epoch 3
  economics,
  tactics,
  engineering,
  philosophy,
  // Solar Empire
  phalanx_formation: phalanxFormation,
  siege_weapons: siegeWeapons,
  fortress_assault: fortressAssault,
  total_war: totalWar,
  // Merchant League
  mint,
  banking,
  trade_guilds: tradeGuilds,
  economic_dominance: economicDominance,
  // Forest Keepers
  forest_wisdom: forestWisdom,
  camouflage,
  sacred_groves_tech: sacredGrovesTech,
  great_awakening: greatAwakening,
  // The Seekers
  experiments,
  alchemy,
  great_inventions: greatInventions,
  enlightenment_tech: enlightenmentTech
}

/** Minimum number of techs from the previous epoch required to unlock the next epoch */
const EPOCH_GATE_THRESHOLD = 3

/**
 * Look up a tech by its ID. Throws if the tech does not exist.
 */
export function getTech(id: string): TechNode {
  const tech = TECH_TREE[id]
  if (!tech) {
    throw new Error(`Unknown tech: ${id}`)
  }
  return tech
}

/**
 * Get all common (non-faction) techs for a given epoch.
 */
export function getEpochTechs(epoch: number): TechNode[] {
  return Object.values(TECH_TREE).filter(t => t.epoch === epoch && !t.factionOnly)
}

/**
 * Count how many common techs in a given epoch the player has researched.
 */
function countResearchedInEpoch(researched: string[], epoch: number): number {
  const epochTechIds = new Set(getEpochTechs(epoch).map(t => t.id))
  return researched.filter(id => epochTechIds.has(id)).length
}

/**
 * Determine which techs a player can research next.
 *
 * A tech is available if:
 * 1. It has not already been researched
 * 2. All its `requires` prerequisites have been researched
 * 3. Epoch gating: epoch N (where N >= 2) requires >= EPOCH_GATE_THRESHOLD techs
 *    researched from epoch N-1
 * 4. If the tech is factionOnly, the player must belong to that faction
 *
 * Faction branch techs use epoch 0 and are exempt from epoch gating.
 */
export function getAvailableTechs(researched: string[], factionId: FactionId): TechNode[] {
  const researchedSet = new Set(researched)

  return Object.values(TECH_TREE).filter((tech) => {
    // Already researched
    if (researchedSet.has(tech.id)) {
      return false
    }

    // Faction restriction
    if (tech.factionOnly && tech.factionOnly !== factionId) {
      return false
    }

    // All prerequisites must be met
    if (!tech.requires.every(reqId => researchedSet.has(reqId))) {
      return false
    }

    // Epoch gating for common techs (epoch >= 2)
    if (tech.epoch >= 2) {
      const previousEpochCount = countResearchedInEpoch(researched, tech.epoch - 1)
      if (previousEpochCount < EPOCH_GATE_THRESHOLD) {
        return false
      }
    }

    return true
  })
}
