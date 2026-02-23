import { describe, expect, it } from 'vitest'
import type { GameState, GamePlayer, GameSettlement } from '../../shared/game-types'
import { executeTick } from '../../server/game/game-tick'
import { GameStateManager } from '../../server/game/game-state'

// --- Helpers to build minimal game state for testing ---

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: 'p1',
    factionId: 'solar_empire',
    fogMap: new Uint8Array(400).fill(0),
    ...overrides
  }
}

function makeSettlement(overrides: Partial<GameSettlement> = {}): GameSettlement {
  return {
    id: 's1',
    ownerId: 'p1',
    name: 'Haven',
    q: 5,
    r: 5,
    gatherRadius: 2,
    isCapital: true,
    ...overrides
  }
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: 'test-game',
    tick: 0,
    speed: 1,
    paused: false,
    mapWidth: 20,
    mapHeight: 20,
    terrain: new Uint8Array(400).fill(4), // all plains
    elevation: new Uint8Array(400).fill(128),
    players: new Map([['p1', makePlayer()]]),
    settlements: new Map([['s1', makeSettlement()]]),
    ...overrides
  }
}

describe('executeTick', () => {
  it('increments tick number', () => {
    const state = makeGameState({ tick: 0 })
    const manager = { state } as GameStateManager

    executeTick(manager)

    expect(state.tick).toBe(1)
  })

  it('increments tick number on consecutive calls', () => {
    const state = makeGameState({ tick: 5 })
    const manager = { state } as GameStateManager

    executeTick(manager)
    expect(state.tick).toBe(6)

    executeTick(manager)
    expect(state.tick).toBe(7)

    executeTick(manager)
    expect(state.tick).toBe(8)
  })

  it('does not advance when game is paused', () => {
    const state = makeGameState({ tick: 3, paused: true })
    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    expect(state.tick).toBe(3)
    expect(events).toEqual([])
  })

  it('returns empty array when paused (no events)', () => {
    const state = makeGameState({ paused: true })
    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    expect(events).toEqual([])
  })

  it('returns empty events array from a single tick', () => {
    const state = makeGameState()
    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    expect(Array.isArray(events)).toBe(true)
    expect(events).toEqual([])
  })

  it('calls fog system (fog state changes after tick)', () => {
    // Use GameStateManager.create for a fully initialized game with real data
    const manager = GameStateManager.create({
      gameId: 'order-test',
      mapWidth: 30,
      mapHeight: 30,
      terrain: new Uint8Array(900).fill(4), // all plains
      elevation: new Uint8Array(900).fill(128),
      players: [
        { userId: 'p1', factionId: 'solar_empire' },
        { userId: 'p2', factionId: 'merchant_league' }
      ],
      speed: 1
    })

    expect(manager.state.tick).toBe(0)

    const events = executeTick(manager)

    // Tick should have advanced
    expect(manager.state.tick).toBe(1)

    // Events should be an empty array (no systems generate events now)
    expect(events).toEqual([])

    // Fog system should have run: some tiles should be visible around settlements
    const p1 = manager.state.players.get('p1')!
    const visibleCount = [...p1.fogMap].filter(v => v === 2).length
    expect(visibleCount).toBeGreaterThan(0)
  })

  it('runs multiple ticks accumulating tick count', () => {
    const state = makeGameState({ tick: 0 })
    const manager = { state } as GameStateManager

    for (let i = 0; i < 10; i++) {
      executeTick(manager)
    }

    expect(state.tick).toBe(10)
  })

  it('unpausing after pause resumes tick advancement', () => {
    const state = makeGameState({ tick: 5, paused: true })
    const manager = { state } as GameStateManager

    // Paused: tick stays at 5
    executeTick(manager)
    expect(state.tick).toBe(5)

    // Unpause
    state.paused = false
    executeTick(manager)
    expect(state.tick).toBe(6)
  })
})
