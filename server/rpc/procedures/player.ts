import { z } from 'zod'
import { publicProcedure } from '../base'
import prisma from '../../utils/prisma'

const join = publicProcedure
  .input(z.object({ name: z.string().min(1) }))
  .handler(async ({ input }) => {
    const player = await prisma.player.create({
      data: { name: input.name }
    })

    return {
      player: { id: player.id, name: player.name },
      sessionToken: player.sessionToken
    }
  })

export const playerRouter = {
  join
}
