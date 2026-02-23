import type { GameState, GameUnit, HexCoord } from '../../../shared/game-types'
import { hexDistance } from './combat-system'

// --- Constants ---

/** Terrain value for forest tiles */
const TERRAIN_FOREST = 3

/** Owner IDs for neutral factions */
const NEUTRAL_ANIMAL = 'neutral_animal'
const NEUTRAL_BARBARIAN = 'neutral_barbarian'

/** Animal unit stats */
const ANIMAL_STRENGTH = 3
const ANIMAL_HP = 15
const ANIMAL_VISION = 2
const ANIMAL_MOVE_SPEED = 1

/** Barbarian unit stats */
const BARBARIAN_STRENGTH = 8
const BARBARIAN_HP = 30
const BARBARIAN_VISION = 3
const BARBARIAN_MOVE_SPEED = 1

/** Number of barbarian units spawned per camp */
const BARBARIANS_PER_CAMP = 2

/** Initial animal count range */
const MIN_INITIAL_ANIMALS = 5
const MAX_INITIAL_ANIMALS = 10

/** Initial barbarian camp count range */
const MIN_INITIAL_CAMPS = 2
const MAX_INITIAL_CAMPS = 3

/** Barbarian patrol radius around their camp */
const BARBARIAN_PATROL_RADIUS = 5

/** How often (in ticks) to attempt spawning a new barbarian camp */
const CAMP_SPAWN_INTERVAL = 50

/** Minimum hex distance from any settlement to spawn a new camp */
const CAMP_MIN_SETTLEMENT_DISTANCE = 8

/** Minimum hex distance between barbarian camps */
const CAMP_MIN_CAMP_DISTANCE = 8

/** Maximum total barbarian camps on the map */
const MAX_BARBARIAN_CAMPS = 5

/** Minimum hex distance from player spawns for initial camp placement */
const CAMP_MIN_PLAYER_DISTANCE = 10

// --- Terrain utility ---

function isLandTile(terrainValue: number): boolean {
  return terrainValue !== 0 && terrainValue !== 5
}

// --- ID generation ---

let neutralIdCounter = 0

function nextNeutralId(prefix: string): string {
  return `${prefix}_${++neutralIdCounter}`
}

/** Reset the counter (useful for testing) */
export function resetNeutralIdCounter(): void {
  neutralIdCounter = 0
}

// --- Unit factories ---

function createAnimalUnit(q: number, r: number): GameUnit {
  return {
    id: nextNeutralId('animal'),
    type: 'gatherer',
    ownerId: NEUTRAL_ANIMAL,
    q,
    r,
    hp: ANIMAL_HP,
    maxHp: ANIMAL_HP,
    hunger: 0,
    safety: 100,
    strength: ANIMAL_STRENGTH,
    visionRange: ANIMAL_VISION,
    moveSpeed: ANIMAL_MOVE_SPEED,
    state: 'idle'
  }
}

function createBarbarianUnit(q: number, r: number): GameUnit {
  return {
    id: nextNeutralId('barbarian'),
    type: 'warrior',
    ownerId: NEUTRAL_BARBARIAN,
    q,
    r,
    hp: BARBARIAN_HP,
    maxHp: BARBARIAN_HP,
    hunger: 0,
    safety: 100,
    strength: BARBARIAN_STRENGTH,
    visionRange: BARBARIAN_VISION,
    moveSpeed: BARBARIAN_MOVE_SPEED,
    state: 'idle'
  }
}

// --- Simple seeded random for deterministic spawning ---

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

// --- Core functions ---

/**
 * Called at game init to populate neutral units across the map.
 *
 * Spawns:
 * - 5-10 animal units on forest tiles (terrain=3)
 * - 2-3 barbarian camps on land tiles far from player spawns
 * - 2 barbarian units per camp
 */
export function spawnInitialNeutrals(state: GameState): void {
  const random = seededRandom(state.mapWidth * state.mapHeight + state.tick)

  // Collect player spawn positions (settlement positions)
  const playerPositions: HexCoord[] = []
  for (const settlement of state.settlements.values()) {
    playerPositions.push({ q: settlement.q, r: settlement.r })
  }

  // --- Spawn animals on forest tiles ---

  const forestTiles: HexCoord[] = []
  for (let r = 0; r < state.mapHeight; r++) {
    for (let q = 0; q < state.mapWidth; q++) {
      if (state.terrain[r * state.mapWidth + q]! === TERRAIN_FOREST) {
        forestTiles.push({ q, r })
      }
    }
  }

  const animalCount = Math.min(
    forestTiles.length,
    MIN_INITIAL_ANIMALS + Math.floor(random() * (MAX_INITIAL_ANIMALS - MIN_INITIAL_ANIMALS + 1))
  )

  // Shuffle forest tiles and pick the first N
  for (let i = forestTiles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = forestTiles[i]!
    forestTiles[i] = forestTiles[j]!
    forestTiles[j] = temp
  }

  for (let i = 0; i < animalCount; i++) {
    const tile = forestTiles[i]!
    const animal = createAnimalUnit(tile.q, tile.r)
    state.neutralUnits.set(animal.id, animal)
  }

  // --- Spawn barbarian camps ---

  const campCount = MIN_INITIAL_CAMPS + Math.floor(random() * (MAX_INITIAL_CAMPS - MIN_INITIAL_CAMPS + 1))

  // Collect candidate land tiles far from players
  const campCandidates: HexCoord[] = []
  for (let r = 0; r < state.mapHeight; r++) {
    for (let q = 0; q < state.mapWidth; q++) {
      const idx = r * state.mapWidth + q
      if (!isLandTile(state.terrain[idx]!)) continue

      // Must be far from all player positions
      let farEnough = true
      for (const pos of playerPositions) {
        if (hexDistance(q, r, pos.q, pos.r) < CAMP_MIN_PLAYER_DISTANCE) {
          farEnough = false
          break
        }
      }
      if (farEnough) {
        campCandidates.push({ q, r })
      }
    }
  }

  // Shuffle candidates
  for (let i = campCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = campCandidates[i]!
    campCandidates[i] = campCandidates[j]!
    campCandidates[j] = temp
  }

  let campsPlaced = 0
  for (const candidate of campCandidates) {
    if (campsPlaced >= campCount) break

    // Ensure minimum distance from existing camps
    let tooCloseToExisting = false
    for (const camp of state.barbarianCamps) {
      if (hexDistance(candidate.q, candidate.r, camp.q, camp.r) < CAMP_MIN_CAMP_DISTANCE) {
        tooCloseToExisting = true
        break
      }
    }
    if (tooCloseToExisting) continue

    // Place camp
    state.barbarianCamps.push({ q: candidate.q, r: candidate.r })

    // Spawn barbarian units around the camp
    spawnBarbarianUnitsAtCamp(state, candidate)
    campsPlaced++
  }
}

/**
 * Spawns barbarian units at/around a camp position.
 */
function spawnBarbarianUnitsAtCamp(state: GameState, campPos: HexCoord): void {
  const offsets: HexCoord[] = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: -1, r: 0 },
    { q: 0, r: 1 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: -1, r: 1 }
  ]

  let spawned = 0
  for (const offset of offsets) {
    if (spawned >= BARBARIANS_PER_CAMP) break

    const q = campPos.q + offset.q
    const r = campPos.r + offset.r
    if (q < 0 || q >= state.mapWidth || r < 0 || r >= state.mapHeight) continue

    const idx = r * state.mapWidth + q
    if (!isLandTile(state.terrain[idx]!)) continue

    const barbarian = createBarbarianUnit(q, r)
    state.neutralUnits.set(barbarian.id, barbarian)
    spawned++
  }
}

/**
 * Called each tick to run neutral unit AI.
 *
 * Animals: stay near their spawn (idle). If damaged (hp < maxHp),
 * set state to 'fighting' toward the nearest enemy unit.
 *
 * Barbarians: patrol around their camp (within 5 hex radius).
 * If enemy units/settlements within vision, move toward them to raid.
 */
export function tickNeutrals(state: GameState): void {
  for (const unit of state.neutralUnits.values()) {
    if (unit.ownerId === NEUTRAL_ANIMAL) {
      tickAnimalAI(unit, state)
    } else if (unit.ownerId === NEUTRAL_BARBARIAN) {
      tickBarbarianAI(unit, state)
    }
  }
}

/**
 * Animal AI: passive unless attacked.
 * If hp < maxHp, the animal has been attacked and will fight back
 * by targeting the nearest enemy unit.
 */
function tickAnimalAI(unit: GameUnit, state: GameState): void {
  if (unit.hp < unit.maxHp) {
    // Damaged -- find nearest attacker (any unit within vision)
    const attacker = findNearestEnemy(unit, state)
    if (attacker) {
      unit.state = 'fighting'
      unit.targetQ = attacker.q
      unit.targetR = attacker.r
      return
    }
  }

  // Not attacked, stay idle
  unit.state = 'idle'
  unit.targetQ = undefined
  unit.targetR = undefined
}

/**
 * Barbarian AI: patrol around camp, raid if enemies spotted.
 */
function tickBarbarianAI(unit: GameUnit, state: GameState): void {
  // Check for nearby enemy units or settlements within vision
  const nearestEnemy = findNearestEnemy(unit, state)
  if (nearestEnemy) {
    // Move toward enemy to raid
    const step = stepToward(unit.q, unit.r, nearestEnemy.q, nearestEnemy.r)
    unit.state = 'fighting'
    unit.targetQ = step.q
    unit.targetR = step.r
    return
  }

  // Check for nearby enemy settlements within vision
  const nearestSettlement = findNearestEnemySettlement(unit, state)
  if (nearestSettlement) {
    const step = stepToward(unit.q, unit.r, nearestSettlement.q, nearestSettlement.r)
    unit.state = 'moving'
    unit.targetQ = step.q
    unit.targetR = step.r
    return
  }

  // Patrol around camp
  const camp = findNearestCamp(unit, state)
  if (camp) {
    const distToCamp = hexDistance(unit.q, unit.r, camp.q, camp.r)
    if (distToCamp >= BARBARIAN_PATROL_RADIUS) {
      // Too far from camp, move back
      const step = stepToward(unit.q, unit.r, camp.q, camp.r)
      unit.state = 'moving'
      unit.targetQ = step.q
      unit.targetR = step.r
      return
    }

    // Patrol: pick a random direction within camp radius
    // Move one step in the patrol direction
    const patrolOffsets: HexCoord[] = [
      { q: 1, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 1 }, { q: 0, r: -1 },
      { q: 1, r: -1 }, { q: -1, r: 1 }
    ]

    // Use tick + unit position as a simple pseudo-random selector
    const idx = Math.abs(state.tick + unit.q * 7 + unit.r * 13) % patrolOffsets.length
    const offset = patrolOffsets[idx]!
    const patrolQ = unit.q + offset.q
    const patrolR = unit.r + offset.r

    // Only move if the target is within camp radius and on valid land
    if (
      patrolQ >= 0 && patrolQ < state.mapWidth
      && patrolR >= 0 && patrolR < state.mapHeight
      && hexDistance(patrolQ, patrolR, camp.q, camp.r) <= BARBARIAN_PATROL_RADIUS
      && isLandTile(state.terrain[patrolR * state.mapWidth + patrolQ]!)
    ) {
      unit.state = 'moving'
      unit.targetQ = patrolQ
      unit.targetR = patrolR
      return
    }
  }

  // Fallback: idle
  unit.state = 'idle'
  unit.targetQ = undefined
  unit.targetR = undefined
}

/**
 * Finds the nearest enemy unit (player-owned) within the neutral unit's vision range.
 */
function findNearestEnemy(
  unit: GameUnit,
  state: GameState
): GameUnit | null {
  let best: GameUnit | null = null
  let bestDist = Infinity

  for (const other of state.units.values()) {
    if (other.ownerId === unit.ownerId) continue

    const dist = hexDistance(unit.q, unit.r, other.q, other.r)
    if (dist <= unit.visionRange && dist < bestDist) {
      bestDist = dist
      best = other
    }
  }

  return best
}

/**
 * Finds the nearest enemy settlement within the neutral unit's vision range.
 */
function findNearestEnemySettlement(
  unit: GameUnit,
  state: GameState
): HexCoord | null {
  let best: HexCoord | null = null
  let bestDist = Infinity

  for (const settlement of state.settlements.values()) {
    const dist = hexDistance(unit.q, unit.r, settlement.q, settlement.r)
    if (dist <= unit.visionRange && dist < bestDist) {
      bestDist = dist
      best = { q: settlement.q, r: settlement.r }
    }
  }

  return best
}

/**
 * Finds the nearest barbarian camp to a unit.
 */
function findNearestCamp(
  unit: GameUnit,
  state: GameState
): HexCoord | null {
  let best: HexCoord | null = null
  let bestDist = Infinity

  for (const camp of state.barbarianCamps) {
    const dist = hexDistance(unit.q, unit.r, camp.q, camp.r)
    if (dist < bestDist) {
      bestDist = dist
      best = camp
    }
  }

  return best
}

/**
 * Returns a position one hex step closer to the target from the current position.
 * Simple greedy approach: move in the direction that reduces hex distance most.
 */
function stepToward(fromQ: number, fromR: number, toQ: number, toR: number): HexCoord {
  if (fromQ === toQ && fromR === toR) {
    return { q: fromQ, r: fromR }
  }

  const neighbors: HexCoord[] = [
    { q: fromQ + 1, r: fromR },
    { q: fromQ - 1, r: fromR },
    { q: fromQ, r: fromR + 1 },
    { q: fromQ, r: fromR - 1 },
    { q: fromQ + 1, r: fromR - 1 },
    { q: fromQ - 1, r: fromR + 1 }
  ]

  let bestNeighbor = neighbors[0]!
  let bestDist = hexDistance(neighbors[0]!.q, neighbors[0]!.r, toQ, toR)

  for (let i = 1; i < neighbors.length; i++) {
    const dist = hexDistance(neighbors[i]!.q, neighbors[i]!.r, toQ, toR)
    if (dist < bestDist) {
      bestDist = dist
      bestNeighbor = neighbors[i]!
    }
  }

  return bestNeighbor
}

/**
 * Called periodically to spawn new barbarian camps on unclaimed territory.
 *
 * Every 50 ticks, attempts to spawn a new camp:
 * - On a land tile with no settlement within 8 hex radius
 * - Far from existing camps (at least 8 hex distance)
 * - Max 5 camps total
 */
export function tickBarbarianCamps(state: GameState): void {
  // Only check every CAMP_SPAWN_INTERVAL ticks
  if (state.tick % CAMP_SPAWN_INTERVAL !== 0) return

  // Respect max camps limit
  if (state.barbarianCamps.length >= MAX_BARBARIAN_CAMPS) return

  // Find a suitable location for a new camp
  const newCampPos = findNewCampLocation(state)
  if (!newCampPos) return

  // Place camp and spawn barbarians
  state.barbarianCamps.push(newCampPos)
  spawnBarbarianUnitsAtCamp(state, newCampPos)
}

/**
 * Finds a suitable location for a new barbarian camp.
 * Must be on land, far from settlements and existing camps.
 */
function findNewCampLocation(state: GameState): HexCoord | null {
  let bestCandidate: HexCoord | null = null
  let bestMinDist = -1

  for (let r = 0; r < state.mapHeight; r++) {
    for (let q = 0; q < state.mapWidth; q++) {
      const idx = r * state.mapWidth + q
      if (!isLandTile(state.terrain[idx]!)) continue

      // Check distance from all settlements
      let tooCloseToSettlement = false
      for (const settlement of state.settlements.values()) {
        if (hexDistance(q, r, settlement.q, settlement.r) < CAMP_MIN_SETTLEMENT_DISTANCE) {
          tooCloseToSettlement = true
          break
        }
      }
      if (tooCloseToSettlement) continue

      // Check distance from existing camps
      let tooCloseToCamp = false
      let minCampDist = Infinity
      for (const camp of state.barbarianCamps) {
        const dist = hexDistance(q, r, camp.q, camp.r)
        if (dist < CAMP_MIN_CAMP_DISTANCE) {
          tooCloseToCamp = true
          break
        }
        if (dist < minCampDist) {
          minCampDist = dist
        }
      }
      if (tooCloseToCamp) continue

      // For the first camp (no existing camps), use minimum distance from settlements
      const effectiveMinDist = state.barbarianCamps.length === 0 ? 0 : minCampDist

      // Pick the candidate that maximizes minimum distance from existing camps
      if (effectiveMinDist > bestMinDist) {
        bestMinDist = effectiveMinDist
        bestCandidate = { q, r }
      }
    }
  }

  return bestCandidate
}
