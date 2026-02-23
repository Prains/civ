import type { GameState, GameSettlement, BuildingType, SettlementTier, GamePlayer } from '../../../shared/game-types'
import { getBuildingDef } from '../../../shared/building-defs'
import { SETTLEMENT_DEFS } from '../../../shared/settlement-defs'

/** Growth thresholds: accumulated food required to promote to next tier */
const GROWTH_THRESHOLDS: Partial<Record<SettlementTier, { nextTier: SettlementTier, foodRequired: number }>> = {
  outpost: { nextTier: 'settlement', foodRequired: 200 },
  settlement: { nextTier: 'city', foodRequired: 500 }
}

/**
 * Founds a new settlement (outpost tier) on a valid land tile.
 *
 * Validation:
 * - Tile must be land (not water=0, not mountains=5)
 * - Must not be within 5 tiles of any existing settlement (Euclidean distance)
 *
 * @returns The newly created settlement, or null if validation fails.
 */
export function foundSettlement(
  playerId: string,
  q: number,
  r: number,
  state: GameState
): GameSettlement | null {
  // Validate: land tile (not water=0, not mountains=5)
  const terrainIndex = r * state.mapWidth + q
  const terrain = state.terrain[terrainIndex]
  if (terrain === 0 || terrain === 5) return null

  // Validate: not within 5 tiles of existing settlement (Euclidean distance)
  for (const settlement of state.settlements.values()) {
    const dist = Math.sqrt((settlement.q - q) ** 2 + (settlement.r - r) ** 2)
    if (dist < 5) return null
  }

  const def = SETTLEMENT_DEFS.outpost
  const settlement: GameSettlement = {
    id: crypto.randomUUID(),
    ownerId: playerId,
    name: `Settlement ${state.settlements.size + 1}`,
    tier: 'outpost',
    q,
    r,
    buildings: [],
    buildingSlots: def.buildingSlots,
    gatherRadius: def.gatherRadius,
    isCapital: false,
    hp: def.maxHp,
    maxHp: def.maxHp,
    defense: def.baseDefense
  }

  state.settlements.set(settlement.id, settlement)
  return settlement
}

/**
 * Constructs a building in a settlement, deducting the production cost from the player.
 *
 * Validation:
 * - Settlement must exist and be owned by the player
 * - Settlement must have available building slots
 * - Player must have enough production resources
 *
 * @returns true if construction succeeded, false otherwise.
 */
export function constructBuilding(
  settlementId: string,
  buildingType: BuildingType,
  playerId: string,
  state: GameState
): boolean {
  const settlement = state.settlements.get(settlementId)
  if (!settlement || settlement.ownerId !== playerId) return false
  if (settlement.buildings.length >= settlement.buildingSlots) return false

  const def = getBuildingDef(buildingType)
  const player = state.players.get(playerId)!
  if (player.resources.production < def.productionCost) return false

  player.resources.production -= def.productionCost
  settlement.buildings.push(buildingType)
  return true
}

/**
 * Checks whether a settlement should grow to the next tier based on its
 * owner's accumulated food, and applies the upgrade if thresholds are met.
 *
 * Growth thresholds:
 * - Outpost -> Settlement: 200 accumulated food
 * - Settlement -> City: 500 accumulated food
 */
function checkGrowth(settlement: GameSettlement, player: GamePlayer): void {
  const growth = GROWTH_THRESHOLDS[settlement.tier]
  if (!growth) return // city tier has no further growth

  if (player.resources.food >= growth.foodRequired) {
    const nextDef = SETTLEMENT_DEFS[growth.nextTier]
    settlement.tier = growth.nextTier
    settlement.buildingSlots = nextDef.buildingSlots
    settlement.gatherRadius = nextDef.gatherRadius
    settlement.maxHp = nextDef.maxHp
    settlement.hp = nextDef.maxHp
    settlement.defense = nextDef.baseDefense
  }
}

/**
 * Processes one tick of settlement growth checks for all settlements.
 * Skips settlements owned by eliminated players or players not in the state.
 */
export function tickSettlements(state: GameState): void {
  for (const settlement of state.settlements.values()) {
    const player = state.players.get(settlement.ownerId)
    if (!player || player.eliminated) continue

    checkGrowth(settlement, player)
  }
}
