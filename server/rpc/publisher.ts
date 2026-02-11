import { EventPublisher } from '@orpc/server'

export interface LobbyEvent {
  type: 'playerJoined' | 'playerLeft' | 'gameStarted'
  lobbyId: string
  playerId?: string
  playerName?: string
}

export interface GameEvent {
  type: 'mapReady'
  gameId: string
}

type Channels = Record<`lobby:${string}`, LobbyEvent> & Record<`game:${string}`, GameEvent>

export const publisher = new EventPublisher<Channels>()
