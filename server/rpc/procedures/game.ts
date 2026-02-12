import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { authedProcedure, publicProcedure } from '../base'
import { publisher } from '../publisher'
import prisma from '../../utils/prisma'
import { generateMap } from '../../utils/map-generator'

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

    const mapData = generateMap(MAP_WIDTH, MAP_HEIGHT, input.mapType)

    const game = await prisma.game.create({
      data: {
        lobbyId: input.lobbyId,
        mapData: JSON.stringify(mapData)
      }
    })

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

const subscribe = publicProcedure
  .input(z.object({ gameId: z.string() }))
  .handler(async function* ({ input, signal }) {
    const game = await prisma.game.findUnique({
      where: { id: input.gameId }
    })

    if (game) {
      yield {
        type: 'mapReady' as const,
        mapData: JSON.parse(game.mapData)
      }
    }

    for await (const event of publisher.subscribe(`game:${input.gameId}`, { signal })) {
      yield event
    }
  })

export const gameRouter = {
  start,
  subscribe
}
