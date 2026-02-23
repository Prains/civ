import type { GameState } from '../../../shared/game-types'

/**
 * Processes fog of war for all non-eliminated players each tick.
 * - Resets all "visible" (2) tiles to "explored" (1)
 * - Re-reveals tiles around own units (by visionRange) and settlements (by gatherRadius)
 */
export function tickFog(state: GameState): void {
  for (const [playerId, player] of state.players) {
    if (player.eliminated) continue

    // Reset all "visible" (2) to "explored" (1), keep "explored" (1) and "unexplored" (0) as-is
    resetVisibility(player.fogMap, state.mapWidth, state.mapHeight)

    // Mark tiles visible from own units
    for (const unit of state.units.values()) {
      if (unit.ownerId === playerId) {
        revealTiles(player.fogMap, unit.q, unit.r, unit.visionRange, state.mapWidth, state.mapHeight)
      }
    }

    // Mark tiles visible from own settlements
    for (const settlement of state.settlements.values()) {
      if (settlement.ownerId === playerId) {
        revealTiles(player.fogMap, settlement.q, settlement.r, settlement.gatherRadius, state.mapWidth, state.mapHeight)
      }
    }
  }
}

/**
 * Resets all visible tiles (value 2) to explored (value 1).
 * Explored (1) and unexplored (0) tiles are left unchanged.
 */
function resetVisibility(fogMap: Uint8Array, width: number, height: number): void {
  const length = width * height
  for (let i = 0; i < length; i++) {
    if (fogMap[i] === 2) {
      fogMap[i] = 1
    }
  }
}

/**
 * Reveals all tiles within `range` Euclidean distance of (centerQ, centerR).
 * Sets matching tiles to visible (2). Clamps to map boundaries.
 */
export function revealTiles(
  fogMap: Uint8Array,
  centerQ: number,
  centerR: number,
  range: number,
  width: number,
  height: number
): void {
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = -range; dr <= range; dr++) {
      if (Math.sqrt(dq * dq + dr * dr) <= range) {
        const tq = centerQ + dq
        const tr = centerR + dr
        if (tq >= 0 && tq < width && tr >= 0 && tr < height) {
          fogMap[tr * width + tq] = 2
        }
      }
    }
  }
}
