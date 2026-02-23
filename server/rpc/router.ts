import { lobbyRouter } from './procedures/lobby'
import { gameRouter } from './procedures/game'
import { gameActionsRouter } from './procedures/game-actions'

export { type BaseContext, type AuthedContext } from './base'

export const router = {
  lobby: lobbyRouter,
  game: gameRouter,
  gameActions: gameActionsRouter
}
