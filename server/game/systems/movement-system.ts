import type { GameState } from '../../../shared/game-types'

/**
 * Returns the 6 hex neighbors for offset coordinates (q, r).
 * The neighbor offsets depend on whether the row is even or odd.
 */
export function getHexNeighbors(q: number, r: number): Array<{ q: number, r: number }> {
  const isEvenRow = r % 2 === 0
  if (isEvenRow) {
    return [
      { q: q - 1, r: r - 1 }, { q, r: r - 1 },
      { q: q - 1, r }, { q: q + 1, r },
      { q: q - 1, r: r + 1 }, { q, r: r + 1 }
    ]
  } else {
    return [
      { q, r: r - 1 }, { q: q + 1, r: r - 1 },
      { q: q - 1, r }, { q: q + 1, r },
      { q, r: r + 1 }, { q: q + 1, r: r + 1 }
    ]
  }
}

/** Terrain values that are impassable: water (0) and mountains (5) */
function isImpassable(terrainValue: number): boolean {
  return terrainValue === 0 || terrainValue === 5
}

/**
 * BFS pathfinding on the hex grid.
 * Skips water (terrain=0) and mountains (terrain=5).
 * Returns an array of steps from start to end (inclusive).
 * Returns an empty array if the target is unreachable.
 */
export function findPath(
  fromQ: number,
  fromR: number,
  toQ: number,
  toR: number,
  state: GameState
): Array<{ q: number, r: number }> {
  // Already at target
  if (fromQ === toQ && fromR === toR) {
    return [{ q: fromQ, r: fromR }]
  }

  const { mapWidth, mapHeight, terrain } = state

  // Validate that start and end are within bounds
  if (fromQ < 0 || fromQ >= mapWidth || fromR < 0 || fromR >= mapHeight) {
    return []
  }
  if (toQ < 0 || toQ >= mapWidth || toR < 0 || toR >= mapHeight) {
    return []
  }

  // Check that the target tile is passable
  const targetIdx = toR * mapWidth + toQ
  if (isImpassable(terrain[targetIdx])) {
    return []
  }

  // BFS
  const key = (q: number, r: number) => `${q},${r}`
  const visited = new Set<string>()
  const cameFrom = new Map<string, { q: number, r: number }>()

  const startKey = key(fromQ, fromR)
  visited.add(startKey)

  const queue: Array<{ q: number, r: number }> = [{ q: fromQ, r: fromR }]
  let found = false

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current.q === toQ && current.r === toR) {
      found = true
      break
    }

    const neighbors = getHexNeighbors(current.q, current.r)
    for (const neighbor of neighbors) {
      // Bounds check
      if (neighbor.q < 0 || neighbor.q >= mapWidth || neighbor.r < 0 || neighbor.r >= mapHeight) {
        continue
      }

      const nKey = key(neighbor.q, neighbor.r)
      if (visited.has(nKey)) {
        continue
      }

      // Passability check
      const tileIdx = neighbor.r * mapWidth + neighbor.q
      if (isImpassable(terrain[tileIdx])) {
        continue
      }

      visited.add(nKey)
      cameFrom.set(nKey, { q: current.q, r: current.r })
      queue.push(neighbor)
    }
  }

  if (!found) {
    return []
  }

  // Reconstruct path from end to start
  const path: Array<{ q: number, r: number }> = []
  let current = { q: toQ, r: toR }
  while (current.q !== fromQ || current.r !== fromR) {
    path.push(current)
    const prev = cameFrom.get(key(current.q, current.r))
    if (!prev) break
    current = prev
  }
  path.push({ q: fromQ, r: fromR })
  path.reverse()

  return path
}

/** Unit states that should trigger movement toward a target */
const MOVABLE_STATES = new Set(['moving', 'returning', 'gathering', 'building'])

/**
 * Processes one tick of movement for all units.
 *
 * For each unit in a movable state with a target:
 * 1. Compute the BFS path from current position to target
 * 2. Advance the unit along the path by effective move speed tiles
 *    (base moveSpeed + 1 if on a road tile)
 * 3. When unit reaches target, clear targetQ/targetR and set state to 'idle'
 */
export function tickMovement(state: GameState): void {
  for (const unit of state.units.values()) {
    // Only move units that are in a movable state with a defined target
    if (!MOVABLE_STATES.has(unit.state)) continue
    if (unit.targetQ === undefined || unit.targetR === undefined) continue

    // Already at target
    if (unit.q === unit.targetQ && unit.r === unit.targetR) {
      unit.state = 'idle'
      unit.targetQ = undefined
      unit.targetR = undefined
      continue
    }

    const path = findPath(unit.q, unit.r, unit.targetQ, unit.targetR, state)

    // No valid path found, unit stays in place
    if (path.length <= 1) {
      continue
    }

    // Calculate effective move speed: base + road bonus
    const currentTileKey = `${unit.q},${unit.r}`
    const onRoad = state.improvements.get(currentTileKey) === 'road'
    const effectiveSpeed = unit.moveSpeed + (onRoad ? 1 : 0)

    // Advance along the path by effectiveSpeed steps
    // path[0] is the current position, so we start moving to path[1]
    const stepsToTake = Math.min(effectiveSpeed, path.length - 1)
    const destination = path[stepsToTake]

    unit.q = destination.q
    unit.r = destination.r

    // Check if unit reached the target
    if (unit.q === unit.targetQ && unit.r === unit.targetR) {
      unit.state = 'idle'
      unit.targetQ = undefined
      unit.targetR = undefined
    }
  }
}
