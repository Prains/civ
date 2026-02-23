import type { GameEvent } from '../../shared/game-types'
import { tickResources } from './systems/resource-system'
import { tickUnitAI } from './systems/unit-ai-system'
import { tickMovement } from './systems/movement-system'
import { tickCombat } from './systems/combat-system'
import { tickSettlements } from './systems/settlement-system'
import { tickResearch } from './systems/research-system'
import { tickAdvisorLoyalty } from './systems/council-system'
import { tickFog } from './systems/fog-system'
import { checkVictory, checkElimination } from './systems/victory-system'
import type { GameStateManager } from './game-state'

/**
 * Executes a single game tick by running all systems in order.
 *
 * System execution order:
 *   1. Resource income/upkeep
 *   2. Unit AI decisions
 *   3. Unit movement
 *   4. Combat resolution
 *   5. Settlement growth
 *   6. Research progress
 *   7. Advisor loyalty updates
 *   8. Fog of war
 *   9. Victory/elimination checks
 *
 * @param manager - The game state manager holding the mutable game state
 * @returns Array of game events generated during this tick
 */
export function executeTick(manager: GameStateManager): GameEvent[] {
  const state = manager.state
  if (state.paused) return []

  state.tick++
  const events: GameEvent[] = []

  // 1. Resource income/upkeep
  tickResources(state)

  // 2. Unit AI decisions
  tickUnitAI(state)

  // 3. Unit movement
  tickMovement(state)

  // 4. Combat resolution
  const combatEvents = tickCombat(state)
  for (const ce of combatEvents) {
    events.push({
      type: 'combatResult',
      attackerId: ce.attackerId,
      defenderId: ce.defenderId,
      damage: ce.damage,
      killed: ce.killed
    })
  }

  // 5. Settlement growth
  tickSettlements(state)

  // 6. Research progress
  const techEvents = tickResearch(state)
  for (const te of techEvents) {
    events.push(te)
  }

  // 7. Advisor loyalty updates
  tickAdvisorLoyalty(state)

  // 8. Fog of war
  tickFog(state)

  // 9. Victory check
  const eliminationEvents = checkElimination(state)
  for (const ee of eliminationEvents) {
    events.push(ee)
  }
  const victory = checkVictory(state)
  if (victory) events.push(victory)

  return events
}
