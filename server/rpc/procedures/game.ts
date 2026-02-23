import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { authedProcedure } from '../base'
import { publisher } from '../publisher'
import prisma from '../../utils/prisma'
import { generateMap } from '../../utils/map-generator'
import { GameStateManager } from '../../game/game-state'
import { startGame } from '../../game/game-registry'
import type { FactionId } from '../../../shared/game-types'

const MAP_WIDTH = 400
const MAP_HEIGHT = 400

const mapTypeSchema = z.enum(['continents', 'pangaea', 'archipelago']).default('continents')

const start = authedProcedure
  .input(z.object({ lobbyId: z.string(), mapType: mapTypeSchema }))
  .handler(async ({ input, context }) => {
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId }
    })

    if (!lobby) {
      throw new ORPCError('NOT_FOUND', { message: 'Лобби не найдено' })
    }

    if (lobby.hostId !== context.user.id) {
      throw new ORPCError('FORBIDDEN', { message: 'Только хост может начать игру' })
    }

    if (lobby.status !== 'waiting') {
      throw new ORPCError('CONFLICT', { message: 'Игра уже началась' })
    }

    const members = await prisma.lobbyMember.findMany({
      where: { lobbyId: input.lobbyId }
    })

    // Validate all players selected a faction
    for (const m of members) {
      if (!m.factionId) {
        throw new ORPCError('BAD_REQUEST', { message: 'Not all players have selected a faction' })
      }
    }

    const mapData = generateMap(MAP_WIDTH, MAP_HEIGHT, input.mapType)

    const game = await prisma.game.create({
      data: {
        lobbyId: input.lobbyId,
        mapData: JSON.stringify(mapData),
        players: {
          create: members.map(m => ({
            userId: m.userId,
            factionId: m.factionId!
          }))
        }
      }
    })

    // Initialize game state manager
    const manager = GameStateManager.create({
      gameId: game.id,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      terrain: new Uint8Array(mapData.terrain),
      elevation: new Uint8Array(mapData.elevation),
      players: members.map(m => ({ userId: m.userId, factionId: m.factionId as FactionId })),
      speed: 1
    })

    // Register and start tick loop
    startGame(manager)

    // Update lobby status
    await prisma.lobby.update({
      where: { id: input.lobbyId },
      data: { status: 'playing' }
    })

    publisher.publish(`lobby:${input.lobbyId}`, {
      type: 'gameStarted',
      gameId: game.id
    })

    return { gameId: game.id }
  })

const subscribe = authedProcedure
  .input(z.object({ gameId: z.string() }))
  .handler(async function* ({ input, context, signal }) {
    const game = await prisma.game.findUnique({
      where: { id: input.gameId }
    })

    if (!game) {
      throw new ORPCError('NOT_FOUND', { message: 'Game not found' })
    }

    // Send initial map data
    yield {
      type: 'mapReady' as const,
      mapData: JSON.parse(game.mapData) as { width: number, height: number, terrain: number[], elevation: number[] }
    }

    // Subscribe to per-player tick events
    for await (const event of publisher.subscribe(`game:${input.gameId}:${context.user.id}`, { signal })) {
      yield event
    }
  })

export const gameRouter = {
  start,
  subscribe
}
