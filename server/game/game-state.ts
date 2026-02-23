import type {
  GameState,
  GamePlayer,
  GameUnit,
  GameSettlement,
  ClientPlayerState,
  FactionId,
  GameSpeed,
  UnitType,
  AdvisorType,
  Resources,
  DiplomacyState
} from '../../shared/game-types'
import { ADVISOR_TYPES } from '../../shared/game-types'
import { getFaction } from '../../shared/faction-defs'
import { getUnitDef } from '../../shared/unit-defs'
import { SETTLEMENT_DEFS } from '../../shared/settlement-defs'

// --- Config for game creation ---

export interface GameCreateConfig {
  gameId: string
  mapWidth: number
  mapHeight: number
  terrain: Uint8Array
  elevation: Uint8Array
  players: { userId: string, factionId: FactionId }[]
  speed: GameSpeed
}

// --- Constants ---

const STARTING_RESOURCES: Resources = {
  food: 50,
  production: 30,
  gold: 30,
  science: 0,
  culture: 0
}

const ZERO_RESOURCES: Resources = {
  food: 0,
  production: 0,
  gold: 0,
  science: 0,
  culture: 0
}

const STARTING_UNITS: UnitType[] = ['scout', 'scout', 'gatherer', 'builder']

const MIN_SPAWN_DISTANCE = 15

/** Terrain values that are valid land for spawning (not water=0 and not mountains=5) */
function isLandTile(terrainValue: number): boolean {
  return terrainValue !== 0 && terrainValue !== 5
}

// --- Fog of war constants ---
const FOG_UNEXPLORED = 0
const FOG_VISIBLE = 2

// --- Settlement naming ---
const SETTLEMENT_NAMES = [
  'Haven', 'Crossroads', 'Hearthstone', 'Riverside', 'Ironhold',
  'Brightwall', 'Ashford', 'Thornfield', 'Dawnbreak', 'Stonewatch',
  'Oakvale', 'Moonrise', 'Windmere', 'Goldcrest', 'Silverpeak',
  'Ravenhollow', 'Sunridge', 'Frostgate', 'Coppermine', 'Greendale'
]

let settlementNameIndex = 0

function nextSettlementName(): string {
  const name = SETTLEMENT_NAMES[settlementNameIndex % SETTLEMENT_NAMES.length]
  settlementNameIndex++
  return name
}

// --- GameStateManager ---

export class GameStateManager {
  readonly state: GameState

  private constructor(state: GameState) {
    this.state = state
  }

  static create(config: GameCreateConfig): GameStateManager {
    // Reset name index for deterministic naming within a game
    settlementNameIndex = 0

    const state: GameState = {
      gameId: config.gameId,
      tick: 0,
      speed: config.speed,
      paused: false,
      mapWidth: config.mapWidth,
      mapHeight: config.mapHeight,
      terrain: config.terrain,
      elevation: config.elevation,
      improvements: new Map(),
      players: new Map(),
      units: new Map(),
      settlements: new Map(),
      diplomacy: [],
      neutralUnits: new Map(),
      barbarianCamps: []
    }

    // Find spawn positions for all players
    const spawnPositions: { q: number, r: number }[] = []

    for (const playerConfig of config.players) {
      const spawnPos = findSpawnPosition(
        config.terrain,
        config.mapWidth,
        config.mapHeight,
        spawnPositions
      )
      spawnPositions.push(spawnPos)

      // Create the player state
      const faction = getFaction(playerConfig.factionId)
      const fogMap = new Uint8Array(config.mapWidth * config.mapHeight).fill(FOG_UNEXPLORED)

      const advisors = ADVISOR_TYPES.map((type: AdvisorType) => ({
        type,
        loyalty: faction.startingAdvisorLoyalty[type]
      }))

      const player: GamePlayer = {
        userId: playerConfig.userId,
        factionId: playerConfig.factionId,
        resources: { ...STARTING_RESOURCES },
        resourceIncome: { ...ZERO_RESOURCES },
        resourceUpkeep: { ...ZERO_RESOURCES },
        policies: {
          aggression: 50,
          expansion: 50,
          spending: 50,
          combatPolicy: 'defensive'
        },
        advisors,
        researchedTechs: [],
        currentResearch: null,
        researchProgress: 0,
        passedLaws: [],
        eliminated: false,
        fogMap
      }

      state.players.set(playerConfig.userId, player)

      // Create starting settlement (capital)
      const outpostDef = SETTLEMENT_DEFS.outpost
      const settlement: GameSettlement = {
        id: crypto.randomUUID(),
        ownerId: playerConfig.userId,
        name: nextSettlementName(),
        tier: 'outpost',
        q: spawnPos.q,
        r: spawnPos.r,
        buildings: [],
        buildingSlots: outpostDef.buildingSlots,
        gatherRadius: outpostDef.gatherRadius,
        isCapital: true,
        hp: outpostDef.maxHp,
        maxHp: outpostDef.maxHp,
        defense: outpostDef.baseDefense
      }
      state.settlements.set(settlement.id, settlement)

      // Reveal fog around settlement
      revealFog(fogMap, config.mapWidth, config.mapHeight, spawnPos.q, spawnPos.r, outpostDef.gatherRadius + 1)

      // Create starting units around spawn position
      const unitOffsets = [
        { dq: 1, dr: 0 },
        { dq: -1, dr: 0 },
        { dq: 0, dr: 1 },
        { dq: 0, dr: -1 }
      ]

      for (let i = 0; i < STARTING_UNITS.length; i++) {
        const unitType = STARTING_UNITS[i]
        const unitDef = getUnitDef(unitType)
        const offset = unitOffsets[i % unitOffsets.length]
        const unitQ = spawnPos.q + offset.dq
        const unitR = spawnPos.r + offset.dr

        const unit: GameUnit = {
          id: crypto.randomUUID(),
          type: unitType,
          ownerId: playerConfig.userId,
          q: unitQ,
          r: unitR,
          hp: unitDef.maxHp,
          maxHp: unitDef.maxHp,
          hunger: 0,
          safety: 100,
          strength: unitDef.strength,
          visionRange: unitDef.visionRange,
          moveSpeed: unitDef.moveSpeed,
          state: 'idle'
        }

        state.units.set(unit.id, unit)

        // Reveal fog around each unit
        revealFog(fogMap, config.mapWidth, config.mapHeight, unitQ, unitR, unitDef.visionRange)
      }
    }

    // Initialize diplomacy between all player pairs
    const playerIds = config.players.map(p => p.userId)
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const diplomacy: DiplomacyState = {
          player1Id: playerIds[i],
          player2Id: playerIds[j],
          status: 'peace'
        }
        state.diplomacy.push(diplomacy)
      }
    }

    return new GameStateManager(state)
  }

  /**
   * Returns a fog-of-war filtered view of the game state for a specific player.
   * The player sees their own units/settlements plus enemy units/settlements
   * that are on tiles currently visible to them.
   */
  getPlayerView(userId: string): ClientPlayerState {
    const player = this.state.players.get(userId)
    if (!player) {
      throw new Error(`Player ${userId} not found`)
    }

    const fogMap = player.fogMap

    // Collect all visible units: own units always visible + enemy units on visible tiles
    const visibleUnits: GameUnit[] = []
    for (const unit of this.state.units.values()) {
      if (unit.ownerId === userId) {
        visibleUnits.push(unit)
      } else {
        const tileIndex = unit.r * this.state.mapWidth + unit.q
        if (tileIndex >= 0 && tileIndex < fogMap.length && fogMap[tileIndex] === FOG_VISIBLE) {
          visibleUnits.push(unit)
        }
      }
    }

    // Collect all visible settlements: own settlements always visible + enemy on visible tiles
    const visibleSettlements: GameSettlement[] = []
    for (const settlement of this.state.settlements.values()) {
      if (settlement.ownerId === userId) {
        visibleSettlements.push(settlement)
      } else {
        const tileIndex = settlement.r * this.state.mapWidth + settlement.q
        if (tileIndex >= 0 && tileIndex < fogMap.length && fogMap[tileIndex] === FOG_VISIBLE) {
          visibleSettlements.push(settlement)
        }
      }
    }

    return {
      tick: this.state.tick,
      resources: player.resources,
      resourceIncome: player.resourceIncome,
      resourceUpkeep: player.resourceUpkeep,
      policies: player.policies,
      advisors: player.advisors,
      currentResearch: player.currentResearch,
      researchProgress: player.researchProgress,
      researchedTechs: player.researchedTechs,
      passedLaws: player.passedLaws,
      visibleUnits,
      visibleSettlements,
      fogMap: Array.from(fogMap),
      diplomacy: this.state.diplomacy
    }
  }
}

// --- Standalone utility functions ---

/**
 * Finds a valid spawn position on land, far from existing spawn positions.
 * Iterates candidate positions and picks the one with the greatest minimum
 * distance from all existing positions.
 */
function findSpawnPosition(
  terrain: Uint8Array,
  mapWidth: number,
  mapHeight: number,
  existingPositions: { q: number, r: number }[]
): { q: number, r: number } {
  // Collect all valid land tiles
  const candidates: { q: number, r: number }[] = []
  for (let r = 2; r < mapHeight - 2; r++) {
    for (let q = 2; q < mapWidth - 2; q++) {
      if (isLandTile(terrain[r * mapWidth + q])) {
        candidates.push({ q, r })
      }
    }
  }

  if (candidates.length === 0) {
    // Fallback: center of map
    return { q: Math.floor(mapWidth / 2), r: Math.floor(mapHeight / 2) }
  }

  if (existingPositions.length === 0) {
    // First player: pick a position away from edges (roughly 1/4 into the map)
    const targetQ = Math.floor(mapWidth / 4)
    const targetR = Math.floor(mapHeight / 4)

    let best = candidates[0]
    let bestDist = Infinity

    for (const c of candidates) {
      const dist = Math.sqrt((c.q - targetQ) ** 2 + (c.r - targetR) ** 2)
      if (dist < bestDist) {
        bestDist = dist
        best = c
      }
    }

    return best
  }

  // For subsequent players: maximize minimum distance from all existing positions
  let bestCandidate = candidates[0]
  let bestMinDist = -1

  for (const c of candidates) {
    let minDist = Infinity
    for (const existing of existingPositions) {
      const dist = Math.sqrt((c.q - existing.q) ** 2 + (c.r - existing.r) ** 2)
      if (dist < minDist) {
        minDist = dist
      }
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist
      bestCandidate = c
    }
  }

  // If best distance is still below minimum, warn but continue (small maps)
  if (bestMinDist < MIN_SPAWN_DISTANCE) {
    // On small maps we may not be able to satisfy the minimum distance
    // but we still pick the best available position
  }

  return bestCandidate
}

/**
 * Reveals fog of war tiles within a given radius around a position.
 * Sets tiles to FOG_VISIBLE (2).
 */
function revealFog(
  fogMap: Uint8Array,
  mapWidth: number,
  mapHeight: number,
  centerQ: number,
  centerR: number,
  radius: number
): void {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dq = -radius; dq <= radius; dq++) {
      // Use simple distance check for vision range
      if (Math.sqrt(dq * dq + dr * dr) <= radius) {
        const q = centerQ + dq
        const r = centerR + dr
        if (q >= 0 && q < mapWidth && r >= 0 && r < mapHeight) {
          fogMap[r * mapWidth + q] = FOG_VISIBLE
        }
      }
    }
  }
}
