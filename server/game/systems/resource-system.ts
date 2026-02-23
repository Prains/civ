import type { GameState, GamePlayer, Resources } from '../../../shared/game-types'
import { RESOURCE_TYPES } from '../../../shared/game-types'
import { getFaction } from '../../../shared/faction-defs'
import { getBuildingDef } from '../../../shared/building-defs'
import { getUnitDef } from '../../../shared/unit-defs'

/**
 * Returns a fresh Resources object with all values set to zero.
 */
export function zeroResources(): Resources {
  return { food: 0, production: 0, gold: 0, science: 0, culture: 0 }
}

/**
 * Calculates per-tick income for a player from all their settlement buildings.
 * Applies faction resource modifiers to the raw building income.
 *
 * @param playerId - The player whose income to calculate
 * @param state - The full game state
 * @param factionModifiers - The faction's resource multipliers (e.g. { production: 1.2 })
 * @returns A Resources object with the total modified income
 */
export function calculateIncome(
  playerId: string,
  state: GameState,
  factionModifiers: Resources
): Resources {
  const income = zeroResources()

  for (const settlement of state.settlements.values()) {
    if (settlement.ownerId !== playerId) continue

    for (const buildingType of settlement.buildings) {
      const buildingDef = getBuildingDef(buildingType)
      for (const res of RESOURCE_TYPES) {
        income[res] += buildingDef.income[res]
      }
    }
  }

  // Apply faction modifiers to the total income
  for (const res of RESOURCE_TYPES) {
    income[res] *= factionModifiers[res]
  }

  return income
}

/**
 * Calculates per-tick upkeep for a player from all their units.
 * Unit upkeep is food-based, taken from unit definitions.
 * Buildings have no upkeep in this version.
 *
 * @param playerId - The player whose upkeep to calculate
 * @param state - The full game state
 * @returns A Resources object with the total upkeep costs
 */
export function calculateUpkeep(
  playerId: string,
  state: GameState
): Resources {
  const upkeep = zeroResources()

  for (const unit of state.units.values()) {
    if (unit.ownerId !== playerId) continue

    const unitDef = getUnitDef(unit.type)
    upkeep.food += unitDef.foodUpkeep
  }

  return upkeep
}

/**
 * Applies crisis effects based on a player's current resource state.
 *
 * - Food crisis (food < 0): All owned units lose 1 moveSpeed (minimum 1).
 * - Gold crisis (gold < 0): The negative gold value serves as a flag
 *   that external systems can check to prevent purchases.
 *
 * @param player - The player to check for crises
 * @param state - The full game state (used to find player's units)
 */
export function applyCrisisEffects(player: GamePlayer, state: GameState): void {
  // Food crisis: units lose speed
  if (player.resources.food < 0) {
    for (const unit of state.units.values()) {
      if (unit.ownerId !== player.userId) continue
      unit.moveSpeed = Math.max(1, unit.moveSpeed - 1)
    }
  }

  // Gold crisis: gold < 0 is the flag itself.
  // External systems (e.g. purchase validation) should check
  // player.resources.gold < 0 to block unit purchases.
}

/**
 * Processes one tick of resource calculations for all active players.
 *
 * For each non-eliminated player:
 * 1. Calculates building income (with faction modifiers)
 * 2. Calculates unit upkeep
 * 3. Updates player's income/upkeep tracking fields
 * 4. Applies net change to resources
 * 5. Checks and applies crisis effects
 *
 * @param state - The full mutable game state
 */
export function tickResources(state: GameState): void {
  for (const [, player] of state.players) {
    if (player.eliminated) continue

    const faction = getFaction(player.factionId)

    // Calculate income from settlements/buildings with faction modifiers
    const income = calculateIncome(player.userId, state, faction.resourceModifiers)
    // Calculate upkeep from units
    const upkeep = calculateUpkeep(player.userId, state)

    // Store income/upkeep on the player for UI display
    player.resourceIncome = income
    player.resourceUpkeep = upkeep

    // Apply net resource change
    for (const res of RESOURCE_TYPES) {
      player.resources[res] += (income[res] - upkeep[res])
    }

    // Apply crisis effects
    applyCrisisEffects(player, state)
  }
}
