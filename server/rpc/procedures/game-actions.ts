import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { authedProcedure } from '../base'
import { getGame, pauseGame, resumeGame, changeSpeed } from '../../game/game-registry'
import { startResearch } from '../../game/systems/research-system'
import { proposeLaw } from '../../game/systems/council-system'
import { constructBuilding } from '../../game/systems/settlement-system'
import { getUnitDef } from '../../../shared/unit-defs'
import { UNIT_TYPES, BUILDING_TYPES, GAME_SPEEDS, COMBAT_POLICIES } from '../../../shared/game-types'
import type { GameUnit, GameSpeed } from '../../../shared/game-types'

// Helper to get game and player from context
function getGameAndPlayer(gameId: string, userId: string) {
  const manager = getGame(gameId)
  if (!manager) throw new ORPCError('NOT_FOUND', { message: 'Game not found' })
  const player = manager.state.players.get(userId)
  if (!player) throw new ORPCError('NOT_FOUND', { message: 'Player not found in game' })
  return { manager, player }
}

export const gameActionsRouter = {
  buyUnit: authedProcedure
    .input(z.object({
      gameId: z.string(),
      unitType: z.enum(UNIT_TYPES as unknown as [string, ...string[]]),
      settlementId: z.string()
    }))
    .handler(async ({ input, context }) => {
      const { manager, player } = getGameAndPlayer(input.gameId, context.user.id)

      // Validate settlement exists and belongs to player
      const settlement = manager.state.settlements.get(input.settlementId)
      if (!settlement || settlement.ownerId !== context.user.id) {
        throw new ORPCError('BAD_REQUEST', { message: 'Settlement not found or not yours' })
      }

      // Check costs
      const unitDef = getUnitDef(input.unitType)
      if (player.resources.gold < unitDef.goldCost) {
        throw new ORPCError('BAD_REQUEST', { message: 'Not enough gold' })
      }
      if (player.resources.production < unitDef.productionCost) {
        throw new ORPCError('BAD_REQUEST', { message: 'Not enough production' })
      }

      // Check barracks requirement for warriors
      if (input.unitType === 'warrior' && !settlement.buildings.includes('barracks')) {
        throw new ORPCError('BAD_REQUEST', { message: 'Barracks required to train warriors' })
      }

      // Deduct resources
      player.resources.gold -= unitDef.goldCost
      player.resources.production -= unitDef.productionCost

      // Spawn unit at settlement
      const unit: GameUnit = {
        id: crypto.randomUUID(),
        type: input.unitType,
        ownerId: context.user.id,
        q: settlement.q,
        r: settlement.r,
        hp: unitDef.maxHp,
        maxHp: unitDef.maxHp,
        hunger: 0,
        safety: 100,
        strength: unitDef.strength,
        visionRange: unitDef.visionRange,
        moveSpeed: unitDef.moveSpeed,
        state: 'idle'
      }
      manager.state.units.set(unit.id, unit)

      return { unitId: unit.id }
    }),

  buildBuilding: authedProcedure
    .input(z.object({
      gameId: z.string(),
      settlementId: z.string(),
      buildingType: z.enum(BUILDING_TYPES as unknown as [string, ...string[]])
    }))
    .handler(async ({ input, context }) => {
      const { manager } = getGameAndPlayer(input.gameId, context.user.id)
      const result = constructBuilding(input.settlementId, input.buildingType, context.user.id, manager.state)
      if (!result) {
        throw new ORPCError('BAD_REQUEST', { message: 'Cannot construct building' })
      }
      return { success: true }
    }),

  setPolicies: authedProcedure
    .input(z.object({
      gameId: z.string(),
      policies: z.object({
        aggression: z.number().min(0).max(100),
        expansion: z.number().min(0).max(100),
        spending: z.number().min(0).max(100),
        combatPolicy: z.enum(COMBAT_POLICIES as unknown as [string, ...string[]])
      })
    }))
    .handler(async ({ input, context }) => {
      const { player } = getGameAndPlayer(input.gameId, context.user.id)
      player.policies = input.policies
      return { success: true }
    }),

  startResearch: authedProcedure
    .input(z.object({ gameId: z.string(), techId: z.string() }))
    .handler(async ({ input, context }) => {
      const { manager } = getGameAndPlayer(input.gameId, context.user.id)
      startResearch(context.user.id, input.techId, manager.state)
      return { success: true }
    }),

  proposeLaw: authedProcedure
    .input(z.object({
      gameId: z.string(),
      lawId: z.string(),
      targetPlayerId: z.string().optional()
    }))
    .handler(async ({ input, context }) => {
      const { manager } = getGameAndPlayer(input.gameId, context.user.id)
      const result = proposeLaw(context.user.id, input.lawId, manager.state, input.targetPlayerId)
      return result
    }),

  requestPause: authedProcedure
    .input(z.object({ gameId: z.string() }))
    .handler(async ({ input }) => {
      pauseGame(input.gameId)
      return { success: true }
    }),

  requestResume: authedProcedure
    .input(z.object({ gameId: z.string() }))
    .handler(async ({ input }) => {
      resumeGame(input.gameId)
      return { success: true }
    }),

  setSpeed: authedProcedure
    .input(z.object({
      gameId: z.string(),
      speed: z.number().refine(
        (v): v is GameSpeed => (GAME_SPEEDS as readonly number[]).includes(v),
        { message: 'Invalid speed' }
      )
    }))
    .handler(async ({ input }) => {
      changeSpeed(input.gameId, input.speed as GameSpeed)
      return { success: true }
    })
}
