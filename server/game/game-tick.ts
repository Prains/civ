import type { GameEvent } from '../../shared/game-types'
import { tickFog } from './systems/fog-system'
import type { GameStateManager } from './game-state'

/**
 * Executes a single game tick.
 * Currently only runs the fog of war system.
 *
 * @param manager - The game state manager holding the mutable game state
 * @returns Array of game events generated during this tick
 */
export function executeTick(manager: GameStateManager): GameEvent[] {
  const state = manager.state
  if (state.paused) return []

  state.tick++

  // Fog of war
  tickFog(state)

  return []
}
