import { z } from 'zod'
import { authedProcedure } from '../base'
import { pauseGame, resumeGame, changeSpeed } from '../../game/game-registry'
import { GAME_SPEEDS } from '../../../shared/game-types'
import type { GameSpeed } from '../../../shared/game-types'

export const gameActionsRouter = {
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
