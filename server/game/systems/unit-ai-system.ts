import type { GameState, GameUnit, GamePlayer, ImprovementType } from '../../../shared/game-types'
import type { FactionDef } from '../../../shared/faction-defs'
import { getFaction } from '../../../shared/faction-defs'
import { hexDistance } from './combat-system'

export type UnitAction
  = | { type: 'idle' }
    | { type: 'return_to_base', targetQ: number, targetR: number }
    | { type: 'retreat', targetQ: number, targetR: number }
    | { type: 'explore', targetQ: number, targetR: number }
    | { type: 'gather', targetQ: number, targetR: number }
    | { type: 'patrol', targetQ: number, targetR: number }
    | { type: 'attack', targetQ: number, targetR: number }
    | { type: 'settle', targetQ: number, targetR: number }
    | { type: 'build', targetQ: number, targetR: number }

/** Terrain values that are valid for resource gathering (forest=3) */
const RESOURCE_TERRAIN: Set<number> = new Set([3])

/** Terrain values that count as land (not water=0 and not mountain=5) */
function isLandTile(terrainValue: number): boolean {
  return terrainValue !== 0 && terrainValue !== 5
}

/** Minimum hex distance from all existing settlements for a new settle location */
const MIN_SETTLE_DISTANCE = 5

/**
 * Hunger threshold above which a unit will return to base.
 */
const HUNGER_THRESHOLD = 80

/**
 * Increases a unit's hunger by 1 each tick, capped at 100.
 */
export function updateHunger(unit: GameUnit): void {
  unit.hunger = Math.min(100, unit.hunger + 1)
}

/**
 * Updates a unit's safety value based on nearby enemy presence.
 *
 * Safety = 100 - (sum of threat values from enemies within vision range).
 * Each enemy contributes: (enemy.strength / unit.strength or 1) * 20, scaled by proximity.
 * Neutral units are always considered threats.
 */
export function updateSafety(unit: GameUnit, state: GameState): void {
  let threatTotal = 0
  const unitStrength = Math.max(1, unit.strength)

  const checkUnit = (other: GameUnit) => {
    if (other.id === unit.id) return
    if (other.ownerId === unit.ownerId) return

    const dist = hexDistance(unit.q, unit.r, other.q, other.r)
    if (dist > unit.visionRange) return

    // Check if this unit is hostile (neutral or at war)
    const isNeutral = !state.players.has(other.ownerId)
    let isHostile = isNeutral

    if (!isNeutral) {
      const diplo = state.diplomacy.find(
        d =>
          (d.player1Id === unit.ownerId && d.player2Id === other.ownerId)
          || (d.player1Id === other.ownerId && d.player2Id === unit.ownerId)
      )
      // No diplomacy entry between two players means neutral relationship (not hostile)
      // Only count as hostile if at war or truly neutral (no player entry)
      isHostile = diplo ? diplo.status === 'war' : false
    }

    if (!isHostile) return

    // Closer enemies are more threatening; distance factor: (visionRange - dist + 1) / visionRange
    const proximityFactor = (unit.visionRange - dist + 1) / unit.visionRange
    const strengthRatio = other.strength / unitStrength
    threatTotal += strengthRatio * 20 * proximityFactor
  }

  // Check player-owned units
  for (const other of state.units.values()) {
    checkUnit(other)
  }

  // Check neutral units (barbarians, animals)
  for (const other of state.neutralUnits.values()) {
    checkUnit(other)
  }

  unit.safety = Math.max(0, Math.min(100, Math.round(100 - threatTotal)))
}

/**
 * Calculates the effective safety threshold for a unit based on
 * faction AI modifiers and player aggression policy.
 *
 * Formula: 20 * faction.aiModifiers.safety * (1 - player.policies.aggression / 200)
 *
 * High aggression lowers the threshold (unit tolerates more danger).
 * High faction safety modifier raises the threshold (unit is more cautious).
 */
function safetyThreshold(faction: FactionDef, player: GamePlayer): number {
  return 20 * faction.aiModifiers.safety * (1 - player.policies.aggression / 200)
}

/**
 * Finds the nearest own settlement to a unit.
 */
function findNearestSettlement(
  unit: GameUnit,
  state: GameState
): { q: number, r: number } | null {
  let bestDist = Infinity
  let bestPos: { q: number, r: number } | null = null

  for (const settlement of state.settlements.values()) {
    if (settlement.ownerId !== unit.ownerId) continue
    const dist = hexDistance(unit.q, unit.r, settlement.q, settlement.r)
    if (dist < bestDist) {
      bestDist = dist
      bestPos = { q: settlement.q, r: settlement.r }
    }
  }

  return bestPos
}

/**
 * Finds visible enemy units within the unit's vision range.
 */
function findVisibleEnemies(unit: GameUnit, state: GameState): GameUnit[] {
  const enemies: GameUnit[] = []

  const checkUnit = (other: GameUnit) => {
    if (other.id === unit.id) return
    if (other.ownerId === unit.ownerId) return
    if (other.strength === 0) return

    const dist = hexDistance(unit.q, unit.r, other.q, other.r)
    if (dist > unit.visionRange) return

    // Check hostility
    const isNeutral = !state.players.has(other.ownerId)
    if (isNeutral) {
      enemies.push(other)
      return
    }

    const diplo = state.diplomacy.find(
      d =>
        (d.player1Id === unit.ownerId && d.player2Id === other.ownerId)
        || (d.player1Id === other.ownerId && d.player2Id === unit.ownerId)
    )
    if (diplo && diplo.status === 'war') {
      enemies.push(other)
    }
  }

  for (const other of state.units.values()) {
    checkUnit(other)
  }
  for (const other of state.neutralUnits.values()) {
    checkUnit(other)
  }

  return enemies
}

/**
 * Computes a retreat position: move away from the average enemy position.
 * Clamps to map boundaries.
 */
function computeRetreatTarget(
  unit: GameUnit,
  enemies: GameUnit[],
  state: GameState
): { q: number, r: number } {
  if (enemies.length === 0) {
    return { q: unit.q, r: unit.r }
  }

  // Average enemy position
  let avgQ = 0
  let avgR = 0
  for (const e of enemies) {
    avgQ += e.q
    avgR += e.r
  }
  avgQ /= enemies.length
  avgR /= enemies.length

  // Direction away from enemies
  const dq = unit.q - avgQ
  const dr = unit.r - avgR

  // Normalize and scale by moveSpeed
  const len = Math.max(1, Math.sqrt(dq * dq + dr * dr))
  const moveQ = Math.round(unit.q + (dq / len) * unit.moveSpeed)
  const moveR = Math.round(unit.r + (dr / len) * unit.moveSpeed)

  // Clamp to map boundaries
  const targetQ = Math.max(0, Math.min(state.mapWidth - 1, moveQ))
  const targetR = Math.max(0, Math.min(state.mapHeight - 1, moveR))

  return { q: targetQ, r: targetR }
}

/**
 * Finds the nearest unexplored tile in the player's fog map.
 */
function findNearestUnexplored(
  unit: GameUnit,
  player: GamePlayer,
  state: GameState
): { q: number, r: number } | null {
  let bestDist = Infinity
  let bestPos: { q: number, r: number } | null = null

  for (let r = 0; r < state.mapHeight; r++) {
    for (let q = 0; q < state.mapWidth; q++) {
      if (player.fogMap[r * state.mapWidth + q]! === 0) {
        const dist = hexDistance(unit.q, unit.r, q, r)
        if (dist < bestDist) {
          bestDist = dist
          bestPos = { q, r }
        }
      }
    }
  }

  return bestPos
}

/**
 * Finds the nearest resource tile within gather radius of any owned settlement.
 * Resource tiles are forest (terrain=3) tiles.
 */
function findNearestResourceTile(
  unit: GameUnit,
  state: GameState
): { q: number, r: number } | null {
  let bestDist = Infinity
  let bestPos: { q: number, r: number } | null = null

  for (const settlement of state.settlements.values()) {
    if (settlement.ownerId !== unit.ownerId) continue

    const radius = settlement.gatherRadius
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dq = -radius; dq <= radius; dq++) {
        if (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) > 2 * radius) continue
        const tq = settlement.q + dq
        const tr = settlement.r + dr
        if (tq < 0 || tq >= state.mapWidth || tr < 0 || tr >= state.mapHeight) continue

        const terrainIdx = tr * state.mapWidth + tq
        if (RESOURCE_TERRAIN.has(state.terrain[terrainIdx]!)) {
          const dist = hexDistance(unit.q, unit.r, tq, tr)
          if (dist < bestDist) {
            bestDist = dist
            bestPos = { q: tq, r: tr }
          }
        }
      }
    }
  }

  // If no resource terrain, fall back to any non-settlement tile near a settlement
  if (!bestPos) {
    for (const settlement of state.settlements.values()) {
      if (settlement.ownerId !== unit.ownerId) continue

      const radius = settlement.gatherRadius
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dq = -radius; dq <= radius; dq++) {
          if (dq === 0 && dr === 0) continue
          if (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) > 2 * radius) continue
          const tq = settlement.q + dq
          const tr = settlement.r + dr
          if (tq < 0 || tq >= state.mapWidth || tr < 0 || tr >= state.mapHeight) continue

          const terrainIdx = tr * state.mapWidth + tq
          if (isLandTile(state.terrain[terrainIdx]!)) {
            const dist = hexDistance(unit.q, unit.r, tq, tr)
            if (dist < bestDist) {
              bestDist = dist
              bestPos = { q: tq, r: tr }
            }
          }
        }
      }
    }
  }

  return bestPos
}

/**
 * Finds a patrol target around owned settlements.
 * Picks a tile at the edge of gather radius of the nearest settlement.
 */
function findPatrolTarget(
  unit: GameUnit,
  state: GameState
): { q: number, r: number } | null {
  const nearestSettlement = findNearestSettlement(unit, state)
  if (!nearestSettlement) return null

  const radius = 3 // patrol radius around settlement
  let bestPos: { q: number, r: number } | null = null
  let bestDist = Infinity

  // Find a tile at approximately patrol radius from settlement
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dq = -radius; dq <= radius; dq++) {
      const tileHexDist = hexDistance(0, 0, dq, dr)
      if (tileHexDist < radius - 1 || tileHexDist > radius) continue

      const tq = nearestSettlement.q + dq
      const tr = nearestSettlement.r + dr
      if (tq < 0 || tq >= state.mapWidth || tr < 0 || tr >= state.mapHeight) continue

      const terrainIdx = tr * state.mapWidth + tq
      if (!isLandTile(state.terrain[terrainIdx]!)) continue

      const dist = hexDistance(unit.q, unit.r, tq, tr)
      if (dist < bestDist && dist > 0) {
        bestDist = dist
        bestPos = { q: tq, r: tr }
      }
    }
  }

  return bestPos
}

/**
 * Finds a suitable settlement location: a land tile at least MIN_SETTLE_DISTANCE
 * from all existing settlements.
 */
function findSettleLocation(
  unit: GameUnit,
  state: GameState
): { q: number, r: number } | null {
  let bestDist = Infinity
  let bestPos: { q: number, r: number } | null = null

  const allSettlements = [...state.settlements.values()]

  for (let r = 0; r < state.mapHeight; r++) {
    for (let q = 0; q < state.mapWidth; q++) {
      const terrainIdx = r * state.mapWidth + q
      if (!isLandTile(state.terrain[terrainIdx]!)) continue

      // Check distance from all existing settlements
      let tooClose = false
      for (const s of allSettlements) {
        if (hexDistance(q, r, s.q, s.r) < MIN_SETTLE_DISTANCE) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue

      // Pick the closest valid location to the unit
      const dist = hexDistance(unit.q, unit.r, q, r)
      if (dist < bestDist) {
        bestDist = dist
        bestPos = { q, r }
      }
    }
  }

  return bestPos
}

/**
 * Finds a tile near an owned settlement where the builder can build improvements.
 */
function findBuildTarget(
  unit: GameUnit,
  state: GameState
): { q: number, r: number } | null {
  let bestDist = Infinity
  let bestPos: { q: number, r: number } | null = null

  for (const settlement of state.settlements.values()) {
    if (settlement.ownerId !== unit.ownerId) continue

    const radius = settlement.gatherRadius
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dq = -radius; dq <= radius; dq++) {
        if (dq === 0 && dr === 0) continue
        const tileHexDist = hexDistance(0, 0, dq, dr)
        if (tileHexDist > radius) continue

        const tq = settlement.q + dq
        const tr = settlement.r + dr
        if (tq < 0 || tq >= state.mapWidth || tr < 0 || tr >= state.mapHeight) continue

        const terrainIdx = tr * state.mapWidth + tq
        if (!isLandTile(state.terrain[terrainIdx]!)) continue

        // Check if tile already has an improvement
        const key = `${tq},${tr}`
        if (state.improvements.has(key)) continue

        const dist = hexDistance(unit.q, unit.r, tq, tr)
        if (dist < bestDist) {
          bestDist = dist
          bestPos = { q: tq, r: tr }
        }
      }
    }
  }

  return bestPos
}

/**
 * Determines the appropriate improvement type for a tile based on its terrain.
 * - Forest (terrain=3) -> farm_improvement (clear forest, +food)
 * - Hills (terrain=2) -> mine (+production)
 * - Any other land terrain -> road (+movement speed)
 */
function getImprovementForTerrain(terrainValue: number): ImprovementType {
  if (terrainValue === 3) return 'farm_improvement'
  if (terrainValue === 2) return 'mine'
  return 'road'
}

/**
 * Processes builder units that are in the 'building' state and at their target tile.
 * Creates the appropriate improvement based on terrain and sets the builder back to idle.
 * Each improvement takes 1 tick to build (simplified).
 * Does not overwrite existing improvements.
 */
export function tickBuilderImprovements(state: GameState): void {
  for (const unit of state.units.values()) {
    if (unit.type !== 'builder') continue
    if (unit.state !== 'building') continue
    if (unit.targetQ === undefined || unit.targetR === undefined) continue

    // Check if builder has arrived at the target tile
    if (unit.q !== unit.targetQ || unit.r !== unit.targetR) continue

    const key = `${unit.q},${unit.r}`

    // Do not overwrite existing improvements
    if (state.improvements.has(key)) {
      unit.state = 'idle'
      unit.targetQ = undefined
      unit.targetR = undefined
      continue
    }

    // Determine improvement type based on terrain
    const terrainIdx = unit.r * state.mapWidth + unit.q
    const terrainValue = state.terrain[terrainIdx]!
    const improvement = getImprovementForTerrain(terrainValue)

    // Place the improvement
    state.improvements.set(key, improvement)

    // Set builder back to idle
    unit.state = 'idle'
    unit.targetQ = undefined
    unit.targetR = undefined
  }
}

/**
 * Main decision function. Evaluates a unit's needs and returns the best action.
 *
 * Priority:
 * 1. If hunger > 80 -> return_to_base
 * 2. If safety < safetyThreshold -> retreat
 * 3. Otherwise -> type-specific behavior
 */
export function decideAction(
  unit: GameUnit,
  player: GamePlayer,
  faction: FactionDef,
  state: GameState
): UnitAction {
  // Priority 1: hunger
  if (unit.hunger > HUNGER_THRESHOLD) {
    const base = findNearestSettlement(unit, state)
    if (base) {
      return { type: 'return_to_base', targetQ: base.q, targetR: base.r }
    }
    return { type: 'idle' }
  }

  // Priority 2: safety
  const threshold = safetyThreshold(faction, player)
  if (unit.safety < threshold) {
    const enemies = findVisibleEnemies(unit, state)
    const retreatPos = computeRetreatTarget(unit, enemies, state)
    if (retreatPos.q !== unit.q || retreatPos.r !== unit.r) {
      return { type: 'retreat', targetQ: retreatPos.q, targetR: retreatPos.r }
    }
    return { type: 'idle' }
  }

  // Priority 3: type-specific behavior
  switch (unit.type) {
    case 'scout': {
      const unexplored = findNearestUnexplored(unit, player, state)
      if (unexplored) {
        return { type: 'explore', targetQ: unexplored.q, targetR: unexplored.r }
      }
      return { type: 'idle' }
    }

    case 'gatherer': {
      const resource = findNearestResourceTile(unit, state)
      if (resource) {
        return { type: 'gather', targetQ: resource.q, targetR: resource.r }
      }
      return { type: 'idle' }
    }

    case 'warrior': {
      // If enemies visible, attack the closest one
      const enemies = findVisibleEnemies(unit, state)
      if (enemies.length > 0) {
        let closestEnemy = enemies[0]!
        let closestDist = hexDistance(unit.q, unit.r, enemies[0]!.q, enemies[0]!.r)
        for (let i = 1; i < enemies.length; i++) {
          const d = hexDistance(unit.q, unit.r, enemies[i]!.q, enemies[i]!.r)
          if (d < closestDist) {
            closestDist = d
            closestEnemy = enemies[i]!
          }
        }
        return { type: 'attack', targetQ: closestEnemy.q, targetR: closestEnemy.r }
      }

      // Otherwise patrol
      const patrolTarget = findPatrolTarget(unit, state)
      if (patrolTarget) {
        return { type: 'patrol', targetQ: patrolTarget.q, targetR: patrolTarget.r }
      }
      return { type: 'idle' }
    }

    case 'settler': {
      const settleLocation = findSettleLocation(unit, state)
      if (settleLocation) {
        return { type: 'settle', targetQ: settleLocation.q, targetR: settleLocation.r }
      }
      return { type: 'idle' }
    }

    case 'builder': {
      const buildTarget = findBuildTarget(unit, state)
      if (buildTarget) {
        return { type: 'build', targetQ: buildTarget.q, targetR: buildTarget.r }
      }
      return { type: 'idle' }
    }

    default:
      return { type: 'idle' }
  }
}

/**
 * Applies a decided action to the unit by setting its state and target.
 */
export function applyAction(unit: GameUnit, action: UnitAction, _state: GameState): void {
  switch (action.type) {
    case 'idle':
      unit.state = 'idle'
      unit.targetQ = undefined
      unit.targetR = undefined
      break
    case 'return_to_base':
      unit.state = 'returning'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
    case 'retreat':
      unit.state = 'moving'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
    case 'explore':
      unit.state = 'moving'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
    case 'gather':
      unit.state = 'gathering'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
    case 'patrol':
      unit.state = 'moving'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
    case 'attack':
      unit.state = 'fighting'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
    case 'settle':
      unit.state = 'moving'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
    case 'build':
      unit.state = 'building'
      unit.targetQ = action.targetQ
      unit.targetR = action.targetR
      break
  }
}

/**
 * Main tick function: processes all units' AI decisions.
 * For each unit owned by a non-eliminated player:
 * 1. Update hunger
 * 2. Update safety
 * 3. Decide action based on needs priority
 * 4. Apply action (set unit state and target)
 */
export function tickUnitAI(state: GameState): void {
  for (const unit of state.units.values()) {
    const player = state.players.get(unit.ownerId)
    if (!player || player.eliminated) continue

    const faction = getFaction(player.factionId)

    // Update needs
    updateHunger(unit)
    updateSafety(unit, state)

    // Decide and apply action
    const action = decideAction(unit, player, faction, state)
    applyAction(unit, action, state)
  }
}
