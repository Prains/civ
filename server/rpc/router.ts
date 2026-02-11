import type { Player } from '../../app/generated/prisma/client'
import { ORPCError, os } from '@orpc/server'
import prisma from '../../lib/prisma'
import { playerRouter } from './procedures/player'
import { lobbyRouter } from './procedures/lobby'
import { gameRouter } from './procedures/game'

export interface BaseContext {
  sessionToken: string | null
}

export interface AuthedContext extends BaseContext {
  player: Player
}

export const publicProcedure = os.$context<BaseContext>()

export const authedProcedure = publicProcedure.use(async ({ context, next }) => {
  if (!context.sessionToken) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Missing session token' })
  }

  const player = await prisma.player.findUnique({
    where: { sessionToken: context.sessionToken }
  })

  if (!player) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Invalid session token' })
  }

  return next({ context: { player } })
})

export const router = {
  player: playerRouter,
  lobby: lobbyRouter,
  game: gameRouter
}
