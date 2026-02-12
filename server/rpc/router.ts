import { lobbyRouter } from './procedures/lobby'
import { gameRouter } from './procedures/game'

export { type BaseContext, type AuthedContext } from './base'

export const router = {
  lobby: lobbyRouter,
  game: gameRouter
}
