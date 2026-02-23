import type { FactionId, LawNode } from './game-types'

// --- Economy Branch ---

const taxation: LawNode = {
  id: 'taxation',
  name: 'Taxation',
  branch: 'economy',
  cultureCost: 50,
  requires: [],
  effects: [
    { type: 'resource_modifier', target: 'gold', value: 1.2, description: '+20% gold income' },
    { type: 'loyalty_change', target: 'tribune', value: -5, description: '-5 Tribune loyalty' }
  ]
}

const freeTrade: LawNode = {
  id: 'free_trade',
  name: 'Free Trade',
  branch: 'economy',
  cultureCost: 80,
  requires: ['taxation'],
  effects: [
    { type: 'resource_modifier', target: 'gold', value: 1.5, description: 'Trade routes yield x1.5 gold' },
    { type: 'resource_modifier', target: 'production', value: 0.9, description: '-10% production' }
  ]
}

const monopoly: LawNode = {
  id: 'monopoly',
  name: 'Monopoly',
  branch: 'economy',
  cultureCost: 80,
  requires: ['taxation'],
  effects: [
    { type: 'special', description: 'One chosen resource yields x2, all others -10%' }
  ]
}

// --- Military Branch ---

const mobilization: LawNode = {
  id: 'mobilization',
  name: 'Mobilization',
  branch: 'military',
  cultureCost: 60,
  requires: [],
  effects: [
    { type: 'unit_modifier', target: 'cost', value: 0.7, description: 'Units 30% cheaper' },
    { type: 'resource_modifier', target: 'food', value: 0.667, description: 'Food consumption x1.5' }
  ]
}

const defensiveDoctrine: LawNode = {
  id: 'defensive_doctrine',
  name: 'Defensive Doctrine',
  branch: 'military',
  cultureCost: 90,
  requires: ['mobilization'],
  effects: [
    { type: 'settlement_modifier', target: 'defense', value: 1.3, description: '+30% settlement defense' },
    { type: 'special', description: 'Units will not leave territory' }
  ]
}

const martialLaw: LawNode = {
  id: 'martial_law',
  name: 'Martial Law',
  branch: 'military',
  cultureCost: 100,
  requires: ['mobilization'],
  effects: [
    { type: 'resource_modifier', target: 'production', value: 2, description: 'Production x2' },
    { type: 'resource_modifier', target: 'culture', value: 0.5, description: 'Culture -50%' },
    { type: 'resource_modifier', target: 'science', value: 0.5, description: 'Science -50%' }
  ]
}

// --- Society Branch ---

const festivals: LawNode = {
  id: 'festivals',
  name: 'Festivals',
  branch: 'society',
  cultureCost: 40,
  requires: [],
  effects: [
    { type: 'loyalty_change', value: 20, description: '+20 loyalty to all advisors' },
    { type: 'special', description: '-10% production for 500 ticks' }
  ]
}

const education: LawNode = {
  id: 'education',
  name: 'Education',
  branch: 'society',
  cultureCost: 60,
  requires: [],
  effects: [
    { type: 'resource_modifier', target: 'science', value: 1.2, description: '+20% science' },
    { type: 'special', description: 'Buildings cost 15% more' }
  ]
}

const expansionism: LawNode = {
  id: 'expansionism',
  name: 'Expansionism',
  branch: 'society',
  cultureCost: 70,
  requires: [],
  effects: [
    { type: 'special', description: 'Settlers cheaper, new settlements build faster' }
  ]
}

// --- Diplomacy Branch ---

const declareWar: LawNode = {
  id: 'declare_war',
  name: 'Declare War',
  branch: 'diplomacy',
  cultureCost: 30,
  requires: [],
  targetPlayer: true,
  effects: [
    { type: 'diplomacy_change', target: 'war', description: 'Unlocks auto-combat against target player' }
  ]
}

const proposePeace: LawNode = {
  id: 'propose_peace',
  name: 'Propose Peace',
  branch: 'diplomacy',
  cultureCost: 20,
  requires: [],
  targetPlayer: true,
  effects: [
    { type: 'diplomacy_change', target: 'peace', description: 'Ends war with target player' }
  ]
}

const tradeEmbargo: LawNode = {
  id: 'trade_embargo',
  name: 'Trade Embargo',
  branch: 'diplomacy',
  cultureCost: 40,
  requires: [],
  targetPlayer: true,
  effects: [
    { type: 'diplomacy_change', description: 'Blocks trade routes with target player' }
  ]
}

// --- Solar Empire Unique Laws ---

const imperialConscription: LawNode = {
  id: 'imperial_conscription',
  name: 'Imperial Conscription',
  branch: 'faction_unique',
  cultureCost: 80,
  requires: [],
  factionOnly: 'solar_empire',
  effects: [
    { type: 'unit_modifier', target: 'strength', value: 1.1, description: 'All units gain +10% strength' },
    { type: 'resource_modifier', target: 'food', value: 0.77, description: 'Food consumption x1.3' }
  ]
}

const paxSolaris: LawNode = {
  id: 'pax_solaris',
  name: 'Pax Solaris',
  branch: 'faction_unique',
  cultureCost: 120,
  requires: ['imperial_conscription'],
  factionOnly: 'solar_empire',
  effects: [
    { type: 'special', description: 'Captured settlements keep buildings intact' }
  ]
}

const triumph: LawNode = {
  id: 'triumph',
  name: 'Triumph',
  branch: 'faction_unique',
  cultureCost: 150,
  requires: ['pax_solaris'],
  factionOnly: 'solar_empire',
  effects: [
    { type: 'loyalty_change', target: 'general', value: 50, description: '+50 General loyalty after capturing enemy capital' },
    { type: 'special', description: 'All units heal after capturing enemy capital' }
  ]
}

// --- Merchant League Unique Laws ---

const goldStandard: LawNode = {
  id: 'gold_standard',
  name: 'Gold Standard',
  branch: 'faction_unique',
  cultureCost: 80,
  requires: [],
  factionOnly: 'merchant_league',
  effects: [
    { type: 'special', description: 'Gold can substitute any resource (with conversion rate)' }
  ]
}

const bankingHouse: LawNode = {
  id: 'banking_house',
  name: 'Banking House',
  branch: 'faction_unique',
  cultureCost: 120,
  requires: ['gold_standard'],
  factionOnly: 'merchant_league',
  effects: [
    { type: 'special', description: 'Gold generates interest: +5% of stockpile every 100 ticks' }
  ]
}

const tradeLeague: LawNode = {
  id: 'trade_league',
  name: 'Trade League',
  branch: 'faction_unique',
  cultureCost: 150,
  requires: ['gold_standard'],
  factionOnly: 'merchant_league',
  effects: [
    { type: 'special', description: 'Trade routes with other players give bonus to both sides' }
  ]
}

// --- Forest Keepers Unique Laws ---

const lawOfTheForest: LawNode = {
  id: 'law_of_the_forest',
  name: 'Law of the Forest',
  branch: 'faction_unique',
  cultureCost: 80,
  requires: [],
  factionOnly: 'forest_keepers',
  effects: [
    { type: 'special', description: 'Units in forests regenerate health, +20% speed' }
  ]
}

const sanctuary: LawNode = {
  id: 'sanctuary',
  name: 'Sanctuary',
  branch: 'faction_unique',
  cultureCost: 120,
  requires: ['law_of_the_forest'],
  factionOnly: 'forest_keepers',
  effects: [
    { type: 'special', description: '3 tiles around sacred groves invulnerable to enemies' }
  ]
}

const naturesAwakening: LawNode = {
  id: 'natures_awakening',
  name: 'Nature\'s Awakening',
  branch: 'faction_unique',
  cultureCost: 150,
  requires: ['sanctuary'],
  factionOnly: 'forest_keepers',
  effects: [
    { type: 'special', description: 'Neutral animals on your territory become allies' }
  ]
}

// --- The Seekers Unique Laws ---

const academicExchange: LawNode = {
  id: 'academic_exchange',
  name: 'Academic Exchange',
  branch: 'faction_unique',
  cultureCost: 80,
  requires: [],
  factionOnly: 'seekers',
  effects: [
    { type: 'resource_modifier', target: 'science', value: 1.5, description: 'Science x1.5' },
    { type: 'special', description: 'Enemies also gain +10% science' }
  ]
}

const eureka: LawNode = {
  id: 'eureka',
  name: 'Eureka',
  branch: 'faction_unique',
  cultureCost: 120,
  requires: ['academic_exchange'],
  factionOnly: 'seekers',
  effects: [
    { type: 'special', description: 'Every 3rd research completes instantly' }
  ]
}

const greatExperiment: LawNode = {
  id: 'great_experiment',
  name: 'Great Experiment',
  branch: 'faction_unique',
  cultureCost: 150,
  requires: ['eureka'],
  factionOnly: 'seekers',
  effects: [
    { type: 'special', description: 'Can research 2 technologies simultaneously' }
  ]
}

// --- Flat map of all laws ---

export const LAW_TREE: Record<string, LawNode> = {
  // Economy
  taxation,
  free_trade: freeTrade,
  monopoly,
  // Military
  mobilization,
  defensive_doctrine: defensiveDoctrine,
  martial_law: martialLaw,
  // Society
  festivals,
  education,
  expansionism,
  // Diplomacy
  declare_war: declareWar,
  propose_peace: proposePeace,
  trade_embargo: tradeEmbargo,
  // Solar Empire
  imperial_conscription: imperialConscription,
  pax_solaris: paxSolaris,
  triumph,
  // Merchant League
  gold_standard: goldStandard,
  banking_house: bankingHouse,
  trade_league: tradeLeague,
  // Forest Keepers
  law_of_the_forest: lawOfTheForest,
  sanctuary,
  natures_awakening: naturesAwakening,
  // Seekers
  academic_exchange: academicExchange,
  eureka,
  great_experiment: greatExperiment
}

/**
 * Look up a law by its ID. Throws if the law does not exist.
 */
export function getLaw(id: string): LawNode {
  const law = LAW_TREE[id]
  if (!law) {
    throw new Error(`Unknown law ID: ${id}`)
  }
  return law
}

/**
 * Returns all laws a player can currently propose.
 *
 * A law is available if:
 * 1. It has not already been passed.
 * 2. All of its `requires` prerequisites have been passed.
 * 3. If it is faction-only, the player must belong to that faction.
 */
export function getAvailableLaws(passedLaws: string[], factionId: FactionId): LawNode[] {
  const passedSet = new Set(passedLaws)

  return Object.values(LAW_TREE).filter((law) => {
    // Already passed -- skip
    if (passedSet.has(law.id)) return false

    // Faction-only check
    if (law.factionOnly && law.factionOnly !== factionId) return false

    // All prerequisites must be passed
    return law.requires.every(req => passedSet.has(req))
  })
}
