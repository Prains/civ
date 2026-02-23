// --- Factions ---
export const FACTION_IDS = ['solar_empire', 'merchant_league', 'forest_keepers', 'seekers'] as const
export type FactionId = typeof FACTION_IDS[number]
export function isValidFactionId(id: string): id is FactionId {
  return (FACTION_IDS as readonly string[]).includes(id)
}

// --- Fog of war tile states ---
export const FOG_STATES = ['unexplored', 'explored', 'visible'] as const
export type FogState = typeof FOG_STATES[number]

// --- Hex coordinate ---
export interface HexCoord {
  q: number
  r: number
}

// --- Game speed ---
export const GAME_SPEEDS = [0.5, 1, 2, 3] as const
export type GameSpeed = typeof GAME_SPEEDS[number]

// --- Settlement state ---
export interface GameSettlement {
  id: string
  ownerId: string
  name: string
  q: number
  r: number
  gatherRadius: number
  isCapital: boolean
}

// --- Player game state ---
export interface GamePlayer {
  userId: string
  factionId: FactionId
  fogMap: Uint8Array // per-tile fog state (0=unexplored, 1=explored, 2=visible)
}

// --- Full game state (server-side) ---
export interface GameState {
  gameId: string
  tick: number
  speed: GameSpeed
  paused: boolean
  mapWidth: number
  mapHeight: number
  terrain: Uint8Array
  elevation: Uint8Array
  players: Map<string, GamePlayer>
  settlements: Map<string, GameSettlement>
}

// --- Events sent to client via SSE ---
export type GameEvent
  = { type: 'tick', tick: number, playerState: ClientPlayerState }
    | { type: 'settlementFounded', settlement: GameSettlement }
    | { type: 'paused', byPlayerId: string }
    | { type: 'resumed' }
    | { type: 'mapReady', mapData: { width: number, height: number, terrain: number[], elevation: number[] } }

// --- Client-side view (filtered by fog) ---
export interface ClientPlayerState {
  tick: number
  factionId: FactionId
  paused: boolean
  speed: GameSpeed
  visibleSettlements: GameSettlement[]
  fogMap: number[] // flattened Uint8Array
}
