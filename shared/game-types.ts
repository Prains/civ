// --- Factions ---
export const FACTION_IDS = ['solar_empire', 'merchant_league', 'forest_keepers', 'seekers'] as const
export type FactionId = typeof FACTION_IDS[number]
export function isValidFactionId(id: string): id is FactionId {
  return (FACTION_IDS as readonly string[]).includes(id)
}

// --- Resources ---
export const RESOURCE_TYPES = ['food', 'production', 'gold', 'science', 'culture'] as const
export type ResourceType = typeof RESOURCE_TYPES[number]
export function isValidResourceType(r: string): r is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(r)
}
export type Resources = Record<ResourceType, number>

// --- Units ---
export const UNIT_TYPES = ['scout', 'gatherer', 'warrior', 'settler', 'builder'] as const
export type UnitType = typeof UNIT_TYPES[number]
export function isValidUnitType(t: string): t is UnitType {
  return (UNIT_TYPES as readonly string[]).includes(t)
}

// --- Settlement ---
export const SETTLEMENT_TIERS = ['outpost', 'settlement', 'city'] as const
export type SettlementTier = typeof SETTLEMENT_TIERS[number]

// --- Diplomacy ---
export const DIPLOMATIC_STATUSES = ['peace', 'tension', 'war'] as const
export type DiplomaticStatus = typeof DIPLOMATIC_STATUSES[number]

// --- Combat policies ---
export const COMBAT_POLICIES = ['aggressive', 'defensive', 'avoidance'] as const
export type CombatPolicy = typeof COMBAT_POLICIES[number]

// --- Player policies (sliders 0-100) ---
export interface PlayerPolicies {
  aggression: number // 0 = full defense, 100 = full aggression
  expansion: number // 0 = consolidation, 100 = expansion
  spending: number // 0 = accumulate, 100 = spend freely
  combatPolicy: CombatPolicy
}

// --- Advisor types ---
export const ADVISOR_TYPES = ['general', 'treasurer', 'priest', 'scholar', 'tribune'] as const
export type AdvisorType = typeof ADVISOR_TYPES[number]

// --- Fog of war tile states ---
export const FOG_STATES = ['unexplored', 'explored', 'visible'] as const
export type FogState = typeof FOG_STATES[number]

// --- Hex coordinate ---
export interface HexCoord {
  q: number
  r: number
}

// --- Game speed ---
export const GAME_SPEEDS = [0.5, 1, 2, 3] as const
export type GameSpeed = typeof GAME_SPEEDS[number]

// --- Unit state (server-side, full) ---
export interface GameUnit {
  id: string
  type: UnitType
  ownerId: string
  q: number
  r: number
  hp: number
  maxHp: number
  hunger: number // 0-100
  safety: number // 0-100
  strength: number
  visionRange: number
  moveSpeed: number // tiles per tick
  state: 'idle' | 'moving' | 'gathering' | 'building' | 'fighting' | 'returning'
  targetQ?: number
  targetR?: number
  carryingResource?: ResourceType
  carryingAmount?: number
}

// --- Settlement state ---
export interface GameSettlement {
  id: string
  ownerId: string
  name: string
  tier: SettlementTier
  q: number
  r: number
  buildings: BuildingType[]
  buildingSlots: number
  gatherRadius: number
  isCapital: boolean
  hp: number
  maxHp: number
  defense: number
}

// --- Buildings ---
export const BUILDING_TYPES = ['farm', 'lumber_mill', 'market', 'library', 'temple', 'barracks', 'walls'] as const
export type BuildingType = typeof BUILDING_TYPES[number]

// --- Tile improvement ---
export const IMPROVEMENT_TYPES = ['road', 'farm_improvement', 'mine'] as const
export type ImprovementType = typeof IMPROVEMENT_TYPES[number]

// --- Technology ---
export interface TechNode {
  id: string
  name: string
  epoch: number
  scienceCost: number
  requires: string[] // tech IDs that must be researched first
  factionOnly?: FactionId // if set, only this faction can research it
  effects: TechEffect[]
}

export interface TechEffect {
  type: 'unlock_building' | 'unlock_unit' | 'modifier' | 'unlock_improvement' | 'victory_progress'
  target?: string
  value?: number
}

// --- Law ---
export interface LawNode {
  id: string
  name: string
  branch: 'economy' | 'military' | 'society' | 'diplomacy' | 'faction_unique'
  cultureCost: number
  requires: string[] // law IDs that must be passed first
  factionOnly?: FactionId
  effects: LawEffect[]
  targetPlayer?: boolean // true if law targets a specific player (e.g., declare war)
}

export interface LawEffect {
  type: 'resource_modifier' | 'unit_modifier' | 'settlement_modifier' | 'diplomacy_change' | 'loyalty_change' | 'special'
  target?: string
  value?: number
  description: string
}

// --- Advisor ---
export interface Advisor {
  type: AdvisorType
  loyalty: number // 0-100
}

// --- Player game state ---
export interface GamePlayer {
  userId: string
  factionId: FactionId
  resources: Resources
  resourceIncome: Resources // per-tick income
  resourceUpkeep: Resources // per-tick costs
  policies: PlayerPolicies
  advisors: Advisor[]
  researchedTechs: string[]
  currentResearch: string | null
  researchProgress: number // accumulated science toward current tech
  passedLaws: string[]
  eliminated: boolean
  fogMap: Uint8Array // per-tile fog state (0=unexplored, 1=explored, 2=visible)
}

// --- Diplomacy between two players ---
export interface DiplomacyState {
  player1Id: string
  player2Id: string
  status: DiplomaticStatus
}

// --- Full game state (server-side) ---
export interface GameState {
  gameId: string
  tick: number
  speed: GameSpeed
  paused: boolean
  mapWidth: number
  mapHeight: number
  terrain: Uint8Array
  elevation: Uint8Array
  improvements: Map<string, ImprovementType> // "q,r" -> type
  players: Map<string, GamePlayer>
  units: Map<string, GameUnit>
  settlements: Map<string, GameSettlement>
  diplomacy: DiplomacyState[]
  neutralUnits: Map<string, GameUnit> // animals, barbarians
  barbarianCamps: HexCoord[]
}

// --- Events sent to client via SSE ---
export type GameEvent
  = { type: 'tick', tick: number, playerState: ClientPlayerState }
    | { type: 'unitMoved', unitId: string, fromQ: number, fromR: number, toQ: number, toR: number }
    | { type: 'combatResult', attackerId: string, defenderId: string, damage: number, killed: boolean }
    | { type: 'settlementFounded', settlement: GameSettlement }
    | { type: 'buildingCompleted', settlementId: string, building: BuildingType }
    | { type: 'techResearched', techId: string, playerId: string }
    | { type: 'lawPassed', lawId: string, playerId: string }
    | { type: 'lawRejected', lawId: string, playerId: string, votes: AdvisorVote[] }
    | { type: 'warDeclared', attackerId: string, defenderId: string }
    | { type: 'peaceDeclared', player1Id: string, player2Id: string }
    | { type: 'playerEliminated', playerId: string }
    | { type: 'victory', winnerId: string, victoryType: string }
    | { type: 'paused', byPlayerId: string }
    | { type: 'resumed' }
    | { type: 'mapReady', mapData: { width: number, height: number, terrain: number[], elevation: number[] } }

export interface AdvisorVote {
  advisor: AdvisorType
  vote: 'yes' | 'no'
  reason: string
}

// --- Client-side view (filtered by fog) ---
export interface ClientPlayerState {
  tick: number
  resources: Resources
  resourceIncome: Resources
  resourceUpkeep: Resources
  policies: PlayerPolicies
  advisors: Advisor[]
  currentResearch: string | null
  researchProgress: number
  researchedTechs: string[]
  passedLaws: string[]
  visibleUnits: GameUnit[] // own + visible enemy units
  visibleSettlements: GameSettlement[]
  fogMap: number[] // flattened Uint8Array
  diplomacy: DiplomacyState[]
}
