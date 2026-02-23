import type { GameState, GameEvent, GamePlayer } from '../../../shared/game-types'
import { TECH_TREE } from '../../../shared/tech-tree'

/**
 * Victory condition thresholds.
 */
const PROSPERITY_GOLD_THRESHOLD = 10000
const INFLUENCE_CULTURE_THRESHOLD = 10000

/**
 * Checks all players for elimination: any non-eliminated player
 * with 0 settlements is marked eliminated and a playerEliminated
 * event is emitted.
 *
 * @returns Array of playerEliminated events (may be empty)
 */
export function checkElimination(state: GameState): GameEvent[] {
  const events: GameEvent[] = []

  for (const [playerId, player] of state.players) {
    if (player.eliminated) continue

    // Count settlements owned by this player
    let hasSettlement = false
    for (const settlement of state.settlements.values()) {
      if (settlement.ownerId === playerId) {
        hasSettlement = true
        break
      }
    }

    if (!hasSettlement) {
      player.eliminated = true
      events.push({ type: 'playerEliminated', playerId })
    }
  }

  return events
}

/**
 * Checks whether a player owns all capital settlements in the game.
 * A capital is any settlement with `isCapital: true`.
 */
function checkDomination(playerId: string, state: GameState): boolean {
  let totalCapitals = 0
  let ownedCapitals = 0

  for (const settlement of state.settlements.values()) {
    if (settlement.isCapital) {
      totalCapitals++
      if (settlement.ownerId === playerId) {
        ownedCapitals++
      }
    }
  }

  // Must own at least 1 capital and all capitals
  return totalCapitals > 0 && ownedCapitals === totalCapitals
}

/**
 * Checks whether a player has researched all techs available to them:
 * all common (non-faction) techs + all techs specific to their faction.
 */
function checkEnlightenment(player: GamePlayer): boolean {
  const researchedSet = new Set(player.researchedTechs)

  const requiredTechs = Object.values(TECH_TREE).filter(
    t => !t.factionOnly || t.factionOnly === player.factionId
  )

  return requiredTechs.every(t => researchedSet.has(t.id))
}

/**
 * Checks all 4 victory conditions each tick.
 *
 * Order of checks:
 * 1. Elimination (players with 0 settlements)
 * 2. Last player standing (automatic victory)
 * 3. Per-player condition checks (domination, prosperity, influence, enlightenment)
 *
 * @returns A victory GameEvent if a player wins, or null if no victory yet
 */
export function checkVictory(state: GameState): GameEvent | null {
  // Check elimination first
  checkElimination(state)

  // Check if only one player left
  const activePlayers = [...state.players.values()].filter(p => !p.eliminated)
  if (activePlayers.length === 1) {
    return { type: 'victory', winnerId: activePlayers[0].userId, victoryType: 'last_standing' }
  }

  for (const [playerId, player] of state.players) {
    if (player.eliminated) continue

    // Domination: own all capitals
    if (checkDomination(playerId, state)) {
      return { type: 'victory', winnerId: playerId, victoryType: 'domination' }
    }

    // Prosperity: 10,000 gold
    if (player.resources.gold >= PROSPERITY_GOLD_THRESHOLD) {
      return { type: 'victory', winnerId: playerId, victoryType: 'prosperity' }
    }

    // Influence: 10,000 culture
    if (player.resources.culture >= INFLUENCE_CULTURE_THRESHOLD) {
      return { type: 'victory', winnerId: playerId, victoryType: 'influence' }
    }

    // Enlightenment: all techs researched
    if (checkEnlightenment(player)) {
      return { type: 'victory', winnerId: playerId, victoryType: 'enlightenment' }
    }
  }

  return null
}
