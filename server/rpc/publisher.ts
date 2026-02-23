import { EventPublisher } from '@orpc/server'
import type { GameEvent as SharedGameEvent, ClientPlayerState } from '../../shared/game-types'

export type LobbyEvent
  = | { type: 'playerJoined', player: { id: string, name: string } }
    | { type: 'playerLeft', playerId: string }
    | { type: 'gameStarted', gameId: string }
    | { type: 'factionSelected', playerId: string, factionId: string }

export type TickEvent = { type: 'tick', tick: number, playerState: ClientPlayerState }

type Channels = Record<`lobby:${string}`, LobbyEvent>
  & Record<`game:${string}`, SharedGameEvent | TickEvent>

export const publisher = new EventPublisher<Channels>()
