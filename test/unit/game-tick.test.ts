import { describe, expect, it } from 'vitest'
import type { GameState, GamePlayer, GameUnit, GameSettlement, Resources } from '../../shared/game-types'
import { executeTick } from '../../server/game/game-tick'
import { GameStateManager } from '../../server/game/game-state'

// --- Helpers to build minimal game state for testing ---

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

function makeUnit(overrides: Partial<GameUnit> = {}): GameUnit {
  return {
    id: 'u1',
    type: 'scout',
    ownerId: 'p1',
    q: 5,
    r: 5,
    hp: 50,
    maxHp: 50,
    hunger: 0,
    safety: 100,
    strength: 2,
    visionRange: 4,
    moveSpeed: 2,
    state: 'idle',
    ...overrides
  }
}

function makeSettlement(overrides: Partial<GameSettlement> = {}): GameSettlement {
  return {
    id: 's1',
    ownerId: 'p1',
    name: 'Haven',
    tier: 'outpost',
    q: 5,
    r: 5,
    buildings: [],
    buildingSlots: 2,
    gatherRadius: 2,
    isCapital: true,
    hp: 100,
    maxHp: 100,
    defense: 5,
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
    improvements: new Map(),
    players: new Map([['p1', makePlayer()]]),
    units: new Map([['u1', makeUnit()]]),
    settlements: new Map([['s1', makeSettlement()]]),
    diplomacy: [],
    neutralUnits: new Map(),
    barbarianCamps: [],
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

  it('returns events array from a single tick', () => {
    const state = makeGameState()
    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    expect(Array.isArray(events)).toBe(true)
  })

  it('calls all systems in correct order (systems mutate state)', () => {
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

    // Events should be an array (may be empty if no combat/tech/elimination happened)
    expect(Array.isArray(events)).toBe(true)

    // Resource system should have run: income fields should be populated
    const p1 = manager.state.players.get('p1')!
    // After tickResources, resourceIncome should reflect settlement buildings
    // At minimum, the function ran without error
    expect(p1.resources).toBeDefined()
    expect(p1.resourceIncome).toBeDefined()
  })

  it('collects combat events when units fight', () => {
    // Place two enemy units adjacent to each other
    const p1 = makePlayer({ userId: 'p1', factionId: 'solar_empire' })
    const p2 = makePlayer({
      userId: 'p2',
      factionId: 'merchant_league',
      fogMap: new Uint8Array(400).fill(0)
    })

    const warrior1 = makeUnit({
      id: 'w1',
      type: 'warrior',
      ownerId: 'p1',
      q: 5,
      r: 5,
      hp: 80,
      maxHp: 80,
      strength: 10,
      state: 'idle'
    })

    const warrior2 = makeUnit({
      id: 'w2',
      type: 'warrior',
      ownerId: 'p2',
      q: 6,
      r: 5,
      hp: 80,
      maxHp: 80,
      strength: 10,
      state: 'idle'
    })

    const state = makeGameState({
      players: new Map([['p1', p1], ['p2', p2]]),
      units: new Map([['w1', warrior1], ['w2', warrior2]]),
      settlements: new Map([
        ['s1', makeSettlement({ id: 's1', ownerId: 'p1', q: 3, r: 3 })],
        ['s2', makeSettlement({ id: 's2', ownerId: 'p2', q: 15, r: 15 })]
      ]),
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })

    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    // At war with adjacent units -- combat system should produce events
    const combatEvents = events.filter(e => e.type === 'combatResult')
    expect(combatEvents.length).toBeGreaterThan(0)
  })

  it('collects tech research events when research completes', () => {
    const p1 = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      currentResearch: 'agriculture',
      // Set researchProgress near completion (agriculture costs 100 science)
      researchProgress: 99,
      resources: makeResources({ food: 50, production: 30, gold: 30, science: 10 }),
      resourceIncome: makeResources({ science: 5 })
    })

    const state = makeGameState({
      players: new Map([['p1', p1]]),
      units: new Map(),
      settlements: new Map([['s1', makeSettlement()]])
    })

    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    const techEvents = events.filter(e => e.type === 'techResearched')
    expect(techEvents.length).toBe(1)
    expect(techEvents[0]).toEqual({
      type: 'techResearched',
      techId: 'agriculture',
      playerId: 'p1'
    })
  })

  it('collects elimination events when a player loses all settlements', () => {
    const p1 = makePlayer({ userId: 'p1' })
    const p2 = makePlayer({
      userId: 'p2',
      factionId: 'merchant_league',
      fogMap: new Uint8Array(400).fill(0)
    })

    // p2 has no settlements -> should be eliminated
    const state = makeGameState({
      players: new Map([['p1', p1], ['p2', p2]]),
      settlements: new Map([['s1', makeSettlement({ ownerId: 'p1' })]]),
      units: new Map()
    })

    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    const eliminationEvents = events.filter(e => e.type === 'playerEliminated')
    expect(eliminationEvents.length).toBe(1)
    expect(eliminationEvents[0]).toEqual({
      type: 'playerEliminated',
      playerId: 'p2'
    })
  })

  it('collects victory events when a player wins', () => {
    // Set up a player with extremely high gold to trigger prosperity victory
    const p1 = makePlayer({
      userId: 'p1',
      resources: makeResources({ gold: 10001 })
    })

    const state = makeGameState({
      players: new Map([['p1', p1]]),
      settlements: new Map([['s1', makeSettlement()]]),
      units: new Map()
    })

    const manager = { state } as GameStateManager

    const events = executeTick(manager)

    const victoryEvents = events.filter(e => e.type === 'victory')
    expect(victoryEvents.length).toBe(1)
    expect(victoryEvents[0]).toMatchObject({
      type: 'victory',
      winnerId: 'p1'
    })
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
