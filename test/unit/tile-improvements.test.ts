import { describe, expect, it } from 'vitest'
import type { GameState, GameUnit, GamePlayer, GameSettlement } from '../../shared/game-types'
import { tickBuilderImprovements } from '../../server/game/systems/unit-ai-system'

// --- Helpers ---

function makeResources(overrides: Partial<Record<string, number>> = {}) {
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
    advisors: [],
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
    type: 'builder',
    ownerId: 'p1',
    q: 5,
    r: 5,
    hp: 50,
    maxHp: 50,
    hunger: 0,
    safety: 100,
    strength: 0,
    visionRange: 2,
    moveSpeed: 1,
    state: 'building',
    targetQ: 5,
    targetR: 5,
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
    terrain: new Uint8Array(400).fill(4), // all grassland/plains
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

// --- tickBuilderImprovements ---

describe('tickBuilderImprovements', () => {
  it('builder at target on forest tile creates farm_improvement', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    // Set terrain at (5,5) to forest (3)
    state.terrain[5 * 20 + 5] = 3

    const builder = makeUnit({
      q: 5,
      r: 5,
      targetQ: 5,
      targetR: 5,
      state: 'building',
      type: 'builder'
    })
    state.units.set(builder.id, builder)

    tickBuilderImprovements(state)

    expect(state.improvements.get('5,5')).toBe('farm_improvement')
  })

  it('builder at target on hills tile creates mine', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    // Set terrain at (5,5) to hills (2)
    state.terrain[5 * 20 + 5] = 2

    const builder = makeUnit({
      q: 5,
      r: 5,
      targetQ: 5,
      targetR: 5,
      state: 'building',
      type: 'builder'
    })
    state.units.set(builder.id, builder)

    tickBuilderImprovements(state)

    expect(state.improvements.get('5,5')).toBe('mine')
  })

  it('builder at target on grassland tile creates road', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    // Terrain at (5,5) is already grassland (4) by default
    const builder = makeUnit({
      q: 5,
      r: 5,
      targetQ: 5,
      targetR: 5,
      state: 'building',
      type: 'builder'
    })
    state.units.set(builder.id, builder)

    tickBuilderImprovements(state)

    expect(state.improvements.get('5,5')).toBe('road')
  })

  it('builder NOT at target does not create improvement', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    const builder = makeUnit({
      q: 3,
      r: 3,
      targetQ: 5,
      targetR: 5,
      state: 'building',
      type: 'builder'
    })
    state.units.set(builder.id, builder)

    tickBuilderImprovements(state)

    expect(state.improvements.size).toBe(0)
    // Builder should still be in building state since it hasn't arrived
    expect(builder.state).toBe('building')
  })

  it('non-builder unit does not create improvement', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    const warrior = makeUnit({
      id: 'w1',
      type: 'warrior',
      q: 5,
      r: 5,
      targetQ: 5,
      targetR: 5,
      state: 'building' as GameUnit['state']
    })
    state.units.set(warrior.id, warrior)

    tickBuilderImprovements(state)

    expect(state.improvements.size).toBe(0)
  })

  it('improvement key format is "q,r"', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    const builder = makeUnit({
      q: 7,
      r: 12,
      targetQ: 7,
      targetR: 12,
      state: 'building',
      type: 'builder'
    })
    state.units.set(builder.id, builder)

    tickBuilderImprovements(state)

    expect(state.improvements.has('7,12')).toBe(true)
    // Ensure no other key format is used
    expect(state.improvements.size).toBe(1)
  })

  it('builder becomes idle after building', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    const builder = makeUnit({
      q: 5,
      r: 5,
      targetQ: 5,
      targetR: 5,
      state: 'building',
      type: 'builder'
    })
    state.units.set(builder.id, builder)

    tickBuilderImprovements(state)

    expect(builder.state).toBe('idle')
    expect(builder.targetQ).toBeUndefined()
    expect(builder.targetR).toBeUndefined()
  })

  it('existing improvement is not overwritten', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('p1', player)

    // Pre-existing road at (5,5)
    state.improvements.set('5,5', 'road')

    // Set terrain to forest so it would normally create farm_improvement
    state.terrain[5 * 20 + 5] = 3

    const builder = makeUnit({
      q: 5,
      r: 5,
      targetQ: 5,
      targetR: 5,
      state: 'building',
      type: 'builder'
    })
    state.units.set(builder.id, builder)

    tickBuilderImprovements(state)

    // The existing road should still be there, not replaced by farm_improvement
    expect(state.improvements.get('5,5')).toBe('road')
    // Builder should still become idle
    expect(builder.state).toBe('idle')
  })
})
