import { describe, expect, it } from 'vitest'
import type { GameState, GamePlayer, GameSettlement, Resources, FactionId } from '../../shared/game-types'
import { TECH_TREE } from '../../shared/tech-tree'
import { checkVictory, checkElimination } from '../../server/game/systems/victory-system'

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

/**
 * Returns all tech IDs that a given faction must research for enlightenment:
 * all common techs + all faction-specific techs for that faction.
 */
function getAllTechIdsForFaction(factionId: FactionId): string[] {
  return Object.values(TECH_TREE)
    .filter(t => !t.factionOnly || t.factionOnly === factionId)
    .map(t => t.id)
}

// --- Tests ---

describe('checkElimination', () => {
  it('marks a player as eliminated when they have 0 settlements', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1' })
    state.players.set('p1', p1)
    // No settlements for p1

    const events = checkElimination(state)

    expect(p1.eliminated).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'playerEliminated', playerId: 'p1' })
  })

  it('does not mark a player as eliminated when they have settlements', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1' })
    state.players.set('p1', p1)
    state.settlements.set('s1', makeSettlement({ ownerId: 'p1' }))

    const events = checkElimination(state)

    expect(p1.eliminated).toBe(false)
    expect(events).toHaveLength(0)
  })

  it('does not re-eliminate an already eliminated player', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1', eliminated: true })
    state.players.set('p1', p1)

    const events = checkElimination(state)

    expect(p1.eliminated).toBe(true)
    expect(events).toHaveLength(0) // no new event emitted
  })

  it('can eliminate multiple players at once', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1' })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)
    // Neither player has settlements

    const events = checkElimination(state)

    expect(p1.eliminated).toBe(true)
    expect(p2.eliminated).toBe(true)
    expect(events).toHaveLength(2)
  })
})

describe('checkVictory - Domination', () => {
  it('returns domination victory when a player owns all capitals', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1' })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    // p1 owns both capitals (p2's capital was captured)
    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p1', isCapital: true, q: 10, r: 10 }))
    // p2 still has a non-capital settlement so not eliminated
    state.settlements.set('s3', makeSettlement({ id: 's3', ownerId: 'p2', isCapital: false, q: 15, r: 15 }))

    const event = checkVictory(state)

    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.winnerId).toBe('p1')
      expect(event!.victoryType).toBe('domination')
    }
  })

  it('does not trigger domination when capitals are split between players', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1' })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).toBeNull()
  })
})

describe('checkVictory - Prosperity', () => {
  it('returns prosperity victory when a player reaches 10,000 gold', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1', resources: makeResources({ gold: 10000 }) })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    // Both players have settlements so no elimination
    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.winnerId).toBe('p1')
      expect(event!.victoryType).toBe('prosperity')
    }
  })

  it('does not trigger prosperity at 9,999 gold', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1', resources: makeResources({ gold: 9999 }) })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).toBeNull()
  })
})

describe('checkVictory - Influence', () => {
  it('returns influence victory when a player reaches 10,000 culture', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1', resources: makeResources({ culture: 10000 }) })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.winnerId).toBe('p1')
      expect(event!.victoryType).toBe('influence')
    }
  })

  it('does not trigger influence at 9,999 culture', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1', resources: makeResources({ culture: 9999 }) })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).toBeNull()
  })
})

describe('checkVictory - Enlightenment', () => {
  it('returns enlightenment victory when a player researches all applicable techs', () => {
    const state = makeGameState()
    const allTechIds = getAllTechIdsForFaction('solar_empire')
    const p1 = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      researchedTechs: allTechIds
    })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.winnerId).toBe('p1')
      expect(event!.victoryType).toBe('enlightenment')
    }
  })

  it('does not trigger enlightenment when missing one tech', () => {
    const state = makeGameState()
    const allTechIds = getAllTechIdsForFaction('solar_empire')
    const incompleteTechs = allTechIds.slice(0, -1) // remove last tech
    const p1 = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      researchedTechs: incompleteTechs
    })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).toBeNull()
  })

  it('does not require techs from other factions', () => {
    const state = makeGameState()
    // Seekers only need common techs + seekers-specific techs, NOT solar_empire techs
    const seekerTechIds = getAllTechIdsForFaction('seekers')
    const p1 = makePlayer({
      userId: 'p1',
      factionId: 'seekers',
      researchedTechs: seekerTechIds
    })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.winnerId).toBe('p1')
      expect(event!.victoryType).toBe('enlightenment')
    }
  })
})

describe('checkVictory - Elimination / Last standing', () => {
  it('eliminates a player with no settlements and awards last_standing to sole survivor', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1' })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    // Only p1 has a settlement; p2 has none
    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))

    const event = checkVictory(state)

    // p2 should be eliminated
    expect(p2.eliminated).toBe(true)
    // p1 is the only one left -> last_standing victory
    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.winnerId).toBe('p1')
      expect(event!.victoryType).toBe('last_standing')
    }
  })

  it('does not trigger last_standing when multiple players are still active', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1' })
    const p2 = makePlayer({ userId: 'p2' })
    const p3 = makePlayer({ userId: 'p3' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)
    state.players.set('p3', p3)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))
    // p3 has no settlements -> eliminated, but p1 & p2 still active

    const event = checkVictory(state)

    expect(p3.eliminated).toBe(true)
    // Two players still active -> no victory yet
    expect(event).toBeNull()
  })
})

describe('checkVictory - skips eliminated players', () => {
  it('does not award victory to an eliminated player even if they meet conditions', () => {
    const state = makeGameState()
    const p1 = makePlayer({
      userId: 'p1',
      eliminated: true,
      resources: makeResources({ gold: 10000 })
    })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true }))

    const event = checkVictory(state)

    // p1 is eliminated so gold doesn't matter; p2 is sole survivor
    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.winnerId).toBe('p2')
      expect(event!.victoryType).toBe('last_standing')
    }
  })
})

describe('checkVictory - no victory', () => {
  it('returns null when no victory conditions are met', () => {
    const state = makeGameState()
    const p1 = makePlayer({ userId: 'p1', resources: makeResources({ gold: 100, culture: 100 }) })
    const p2 = makePlayer({ userId: 'p2', resources: makeResources({ gold: 200, culture: 50 }) })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', isCapital: true, q: 10, r: 10 }))

    const event = checkVictory(state)

    expect(event).toBeNull()
  })
})

describe('checkVictory - priority', () => {
  it('domination takes priority over prosperity and influence', () => {
    const state = makeGameState()
    // p1 owns all capitals AND has 10k gold AND 10k culture
    const p1 = makePlayer({
      userId: 'p1',
      resources: makeResources({ gold: 10000, culture: 10000 })
    })
    const p2 = makePlayer({ userId: 'p2' })
    state.players.set('p1', p1)
    state.players.set('p2', p2)

    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', isCapital: true }))
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p1', isCapital: true, q: 10, r: 10 }))
    state.settlements.set('s3', makeSettlement({ id: 's3', ownerId: 'p2', isCapital: false, q: 15, r: 15 }))

    const event = checkVictory(state)

    expect(event).not.toBeNull()
    expect(event!.type).toBe('victory')
    if (event!.type === 'victory') {
      expect(event!.victoryType).toBe('domination')
    }
  })
})
