import { describe, expect, it } from 'vitest'
import type { GameState, GamePlayer, Resources } from '../../shared/game-types'
import { tickResearch, startResearch } from '../../server/game/systems/research-system'

// --- Helpers to build minimal game state for testing ---

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { food: 0, production: 0, gold: 0, science: 0, culture: 0, ...overrides }
}

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: 'p1',
    factionId: 'solar_empire',
    resources: makeResources(),
    resourceIncome: makeResources({ science: 5 }),
    resourceUpkeep: makeResources(),
    policies: { aggression: 50, expansion: 50, spending: 50, combatPolicy: 'defensive' },
    advisors: [],
    researchedTechs: [],
    currentResearch: null,
    researchProgress: 0,
    passedLaws: [],
    eliminated: false,
    fogMap: new Uint8Array(0),
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
    players: new Map(),
    units: new Map(),
    settlements: new Map(),
    diplomacy: [],
    neutralUnits: new Map(),
    barbarianCamps: [],
    ...overrides
  }
}

describe('tickResearch', () => {
  it('accumulates science income toward current research', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'agriculture',
      researchProgress: 0,
      resourceIncome: makeResources({ science: 5 })
    })
    state.players.set('p1', player)

    tickResearch(state)

    // agriculture costs 20 science, 5 income per tick => progress = 5
    expect(player.researchProgress).toBe(5)
  })

  it('accumulates science across multiple ticks', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'agriculture',
      researchProgress: 10,
      resourceIncome: makeResources({ science: 5 })
    })
    state.players.set('p1', player)

    tickResearch(state)

    expect(player.researchProgress).toBe(15)
  })

  it('completes tech when progress reaches cost', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'agriculture',
      researchProgress: 15,
      resourceIncome: makeResources({ science: 5 })
    })
    state.players.set('p1', player)

    const events = tickResearch(state)

    // 15 + 5 = 20 = scienceCost of agriculture
    expect(player.researchedTechs).toContain('agriculture')
    expect(player.currentResearch).toBeNull()
    expect(player.researchProgress).toBe(0)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'techResearched',
      techId: 'agriculture',
      playerId: 'p1'
    })
  })

  it('completes tech when progress exceeds cost', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'scouting', // costs 15
      researchProgress: 10,
      resourceIncome: makeResources({ science: 10 })
    })
    state.players.set('p1', player)

    const events = tickResearch(state)

    // 10 + 10 = 20 >= 15
    expect(player.researchedTechs).toContain('scouting')
    expect(player.currentResearch).toBeNull()
    expect(player.researchProgress).toBe(0)
    expect(events).toHaveLength(1)
  })

  it('adds completed tech to researchedTechs and clears currentResearch', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'mining',
      researchProgress: 19,
      resourceIncome: makeResources({ science: 2 }),
      researchedTechs: ['agriculture']
    })
    state.players.set('p1', player)

    tickResearch(state)

    expect(player.researchedTechs).toEqual(['agriculture', 'mining'])
    expect(player.currentResearch).toBeNull()
    expect(player.researchProgress).toBe(0)
  })

  it('does not accumulate when no currentResearch is set', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: null,
      researchProgress: 0,
      resourceIncome: makeResources({ science: 10 })
    })
    state.players.set('p1', player)

    const events = tickResearch(state)

    expect(player.researchProgress).toBe(0)
    expect(events).toHaveLength(0)
  })

  it('skips eliminated players', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      eliminated: true,
      currentResearch: 'agriculture',
      researchProgress: 15,
      resourceIncome: makeResources({ science: 10 })
    })
    state.players.set('p1', player)

    const events = tickResearch(state)

    expect(player.researchProgress).toBe(15)
    expect(player.currentResearch).toBe('agriculture')
    expect(events).toHaveLength(0)
  })

  it('handles multiple players independently', () => {
    const state = makeGameState()

    const p1 = makePlayer({
      userId: 'p1',
      currentResearch: 'agriculture',
      researchProgress: 18,
      resourceIncome: makeResources({ science: 5 })
    })
    state.players.set('p1', p1)

    const p2 = makePlayer({
      userId: 'p2',
      factionId: 'merchant_league',
      currentResearch: 'mining',
      researchProgress: 0,
      resourceIncome: makeResources({ science: 3 })
    })
    state.players.set('p2', p2)

    const events = tickResearch(state)

    // p1: 18 + 5 = 23 >= 20 => completes agriculture
    expect(p1.researchedTechs).toContain('agriculture')
    expect(p1.currentResearch).toBeNull()

    // p2: 0 + 3 = 3 < 20 => still in progress
    expect(p2.researchProgress).toBe(3)
    expect(p2.currentResearch).toBe('mining')

    expect(events).toHaveLength(1)
    expect(events[0].playerId).toBe('p1')
  })

  it('returns empty events array when no techs complete', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'agriculture',
      researchProgress: 0,
      resourceIncome: makeResources({ science: 1 })
    })
    state.players.set('p1', player)

    const events = tickResearch(state)

    expect(events).toHaveLength(0)
    expect(player.researchProgress).toBe(1)
  })

  it('handles zero science income gracefully', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'agriculture',
      researchProgress: 5,
      resourceIncome: makeResources({ science: 0 })
    })
    state.players.set('p1', player)

    const events = tickResearch(state)

    expect(player.researchProgress).toBe(5)
    expect(events).toHaveLength(0)
  })
})

describe('startResearch', () => {
  it('sets currentResearch and resets progress', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      currentResearch: null,
      researchProgress: 0
    })
    state.players.set('p1', player)

    startResearch('p1', 'agriculture', state)

    expect(player.currentResearch).toBe('agriculture')
    expect(player.researchProgress).toBe(0)
  })

  it('throws when player is not found', () => {
    const state = makeGameState()

    expect(() => startResearch('nonexistent', 'agriculture', state))
      .toThrow('Player nonexistent not found')
  })

  it('throws when tech does not exist', () => {
    const state = makeGameState()
    const player = makePlayer({ userId: 'p1' })
    state.players.set('p1', player)

    expect(() => startResearch('p1', 'nonexistent_tech', state))
      .toThrow('Unknown tech: nonexistent_tech')
  })

  it('throws when tech has unmet prerequisites', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      researchedTechs: []
    })
    state.players.set('p1', player)

    // siege_weapons requires phalanx_formation
    expect(() => startResearch('p1', 'siege_weapons', state))
      .toThrow('not available')
  })

  it('throws when tech is faction-restricted to another faction', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      researchedTechs: []
    })
    state.players.set('p1', player)

    // mint is merchant_league only
    expect(() => startResearch('p1', 'mint', state))
      .toThrow('not available')
  })

  it('allows researching faction tech when player has correct faction', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      researchedTechs: []
    })
    state.players.set('p1', player)

    // phalanx_formation is solar_empire, no prereqs
    startResearch('p1', 'phalanx_formation', state)

    expect(player.currentResearch).toBe('phalanx_formation')
  })

  it('allows researching tech with met prerequisites', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      researchedTechs: ['phalanx_formation']
    })
    state.players.set('p1', player)

    // siege_weapons requires phalanx_formation
    startResearch('p1', 'siege_weapons', state)

    expect(player.currentResearch).toBe('siege_weapons')
  })

  it('throws when tech is already researched', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      researchedTechs: ['agriculture']
    })
    state.players.set('p1', player)

    expect(() => startResearch('p1', 'agriculture', state))
      .toThrow('not available')
  })

  it('resets progress when switching research', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      currentResearch: 'agriculture',
      researchProgress: 15
    })
    state.players.set('p1', player)

    startResearch('p1', 'mining', state)

    expect(player.currentResearch).toBe('mining')
    expect(player.researchProgress).toBe(0)
  })

  it('only allows one research at a time (replaces current)', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      currentResearch: 'agriculture',
      researchProgress: 10
    })
    state.players.set('p1', player)

    startResearch('p1', 'scouting', state)

    expect(player.currentResearch).toBe('scouting')
    expect(player.researchProgress).toBe(0)
  })

  it('throws when player is eliminated', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      eliminated: true
    })
    state.players.set('p1', player)

    expect(() => startResearch('p1', 'agriculture', state))
      .toThrow('eliminated')
  })
})

describe('tech effects tracking', () => {
  it('tracks unlock_building effects in researchedTechs for construction validation', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'agriculture',
      researchProgress: 19,
      resourceIncome: makeResources({ science: 5 })
    })
    state.players.set('p1', player)

    tickResearch(state)

    // agriculture unlocks 'farm' building
    // The building system checks researchedTechs to validate construction
    expect(player.researchedTechs).toContain('agriculture')
  })

  it('tracks victory_progress effects in researchedTechs', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'seekers',
      currentResearch: 'enlightenment_tech',
      researchProgress: 99,
      resourceIncome: makeResources({ science: 5 }),
      researchedTechs: ['experiments', 'alchemy', 'great_inventions']
    })
    state.players.set('p1', player)

    const events = tickResearch(state)

    // enlightenment_tech has victory_progress effect
    expect(player.researchedTechs).toContain('enlightenment_tech')
    expect(events).toHaveLength(1)
    expect(events[0].techId).toBe('enlightenment_tech')
  })

  it('tracks modifier effects in researchedTechs', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      currentResearch: 'scouting',
      researchProgress: 14,
      resourceIncome: makeResources({ science: 5 })
    })
    state.players.set('p1', player)

    tickResearch(state)

    // scouting has modifier effect (scout_vision +1)
    expect(player.researchedTechs).toContain('scouting')
  })
})
