import type {
  GameState,
  GamePlayer,
  GameSettlement,
  ClientPlayerState,
  FactionId,
  GameSpeed
} from '../../shared/game-types'
import { STARTING_GATHER_RADIUS } from '../../shared/settlement-defs'

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
  const name = SETTLEMENT_NAMES[settlementNameIndex % SETTLEMENT_NAMES.length]!
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
      players: new Map(),
      settlements: new Map()
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
      const fogMap = new Uint8Array(config.mapWidth * config.mapHeight).fill(FOG_UNEXPLORED)

      const player: GamePlayer = {
        userId: playerConfig.userId,
        factionId: playerConfig.factionId,
        fogMap
      }

      state.players.set(playerConfig.userId, player)

      // Create starting settlement (capital)
      const settlement: GameSettlement = {
        id: crypto.randomUUID(),
        ownerId: playerConfig.userId,
        name: nextSettlementName(),
        q: spawnPos.q,
        r: spawnPos.r,
        gatherRadius: STARTING_GATHER_RADIUS,
        isCapital: true
      }
      state.settlements.set(settlement.id, settlement)

      // Reveal fog around settlement
      revealFog(fogMap, config.mapWidth, config.mapHeight, spawnPos.q, spawnPos.r, STARTING_GATHER_RADIUS + 1)
    }

    return new GameStateManager(state)
  }

  /**
   * Returns a fog-of-war filtered view of the game state for a specific player.
   * The player sees their own settlements plus enemy settlements
   * that are on tiles currently visible to them.
   */
  getPlayerView(userId: string): ClientPlayerState {
    const player = this.state.players.get(userId)
    if (!player) {
      throw new Error(`Player ${userId} not found`)
    }

    const fogMap = player.fogMap

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
      factionId: player.factionId,
      paused: this.state.paused,
      speed: this.state.speed,
      visibleSettlements,
      fogMap: Array.from(fogMap)
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
      if (isLandTile(terrain[r * mapWidth + q]!)) {
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

    let best = candidates[0]!
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
  let bestCandidate = candidates[0]!
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
