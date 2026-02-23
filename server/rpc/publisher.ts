import { EventPublisher } from '@orpc/server'

export type LobbyEvent
  = | { type: 'playerJoined', player: { id: string, name: string } }
    | { type: 'playerLeft', playerId: string }
    | { type: 'gameStarted', gameId: string }
    | { type: 'factionSelected', playerId: string, factionId: string }

export type GameEvent
  = | { type: 'mapReady', mapData: { width: number, height: number, terrain: number[], elevation: number[] } }

type Channels = Record<`lobby:${string}`, LobbyEvent> & Record<`game:${string}`, GameEvent>

export const publisher = new EventPublisher<Channels>()
