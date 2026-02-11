import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { publicProcedure, authedProcedure } from '../base'
import { publisher } from '../publisher'
import prisma from '../../../lib/prisma'

const get = publicProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async ({ input }) => {
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId },
      include: { players: { select: { id: true, name: true } } }
    })

    if (!lobby) {
      throw new ORPCError('NOT_FOUND', { message: 'Lobby not found' })
    }

    return lobby
  })

const list = publicProcedure
  .handler(async () => {
    const lobbies = await prisma.lobby.findMany({
      where: { status: 'waiting' },
      include: { _count: { select: { players: true } } },
      orderBy: { createdAt: 'desc' }
    })

    return lobbies.map(lobby => ({
      id: lobby.id,
      hostId: lobby.hostId,
      playerCount: lobby._count.players,
      createdAt: lobby.createdAt
    }))
  })

const create = authedProcedure
  .handler(async ({ context }) => {
    const { player } = context

    if (player.lobbyId) {
      throw new ORPCError('BAD_REQUEST', { message: 'Already in a lobby' })
    }

    const lobby = await prisma.lobby.create({
      data: { hostId: player.id }
    })

    await prisma.player.update({
      where: { id: player.id },
      data: { lobbyId: lobby.id }
    })

    return prisma.lobby.findUniqueOrThrow({
      where: { id: lobby.id },
      include: { players: { select: { id: true, name: true } } }
    })
  })

const join = authedProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async ({ input, context }) => {
    const { player } = context

    if (player.lobbyId) {
      throw new ORPCError('BAD_REQUEST', { message: 'Already in a lobby' })
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId }
    })

    if (!lobby || lobby.status !== 'waiting') {
      throw new ORPCError('NOT_FOUND', { message: 'Lobby not found or not accepting players' })
    }

    await prisma.player.update({
      where: { id: player.id },
      data: { lobbyId: input.lobbyId }
    })

    publisher.publish(`lobby:${input.lobbyId}`, {
      type: 'playerJoined',
      player: { id: player.id, name: player.name }
    })

    return { success: true }
  })

const leave = authedProcedure
  .handler(async ({ context }) => {
    const { player } = context

    if (!player.lobbyId) {
      throw new ORPCError('BAD_REQUEST', { message: 'Not in a lobby' })
    }

    const lobbyId = player.lobbyId

    await prisma.player.update({
      where: { id: player.id },
      data: { lobbyId: null }
    })

    publisher.publish(`lobby:${lobbyId}`, {
      type: 'playerLeft',
      playerId: player.id
    })

    return { success: true }
  })

const subscribe = publicProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async function* ({ input, signal }) {
    for await (const event of publisher.subscribe(`lobby:${input.lobbyId}`, { signal })) {
      yield event
    }
  })

export const lobbyRouter = {
  get,
  list,
  create,
  join,
  leave,
  subscribe
}
