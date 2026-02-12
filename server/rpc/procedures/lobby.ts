import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { publicProcedure, authedProcedure } from '../base'
import { publisher } from '../publisher'
import prisma from '../../utils/prisma'

const get = publicProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async ({ input }) => {
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true } } }
        }
      }
    })

    if (!lobby) {
      throw new ORPCError('NOT_FOUND', { message: 'Lobby not found' })
    }

    return {
      id: lobby.id,
      hostId: lobby.hostId,
      status: lobby.status,
      createdAt: lobby.createdAt,
      players: lobby.members.map(m => ({ id: m.user.id, name: m.user.name }))
    }
  })

const list = publicProcedure
  .handler(async () => {
    const lobbies = await prisma.lobby.findMany({
      where: { status: 'waiting' },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' }
    })

    return lobbies.map(lobby => ({
      id: lobby.id,
      hostId: lobby.hostId,
      playerCount: lobby._count.members,
      createdAt: lobby.createdAt
    }))
  })

const create = authedProcedure
  .handler(async ({ context }) => {
    const { user } = context

    const existingMembership = await prisma.lobbyMember.findFirst({
      where: { userId: user.id, lobby: { status: 'waiting' } }
    })

    if (existingMembership) {
      throw new ORPCError('BAD_REQUEST', { message: 'Already in a lobby' })
    }

    const lobby = await prisma.$transaction(async (tx) => {
      const created = await tx.lobby.create({
        data: { hostId: user.id }
      })

      await tx.lobbyMember.create({
        data: { lobbyId: created.id, userId: user.id }
      })

      return tx.lobby.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          members: {
            include: { user: { select: { id: true, name: true } } }
          }
        }
      })
    })

    return {
      id: lobby.id,
      hostId: lobby.hostId,
      status: lobby.status,
      createdAt: lobby.createdAt,
      players: lobby.members.map(m => ({ id: m.user.id, name: m.user.name }))
    }
  })

const join = authedProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async ({ input, context }) => {
    const { user } = context

    const existingMembership = await prisma.lobbyMember.findFirst({
      where: { userId: user.id, lobby: { status: 'waiting' } }
    })

    if (existingMembership) {
      throw new ORPCError('BAD_REQUEST', { message: 'Already in a lobby' })
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId }
    })

    if (!lobby || lobby.status !== 'waiting') {
      throw new ORPCError('NOT_FOUND', { message: 'Lobby not found or not accepting players' })
    }

    await prisma.lobbyMember.create({
      data: { lobbyId: input.lobbyId, userId: user.id }
    })

    publisher.publish(`lobby:${input.lobbyId}`, {
      type: 'playerJoined',
      player: { id: user.id, name: user.name }
    })

    return { success: true }
  })

const leave = authedProcedure
  .handler(async ({ context }) => {
    const { user } = context

    const membership = await prisma.lobbyMember.findFirst({
      where: { userId: user.id, lobby: { status: 'waiting' } }
    })

    if (!membership) {
      throw new ORPCError('BAD_REQUEST', { message: 'Not in a lobby' })
    }

    const lobbyId = membership.lobbyId

    await prisma.lobbyMember.delete({
      where: { id: membership.id }
    })

    publisher.publish(`lobby:${lobbyId}`, {
      type: 'playerLeft',
      playerId: user.id
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
