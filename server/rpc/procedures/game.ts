import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { authedProcedure, publicProcedure } from '../base'
import { publisher } from '../publisher'
import prisma from '../../utils/prisma'

type TerrainType = 'grass' | 'water' | 'mountain'

const terrainTypes: TerrainType[] = ['grass', 'water', 'mountain']

function generateMap() {
  const tiles: Array<{ q: number, r: number, type: TerrainType }> = []
  for (let q = 0; q < 10; q++) {
    for (let r = 0; r < 10; r++) {
      const type = terrainTypes[Math.floor(Math.random() * terrainTypes.length)]
      tiles.push({ q, r, type })
    }
  }
  return { tiles }
}

const start = authedProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async ({ input, context }) => {
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId }
    })

    if (!lobby) {
      throw new ORPCError('NOT_FOUND', { message: 'Lobby not found' })
    }

    if (lobby.hostId !== context.user.id) {
      throw new ORPCError('FORBIDDEN', { message: 'Only the host can start the game' })
    }

    if (lobby.status !== 'waiting') {
      throw new ORPCError('CONFLICT', { message: 'Game already started' })
    }

    const mapData = generateMap()

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
