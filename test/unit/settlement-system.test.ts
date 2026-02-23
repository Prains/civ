import { describe, expect, it } from 'vitest'
import type { GameState, GamePlayer, GameSettlement, Resources } from '../../shared/game-types'
import { foundSettlement, constructBuilding, tickSettlements } from '../../server/game/systems/settlement-system'

// --- Helpers to build minimal game state for testing ---

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { food: 0, production: 0, gold: 0, science: 0, culture: 0, ...overrides }
}

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: 'p1',
    factionId: 'solar_empire',
    resources: makeResources({ food: 50, production: 100, gold: 30 }),
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
    terrain: new Uint8Array(400).fill(4), // all plains (valid land)
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

describe('foundSettlement', () => {
  it('founds a settlement on a valid land tile', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())

    const settlement = foundSettlement('p1', 10, 10, state)

    expect(settlement).not.toBeNull()
    expect(settlement!.ownerId).toBe('p1')
    expect(settlement!.q).toBe(10)
    expect(settlement!.r).toBe(10)
    expect(settlement!.tier).toBe('outpost')
    expect(settlement!.buildingSlots).toBe(2)
    expect(settlement!.gatherRadius).toBe(2)
    expect(settlement!.hp).toBe(100)
    expect(settlement!.maxHp).toBe(100)
    expect(settlement!.defense).toBe(5)
    expect(settlement!.buildings).toEqual([])
    expect(settlement!.isCapital).toBe(false)
  })

  it('adds the settlement to the game state', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())

    const settlement = foundSettlement('p1', 10, 10, state)

    expect(state.settlements.size).toBe(1)
    expect(state.settlements.get(settlement!.id)).toBe(settlement)
  })

  it('cannot found on water tile (terrain=0)', () => {
    const terrain = new Uint8Array(400).fill(4)
    // Set tile (10,10) to water
    terrain[10 * 20 + 10] = 0
    const state = makeGameState({ terrain })
    state.players.set('p1', makePlayer())

    const settlement = foundSettlement('p1', 10, 10, state)

    expect(settlement).toBeNull()
    expect(state.settlements.size).toBe(0)
  })

  it('cannot found on mountain tile (terrain=5)', () => {
    const terrain = new Uint8Array(400).fill(4)
    // Set tile (10,10) to mountains
    terrain[10 * 20 + 10] = 5
    const state = makeGameState({ terrain })
    state.players.set('p1', makePlayer())

    const settlement = foundSettlement('p1', 10, 10, state)

    expect(settlement).toBeNull()
    expect(state.settlements.size).toBe(0)
  })

  it('can found on desert tile (terrain=1)', () => {
    const terrain = new Uint8Array(400).fill(4)
    terrain[10 * 20 + 10] = 1
    const state = makeGameState({ terrain })
    state.players.set('p1', makePlayer())

    const settlement = foundSettlement('p1', 10, 10, state)

    expect(settlement).not.toBeNull()
    expect(settlement!.tier).toBe('outpost')
  })

  it('can found on forest tile (terrain=3)', () => {
    const terrain = new Uint8Array(400).fill(4)
    terrain[10 * 20 + 10] = 3
    const state = makeGameState({ terrain })
    state.players.set('p1', makePlayer())

    const settlement = foundSettlement('p1', 10, 10, state)

    expect(settlement).not.toBeNull()
  })

  it('cannot found within 5 tiles of an existing settlement', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())
    state.settlements.set('s1', makeSettlement({ q: 10, r: 10 }))

    // Try to found at (13, 10) => distance = 3, which is < 5
    const settlement = foundSettlement('p1', 13, 10, state)

    expect(settlement).toBeNull()
  })

  it('cannot found at exactly distance 4 from existing settlement', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())
    state.settlements.set('s1', makeSettlement({ q: 10, r: 10 }))

    // Distance (14, 10) => sqrt((14-10)^2 + 0^2) = 4, which is < 5
    const settlement = foundSettlement('p1', 14, 10, state)

    expect(settlement).toBeNull()
  })

  it('can found at distance >= 5 from existing settlement', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())
    state.settlements.set('s1', makeSettlement({ q: 5, r: 5 }))

    // Distance (10, 5) => sqrt((10-5)^2 + 0^2) = 5, which is >= 5
    const settlement = foundSettlement('p1', 10, 5, state)

    expect(settlement).not.toBeNull()
  })

  it('checks distance against all existing settlements', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())
    state.settlements.set('s1', makeSettlement({ id: 's1', q: 3, r: 3 }))
    state.settlements.set('s2', makeSettlement({ id: 's2', q: 17, r: 17 }))

    // (10, 10) is far enough from s1 (dist~9.9) but check against s2 (dist~9.9 also)
    const settlement = foundSettlement('p1', 10, 10, state)

    expect(settlement).not.toBeNull()
  })

  it('assigns a unique ID to each settlement', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())

    const s1 = foundSettlement('p1', 5, 5, state)
    const s2 = foundSettlement('p1', 15, 15, state)

    expect(s1).not.toBeNull()
    expect(s2).not.toBeNull()
    expect(s1!.id).not.toBe(s2!.id)
  })

  it('generates a settlement name', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())

    const settlement = foundSettlement('p1', 10, 10, state)

    expect(settlement).not.toBeNull()
    expect(settlement!.name).toMatch(/^Settlement \d+$/)
  })
})

describe('constructBuilding', () => {
  it('constructs a building and deducts production cost', () => {
    const state = makeGameState()
    const player = makePlayer({ resources: makeResources({ production: 100 }) })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: [],
      buildingSlots: 2
    }))

    const result = constructBuilding('s1', 'farm', 'p1', state)

    expect(result).toBe(true)
    const settlement = state.settlements.get('s1')!
    expect(settlement.buildings).toEqual(['farm'])
    // Farm costs 30 production
    expect(player.resources.production).toBe(70)
  })

  it('returns false when settlement does not exist', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())

    const result = constructBuilding('nonexistent', 'farm', 'p1', state)

    expect(result).toBe(false)
  })

  it('returns false when player does not own the settlement', () => {
    const state = makeGameState()
    state.players.set('p1', makePlayer())
    state.players.set('p2', makePlayer({ userId: 'p2' }))
    state.settlements.set('s1', makeSettlement({ ownerId: 'p2' }))

    const result = constructBuilding('s1', 'farm', 'p1', state)

    expect(result).toBe(false)
  })

  it('enforces building slots limit', () => {
    const state = makeGameState()
    const player = makePlayer({ resources: makeResources({ production: 500 }) })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['farm', 'market'], // already 2 buildings
      buildingSlots: 2
    }))

    const result = constructBuilding('s1', 'library', 'p1', state)

    expect(result).toBe(false)
    expect(state.settlements.get('s1')!.buildings.length).toBe(2)
  })

  it('returns false when player lacks production resources', () => {
    const state = makeGameState()
    const player = makePlayer({ resources: makeResources({ production: 10 }) })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: [],
      buildingSlots: 4
    }))

    // Farm costs 30 production, player only has 10
    const result = constructBuilding('s1', 'farm', 'p1', state)

    expect(result).toBe(false)
    expect(player.resources.production).toBe(10) // unchanged
  })

  it('building effects: farm adds +3 food/tick income tracked in buildings array', () => {
    const state = makeGameState()
    const player = makePlayer({ resources: makeResources({ production: 100 }) })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: [],
      buildingSlots: 4
    }))

    constructBuilding('s1', 'farm', 'p1', state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.buildings).toContain('farm')
    // The building is tracked in the array; income is calculated by the resource system
    expect(settlement.buildings.length).toBe(1)
  })

  it('can construct multiple different buildings', () => {
    const state = makeGameState()
    const player = makePlayer({ resources: makeResources({ production: 500 }) })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: [],
      buildingSlots: 4
    }))

    expect(constructBuilding('s1', 'farm', 'p1', state)).toBe(true)
    expect(constructBuilding('s1', 'lumber_mill', 'p1', state)).toBe(true)
    expect(constructBuilding('s1', 'market', 'p1', state)).toBe(true)

    const settlement = state.settlements.get('s1')!
    expect(settlement.buildings).toEqual(['farm', 'lumber_mill', 'market'])
    // farm=30, lumber_mill=40, market=60 => total=130
    expect(player.resources.production).toBe(370)
  })

  it('deducts correct production cost for each building type', () => {
    const state = makeGameState()
    const player = makePlayer({ resources: makeResources({ production: 200 }) })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: [],
      buildingSlots: 8
    }))

    // Walls cost 120 production
    constructBuilding('s1', 'walls', 'p1', state)
    expect(player.resources.production).toBe(80)
  })
})

describe('tickSettlements', () => {
  it('promotes outpost to settlement at 200 accumulated food', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ food: 200 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      tier: 'outpost'
    }))

    tickSettlements(state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.tier).toBe('settlement')
    expect(settlement.buildingSlots).toBe(4)
    expect(settlement.gatherRadius).toBe(3)
    expect(settlement.maxHp).toBe(200)
    expect(settlement.hp).toBe(200)
    expect(settlement.defense).toBe(10)
  })

  it('promotes settlement to city at 500 accumulated food', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ food: 500 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      tier: 'settlement',
      buildingSlots: 4,
      gatherRadius: 3,
      maxHp: 200,
      hp: 200,
      defense: 10
    }))

    tickSettlements(state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.tier).toBe('city')
    expect(settlement.buildingSlots).toBe(8)
    expect(settlement.gatherRadius).toBe(4)
    expect(settlement.maxHp).toBe(400)
    expect(settlement.hp).toBe(400)
    expect(settlement.defense).toBe(20)
  })

  it('does not promote outpost below 200 food', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ food: 199 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      tier: 'outpost'
    }))

    tickSettlements(state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.tier).toBe('outpost')
  })

  it('does not promote settlement below 500 food', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ food: 499 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      tier: 'settlement'
    }))

    tickSettlements(state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.tier).toBe('settlement')
  })

  it('city tier does not promote further', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ food: 1000 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      tier: 'city',
      buildingSlots: 8,
      gatherRadius: 4,
      maxHp: 400,
      hp: 400,
      defense: 20
    }))

    tickSettlements(state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.tier).toBe('city')
  })

  it('skips eliminated players', () => {
    const state = makeGameState()
    const player = makePlayer({
      eliminated: true,
      resources: makeResources({ food: 500 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      tier: 'outpost'
    }))

    tickSettlements(state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.tier).toBe('outpost') // no promotion
  })

  it('skips settlements whose owner is not in the players map', () => {
    const state = makeGameState()
    // Settlement belongs to a player not in the players map
    state.settlements.set('s1', makeSettlement({
      ownerId: 'ghost',
      tier: 'outpost'
    }))

    // Should not throw
    tickSettlements(state)

    const settlement = state.settlements.get('s1')!
    expect(settlement.tier).toBe('outpost')
  })

  it('handles multiple settlements for the same player', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ food: 250 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      id: 's1',
      ownerId: 'p1',
      tier: 'outpost'
    }))
    state.settlements.set('s2', makeSettlement({
      id: 's2',
      ownerId: 'p1',
      tier: 'outpost',
      q: 15,
      r: 15
    }))

    tickSettlements(state)

    // Both outposts should promote since player has 250 food >= 200
    expect(state.settlements.get('s1')!.tier).toBe('settlement')
    expect(state.settlements.get('s2')!.tier).toBe('settlement')
  })
})
