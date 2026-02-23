import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { GameState, GamePlayer, GameEvent, Resources, ClientPlayerState } from '../../shared/game-types'
import { startGame, stopGame, getGame, pauseGame, resumeGame, changeSpeed } from '../../server/game/game-registry'
import { publisher } from '../../server/rpc/publisher'
import { executeTick } from '../../server/game/game-tick'
import type { GameStateManager } from '../../server/game/game-state'

// Mock the publisher module (vitest hoists vi.mock calls automatically)
vi.mock('../../server/rpc/publisher', () => ({
  publisher: {
    publish: vi.fn()
  }
}))

// Mock executeTick so we can control what events are returned
vi.mock('../../server/game/game-tick', () => ({
  executeTick: vi.fn(() => [])
}))

// --- Helpers ---

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { food: 0, production: 0, gold: 0, science: 0, culture: 0, ...overrides }
}

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: 'p1',
    factionId: 'solar_empire',
    resources: makeResources({ food: 50, production: 30, gold: 30 }),
    resourceIncome: makeResources(),
    resourceUpkeep: makeResources(),
    policies: { aggression: 50, expansion: 50, spending: 50, combatPolicy: 'defensive' },
    advisors: [
      { type: 'general', loyalty: 50 },
      { type: 'treasurer', loyalty: 50 },
      { type: 'priest', loyalty: 50 },
      { type: 'scholar', loyalty: 50 },
      { type: 'tribune', loyalty: 50 }
    ],
    researchedTechs: [],
    currentResearch: null,
    researchProgress: 0,
    passedLaws: [],
    eliminated: false,
    fogMap: new Uint8Array(400).fill(0),
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
    terrain: new Uint8Array(400).fill(4),
    elevation: new Uint8Array(400).fill(128),
    improvements: new Map(),
    players: new Map([['p1', makePlayer()]]),
    units: new Map(),
    settlements: new Map(),
    diplomacy: [],
    neutralUnits: new Map(),
    barbarianCamps: [],
    ...overrides
  }
}

function makeMockPlayerView(): ClientPlayerState {
  return {
    tick: 1,
    resources: makeResources(),
    resourceIncome: makeResources(),
    resourceUpkeep: makeResources(),
    policies: { aggression: 50, expansion: 50, spending: 50, combatPolicy: 'defensive' },
    advisors: [],
    currentResearch: null,
    researchProgress: 0,
    researchedTechs: [],
    passedLaws: [],
    visibleUnits: [],
    visibleSettlements: [],
    fogMap: [],
    diplomacy: []
  }
}

function makeManager(stateOverrides: Partial<GameState> = {}): GameStateManager {
  const state = makeGameState(stateOverrides)
  const mockView = makeMockPlayerView()
  return {
    state,
    getPlayerView: vi.fn(() => mockView)
  } as unknown as GameStateManager
}

describe('game-registry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any registered games to avoid leaks between tests
    const manager = getGame('test-game')
    if (manager) {
      stopGame('test-game')
    }
    vi.useRealTimers()
  })

  describe('startGame', () => {
    it('registers a new game and starts the tick loop', () => {
      const manager = makeManager()
      startGame(manager)

      expect(getGame('test-game')).toBe(manager)
    })

    it('calls executeTick on the first interval', () => {
      const manager = makeManager({ speed: 1 })
      startGame(manager)

      // speed=1 -> tickMs = 500 / 1 = 500ms
      vi.advanceTimersByTime(500)

      expect(executeTick).toHaveBeenCalledWith(manager)
    })

    it('calls executeTick multiple times over multiple intervals', () => {
      const manager = makeManager({ speed: 1 })
      startGame(manager)

      vi.advanceTimersByTime(2500)

      // 2500ms / 500ms = 5 ticks
      expect(executeTick).toHaveBeenCalledTimes(5)
    })
  })

  describe('tick interval based on speed', () => {
    it('fires at 1000ms for speed 0.5', () => {
      const manager = makeManager({ speed: 0.5 })
      startGame(manager)

      vi.advanceTimersByTime(1000)
      expect(executeTick).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1000)
      expect(executeTick).toHaveBeenCalledTimes(2)
    })

    it('fires at 500ms for speed 1', () => {
      const manager = makeManager({ speed: 1 })
      startGame(manager)

      vi.advanceTimersByTime(500)
      expect(executeTick).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(500)
      expect(executeTick).toHaveBeenCalledTimes(2)
    })

    it('fires at 250ms for speed 2', () => {
      const manager = makeManager({ speed: 2 })
      startGame(manager)

      vi.advanceTimersByTime(250)
      expect(executeTick).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(250)
      expect(executeTick).toHaveBeenCalledTimes(2)
    })

    it('fires at ~167ms for speed 3', () => {
      const manager = makeManager({ speed: 3 })
      startGame(manager)

      // 500 / 3 = 166.67ms
      // After 167ms, first tick should fire
      vi.advanceTimersByTime(167)
      expect(executeTick).toHaveBeenCalledTimes(1)
    })
  })

  describe('pauseGame', () => {
    it('stops the tick loop', () => {
      const manager = makeManager()
      startGame(manager)

      pauseGame('test-game')

      vi.advanceTimersByTime(5000)
      expect(executeTick).not.toHaveBeenCalled()
    })

    it('sets state.paused to true', () => {
      const manager = makeManager()
      startGame(manager)

      pauseGame('test-game')

      expect(manager.state.paused).toBe(true)
    })

    it('throws when game is not found', () => {
      expect(() => pauseGame('nonexistent')).toThrow()
    })
  })

  describe('resumeGame', () => {
    it('restarts the tick loop after pause', () => {
      const manager = makeManager()
      startGame(manager)

      pauseGame('test-game')
      vi.advanceTimersByTime(5000)
      expect(executeTick).not.toHaveBeenCalled()

      resumeGame('test-game')
      vi.advanceTimersByTime(500)
      expect(executeTick).toHaveBeenCalledTimes(1)
    })

    it('sets state.paused to false', () => {
      const manager = makeManager()
      startGame(manager)

      pauseGame('test-game')
      expect(manager.state.paused).toBe(true)

      resumeGame('test-game')
      expect(manager.state.paused).toBe(false)
    })

    it('throws when game is not found', () => {
      expect(() => resumeGame('nonexistent')).toThrow()
    })
  })

  describe('changeSpeed', () => {
    it('updates the game speed on state', () => {
      const manager = makeManager({ speed: 1 })
      startGame(manager)

      changeSpeed('test-game', 2)

      expect(manager.state.speed).toBe(2)
    })

    it('restarts interval at new rate', () => {
      const manager = makeManager({ speed: 1 })
      startGame(manager)

      // Verify ticking at 500ms
      vi.advanceTimersByTime(500)
      expect(executeTick).toHaveBeenCalledTimes(1)
      vi.clearAllMocks()

      changeSpeed('test-game', 2)

      // Now should tick at 250ms
      vi.advanceTimersByTime(250)
      expect(executeTick).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(250)
      expect(executeTick).toHaveBeenCalledTimes(2)
    })

    it('throws when game is not found', () => {
      expect(() => changeSpeed('nonexistent', 2)).toThrow()
    })
  })

  describe('stopGame', () => {
    it('clears the interval and removes the game', () => {
      const manager = makeManager()
      startGame(manager)

      stopGame('test-game')

      expect(getGame('test-game')).toBeUndefined()
      vi.advanceTimersByTime(5000)
      expect(executeTick).not.toHaveBeenCalled()
    })

    it('throws when game is not found', () => {
      expect(() => stopGame('nonexistent')).toThrow()
    })
  })

  describe('getGame', () => {
    it('returns the manager for a registered game', () => {
      const manager = makeManager()
      startGame(manager)

      expect(getGame('test-game')).toBe(manager)
    })

    it('returns undefined for an unregistered game', () => {
      expect(getGame('nonexistent')).toBeUndefined()
    })
  })

  describe('broadcastTick', () => {
    it('publishes per-player tick events with correct channel names', () => {
      const p1 = makePlayer({ userId: 'p1' })
      const p2 = makePlayer({ userId: 'p2', factionId: 'merchant_league' })
      const manager = makeManager({
        gameId: 'broadcast-test',
        players: new Map([['p1', p1], ['p2', p2]])
      })

      startGame(manager)
      vi.advanceTimersByTime(500)

      // Should publish tick events for each player
      const publishMock = vi.mocked(publisher.publish)
      const tickCalls = publishMock.mock.calls.filter(
        ([channel]) => typeof channel === 'string' && channel.startsWith('game:broadcast-test:')
      )

      expect(tickCalls.length).toBe(2)

      const channels = tickCalls.map(([ch]) => ch).sort()
      expect(channels).toEqual([
        'game:broadcast-test:p1',
        'game:broadcast-test:p2'
      ])

      // Each call should have a tick event
      for (const [, event] of tickCalls) {
        expect(event).toMatchObject({ type: 'tick' })
      }

      // Clean up
      stopGame('broadcast-test')
    })

    it('publishes discrete game events on the game channel', () => {
      const mockEvents: GameEvent[] = [
        { type: 'combatResult', attackerId: 'a1', defenderId: 'd1', damage: 10, killed: false },
        { type: 'techResearched', techId: 'agriculture', playerId: 'p1' }
      ]
      vi.mocked(executeTick).mockReturnValueOnce(mockEvents)

      const manager = makeManager({ gameId: 'events-test' })
      startGame(manager)

      vi.advanceTimersByTime(500)

      const publishMock = vi.mocked(publisher.publish)
      const eventCalls = publishMock.mock.calls.filter(
        ([channel]) => channel === 'game:events-test'
      )

      expect(eventCalls.length).toBe(2)
      expect(eventCalls[0][1]).toEqual(mockEvents[0])
      expect(eventCalls[1][1]).toEqual(mockEvents[1])

      // Clean up
      stopGame('events-test')
    })

    it('calls getPlayerView for each player', () => {
      const p1 = makePlayer({ userId: 'p1' })
      const p2 = makePlayer({ userId: 'p2', factionId: 'merchant_league' })
      const manager = makeManager({
        gameId: 'view-test',
        players: new Map([['p1', p1], ['p2', p2]])
      })

      startGame(manager)
      vi.advanceTimersByTime(500)

      const getPlayerViewMock = vi.mocked(manager.getPlayerView)
      expect(getPlayerViewMock).toHaveBeenCalledWith('p1')
      expect(getPlayerViewMock).toHaveBeenCalledWith('p2')

      // Clean up
      stopGame('view-test')
    })
  })
})
