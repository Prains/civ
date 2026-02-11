import { playerRouter } from './procedures/player'
import { lobbyRouter } from './procedures/lobby'
import { gameRouter } from './procedures/game'

export { type BaseContext, type AuthedContext } from './base'

export const router = {
  player: playerRouter,
  lobby: lobbyRouter,
  game: gameRouter
}
