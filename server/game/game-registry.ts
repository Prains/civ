import type { GameEvent, GameSpeed } from '../../shared/game-types'
import type { GameStateManager } from './game-state'
import { executeTick } from './game-tick'
import { publisher } from '../rpc/publisher'

interface ActiveGame {
  manager: GameStateManager
  interval: ReturnType<typeof setInterval> | null
}

const activeGames = new Map<string, ActiveGame>()

function computeTickMs(speed: GameSpeed): number {
  return 500 / speed
}

function createTickLoop(entry: ActiveGame): ReturnType<typeof setInterval> {
  const tickMs = computeTickMs(entry.manager.state.speed)
  return setInterval(() => {
    const events = executeTick(entry.manager)
    broadcastTick(entry.manager, events)
  }, tickMs)
}

function broadcastTick(manager: GameStateManager, events: GameEvent[]): void {
  for (const [playerId] of manager.state.players) {
    const view = manager.getPlayerView(playerId)
    publisher.publish(`game:${manager.state.gameId}:${playerId}`, {
      type: 'tick',
      tick: manager.state.tick,
      playerState: view
    })
  }
  for (const event of events) {
    publisher.publish(`game:${manager.state.gameId}`, event)
  }
}

export function startGame(manager: GameStateManager): void {
  const entry: ActiveGame = { manager, interval: null }
  entry.interval = createTickLoop(entry)
  activeGames.set(manager.state.gameId, entry)
}

export function stopGame(gameId: string): void {
  const entry = activeGames.get(gameId)
  if (!entry) {
    throw new Error(`Game ${gameId} not found`)
  }
  if (entry.interval !== null) {
    clearInterval(entry.interval)
  }
  activeGames.delete(gameId)
}

export function getGame(gameId: string): GameStateManager | undefined {
  return activeGames.get(gameId)?.manager
}

export function pauseGame(gameId: string): void {
  const entry = activeGames.get(gameId)
  if (!entry) {
    throw new Error(`Game ${gameId} not found`)
  }
  if (entry.interval !== null) {
    clearInterval(entry.interval)
    entry.interval = null
  }
  entry.manager.state.paused = true
}

export function resumeGame(gameId: string): void {
  const entry = activeGames.get(gameId)
  if (!entry) {
    throw new Error(`Game ${gameId} not found`)
  }
  entry.manager.state.paused = false
  entry.interval = createTickLoop(entry)
}

export function changeSpeed(gameId: string, speed: GameSpeed): void {
  const entry = activeGames.get(gameId)
  if (!entry) {
    throw new Error(`Game ${gameId} not found`)
  }
  entry.manager.state.speed = speed
  if (entry.interval !== null) {
    clearInterval(entry.interval)
  }
  entry.interval = createTickLoop(entry)
}
