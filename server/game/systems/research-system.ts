import type { GameState, GamePlayer, TechNode } from '../../../shared/game-types'
import { getTech, getAvailableTechs } from '../../../shared/tech-tree'

export interface TechEvent {
  type: 'techResearched'
  techId: string
  playerId: string
}

/**
 * Completes a tech for a player: adds to researchedTechs, clears current research.
 *
 * Tech effects are tracked by presence in researchedTechs:
 * - unlock_building / unlock_unit: other systems check researchedTechs when validating
 * - modifier: other systems check researchedTechs to apply modifiers
 * - victory_progress: victory system checks researchedTechs for progress
 */
function completeTech(player: GamePlayer, tech: TechNode): void {
  player.researchedTechs.push(tech.id)
  player.currentResearch = null
  player.researchProgress = 0
}

/**
 * Processes one tick of research progress for all active players.
 *
 * For each non-eliminated player with active research:
 * 1. Adds science income to research progress
 * 2. If progress >= tech cost, completes the tech
 * 3. Returns events for any completed techs
 *
 * @param state - The full mutable game state
 * @returns Array of TechEvent for each tech completed this tick
 */
export function tickResearch(state: GameState): TechEvent[] {
  const events: TechEvent[] = []

  for (const [playerId, player] of state.players) {
    if (!player.currentResearch || player.eliminated) continue

    const tech = getTech(player.currentResearch)
    player.researchProgress += player.resourceIncome.science

    if (player.researchProgress >= tech.scienceCost) {
      completeTech(player, tech)
      events.push({ type: 'techResearched', techId: tech.id, playerId })
    }
  }

  return events
}

/**
 * Starts researching a tech for a player.
 *
 * Validates:
 * - Player exists and is not eliminated
 * - Tech is available (not already researched, prerequisites met, faction matches)
 *
 * Sets currentResearch and resets researchProgress to 0.
 * If the player was already researching something else, that progress is lost.
 *
 * @param playerId - The player starting research
 * @param techId - The tech to research
 * @param state - The full game state
 * @throws Error if player not found, eliminated, or tech not available
 */
export function startResearch(playerId: string, techId: string, state: GameState): void {
  const player = state.players.get(playerId)
  if (!player) {
    throw new Error(`Player ${playerId} not found`)
  }

  if (player.eliminated) {
    throw new Error(`Player ${playerId} is eliminated`)
  }

  // getTech throws if tech doesn't exist
  const tech = getTech(techId)

  // Check tech is available (prerequisites, faction, not already researched)
  const available = getAvailableTechs(player.researchedTechs, player.factionId)
  const isAvailable = available.some(t => t.id === tech.id)

  if (!isAvailable) {
    throw new Error(`Tech ${techId} is not available for player ${playerId}`)
  }

  player.currentResearch = techId
  player.researchProgress = 0
}
