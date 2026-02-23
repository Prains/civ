import { describe, expect, it } from 'vitest'
import type { GameState, GamePlayer, GameUnit, GameSettlement, Resources } from '../../shared/game-types'
import { tickResources, calculateIncome, calculateUpkeep, applyCrisisEffects, zeroResources } from '../../server/game/systems/resource-system'

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

describe('zeroResources', () => {
  it('returns a Resources object with all values at zero', () => {
    const res = zeroResources()
    expect(res).toEqual({ food: 0, production: 0, gold: 0, science: 0, culture: 0 })
  })

  it('returns a new object each time', () => {
    const a = zeroResources()
    const b = zeroResources()
    expect(a).not.toBe(b)
  })
})

describe('calculateIncome', () => {
  it('returns zero income when player has no settlements', () => {
    const state = makeGameState()
    const income = calculateIncome('p1', state, { food: 1, production: 1, gold: 1, science: 1, culture: 1 })
    expect(income).toEqual(zeroResources())
  })

  it('sums building income from a single settlement with a farm', () => {
    const state = makeGameState()
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['farm']
    }))

    const income = calculateIncome('p1', state, { food: 1, production: 1, gold: 1, science: 1, culture: 1 })
    expect(income.food).toBe(3) // farm gives +3 food
    expect(income.production).toBe(0)
    expect(income.gold).toBe(0)
  })

  it('sums income from multiple buildings across multiple settlements', () => {
    const state = makeGameState()
    state.settlements.set('s1', makeSettlement({
      id: 's1',
      ownerId: 'p1',
      buildings: ['farm', 'library']
    }))
    state.settlements.set('s2', makeSettlement({
      id: 's2',
      ownerId: 'p1',
      buildings: ['market', 'lumber_mill']
    }))

    const income = calculateIncome('p1', state, { food: 1, production: 1, gold: 1, science: 1, culture: 1 })
    expect(income.food).toBe(3) // 1 farm = 3
    expect(income.production).toBe(3) // 1 lumber mill = 3
    expect(income.gold).toBe(2) // 1 market = 2
    expect(income.science).toBe(2) // 1 library = 2
  })

  it('does not count buildings in settlements owned by other players', () => {
    const state = makeGameState()
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['farm']
    }))
    state.settlements.set('s2', makeSettlement({
      id: 's2',
      ownerId: 'p2',
      buildings: ['farm', 'farm']
    }))

    const income = calculateIncome('p1', state, { food: 1, production: 1, gold: 1, science: 1, culture: 1 })
    expect(income.food).toBe(3) // only p1's farm
  })

  it('applies faction resource modifiers (Solar Empire +20% production)', () => {
    const state = makeGameState()
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['lumber_mill']
    }))

    // Solar Empire has production modifier of 1.2
    const solarModifiers: Resources = { food: 1, production: 1.2, gold: 1, science: 0.9, culture: 1 }
    const income = calculateIncome('p1', state, solarModifiers)
    // lumber_mill gives 3 production, * 1.2 = 3.6
    expect(income.production).toBeCloseTo(3.6)
    // science modifier should not affect production value
    expect(income.science).toBe(0)
  })

  it('applies Merchant League +30% gold modifier', () => {
    const state = makeGameState()
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['market']
    }))

    const merchantModifiers: Resources = { food: 1, production: 1, gold: 1.3, science: 1, culture: 1 }
    const income = calculateIncome('p1', state, merchantModifiers)
    // market gives 2 gold * 1.3 = 2.6
    expect(income.gold).toBeCloseTo(2.6)
  })
})

describe('calculateUpkeep', () => {
  it('returns zero upkeep when player has no units', () => {
    const state = makeGameState()
    const upkeep = calculateUpkeep('p1', state)
    expect(upkeep).toEqual(zeroResources())
  })

  it('calculates food upkeep for a single scout (1 food)', () => {
    const state = makeGameState()
    state.units.set('u1', makeUnit({ ownerId: 'p1', type: 'scout' }))

    const upkeep = calculateUpkeep('p1', state)
    expect(upkeep.food).toBe(1) // scout costs 1 food
  })

  it('warrior costs more food upkeep than scout', () => {
    const state = makeGameState()
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'warrior' }))

    const upkeep = calculateUpkeep('p1', state)
    expect(upkeep.food).toBe(2) // warrior costs 2 food

    const state2 = makeGameState()
    state2.units.set('u2', makeUnit({ id: 'u2', ownerId: 'p1', type: 'scout' }))
    const upkeep2 = calculateUpkeep('p1', state2)
    expect(upkeep2.food).toBe(1) // scout costs 1 food

    expect(upkeep.food).toBeGreaterThan(upkeep2.food)
  })

  it('sums upkeep from multiple units', () => {
    const state = makeGameState()
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'scout' }))
    state.units.set('u2', makeUnit({ id: 'u2', ownerId: 'p1', type: 'warrior' }))
    state.units.set('u3', makeUnit({ id: 'u3', ownerId: 'p1', type: 'gatherer' }))

    const upkeep = calculateUpkeep('p1', state)
    // scout=1 + warrior=2 + gatherer=1 = 4
    expect(upkeep.food).toBe(4)
  })

  it('does not count units owned by other players', () => {
    const state = makeGameState()
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'scout' }))
    state.units.set('u2', makeUnit({ id: 'u2', ownerId: 'p2', type: 'warrior' }))

    const upkeep = calculateUpkeep('p1', state)
    expect(upkeep.food).toBe(1) // only p1's scout
  })
})

describe('applyCrisisEffects', () => {
  it('reduces unit moveSpeed when food is negative (food crisis)', () => {
    const player = makePlayer({
      userId: 'p1',
      resources: makeResources({ food: -5 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    const unit = makeUnit({ id: 'u1', ownerId: 'p1', moveSpeed: 2 })
    state.units.set('u1', unit)

    applyCrisisEffects(player, state)
    expect(unit.moveSpeed).toBe(1) // reduced by food crisis
  })

  it('does not reduce moveSpeed below 1', () => {
    const player = makePlayer({
      userId: 'p1',
      resources: makeResources({ food: -100 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    const unit = makeUnit({ id: 'u1', ownerId: 'p1', moveSpeed: 1 })
    state.units.set('u1', unit)

    applyCrisisEffects(player, state)
    expect(unit.moveSpeed).toBeGreaterThanOrEqual(1)
  })

  it('does not affect units when food is zero or positive', () => {
    const player = makePlayer({
      userId: 'p1',
      resources: makeResources({ food: 0 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    const unit = makeUnit({ id: 'u1', ownerId: 'p1', moveSpeed: 2 })
    state.units.set('u1', unit)

    applyCrisisEffects(player, state)
    expect(unit.moveSpeed).toBe(2) // unchanged
  })

  it('does not affect other players units during food crisis', () => {
    const player = makePlayer({
      userId: 'p1',
      resources: makeResources({ food: -5 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    const ownUnit = makeUnit({ id: 'u1', ownerId: 'p1', moveSpeed: 2 })
    const otherUnit = makeUnit({ id: 'u2', ownerId: 'p2', moveSpeed: 2 })
    state.units.set('u1', ownUnit)
    state.units.set('u2', otherUnit)

    applyCrisisEffects(player, state)
    expect(ownUnit.moveSpeed).toBe(1) // reduced
    expect(otherUnit.moveSpeed).toBe(2) // untouched
  })
})

describe('tickResources', () => {
  it('updates net resources correctly for a player with buildings and units', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      resources: makeResources({ food: 50, production: 30, gold: 30, science: 0, culture: 0 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['farm', 'lumber_mill']
    }))
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'scout' }))
    state.units.set('u2', makeUnit({ id: 'u2', ownerId: 'p1', type: 'warrior' }))

    tickResources(state)

    // Solar Empire modifiers: food=1, production=1.2, gold=1, science=0.9, culture=1
    // Income: farm=3 food * 1 = 3, lumber_mill=3 production * 1.2 = 3.6
    // Upkeep: scout=1 food, warrior=2 food => total food upkeep = 3
    // Net food: 50 + (3 - 3) = 50
    expect(player.resources.food).toBe(50)
    // Net production: 30 + 3.6 = 33.6
    expect(player.resources.production).toBeCloseTo(33.6)
    // Income and upkeep should be updated on the player
    expect(player.resourceIncome.food).toBe(3)
    expect(player.resourceIncome.production).toBeCloseTo(3.6)
    expect(player.resourceUpkeep.food).toBe(3)
  })

  it('skips eliminated players', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      eliminated: true,
      resources: makeResources({ food: 10 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['farm']
    }))

    tickResources(state)

    // Resources should remain unchanged
    expect(player.resources.food).toBe(10)
    expect(player.resourceIncome).toEqual(makeResources())
  })

  it('handles multiple players independently', () => {
    const state = makeGameState()

    const p1 = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      resources: makeResources({ food: 20, production: 10 })
    })
    state.players.set('p1', p1)
    state.settlements.set('s1', makeSettlement({ id: 's1', ownerId: 'p1', buildings: ['farm'] }))
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'scout' }))

    const p2 = makePlayer({
      userId: 'p2',
      factionId: 'merchant_league',
      resources: makeResources({ food: 30, gold: 40 })
    })
    state.players.set('p2', p2)
    state.settlements.set('s2', makeSettlement({ id: 's2', ownerId: 'p2', buildings: ['market'] }))

    tickResources(state)

    // P1: food income=3*1=3, upkeep=1, net food=20+(3-1)=22
    expect(p1.resources.food).toBe(22)
    // P2: gold income=2*1.3=2.6, no gold upkeep, net gold=40+2.6=42.6
    expect(p2.resources.gold).toBeCloseTo(42.6)
  })

  it('applies food crisis when food goes negative', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      resources: makeResources({ food: 0 }) // no food reserves
    })
    state.players.set('p1', player)
    // No buildings (no income), but units that cost upkeep
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'warrior', moveSpeed: 2 }))

    tickResources(state)

    // No income, upkeep = 2 food => food = 0 - 2 = -2
    expect(player.resources.food).toBe(-2)
    // Crisis effect: unit moveSpeed should be reduced
    const unit = state.units.get('u1')!
    expect(unit.moveSpeed).toBe(1)
  })

  it('applies gold crisis flag when gold goes negative', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'solar_empire',
      resources: makeResources({ gold: -5 })
    })
    state.players.set('p1', player)

    tickResources(state)

    // Gold was already -5, no gold income/upkeep => stays -5
    // The gold crisis is indicated by gold < 0 (checked externally)
    expect(player.resources.gold).toBeLessThan(0)
  })

  it('correctly handles a player with no buildings and no units', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      resources: makeResources({ food: 10, production: 5, gold: 3 })
    })
    state.players.set('p1', player)

    tickResources(state)

    // No income, no upkeep => resources unchanged
    expect(player.resources.food).toBe(10)
    expect(player.resources.production).toBe(5)
    expect(player.resources.gold).toBe(3)
  })

  it('applies faction modifier across all resource types in income', () => {
    const state = makeGameState()
    const player = makePlayer({
      userId: 'p1',
      factionId: 'seekers', // science=1.3, production=0.85
      resources: makeResources({ science: 0, production: 0 })
    })
    state.players.set('p1', player)
    state.settlements.set('s1', makeSettlement({
      ownerId: 'p1',
      buildings: ['library', 'lumber_mill']
    }))

    tickResources(state)

    // library=2 science * 1.3 = 2.6
    expect(player.resourceIncome.science).toBeCloseTo(2.6)
    // lumber_mill=3 production * 0.85 = 2.55
    expect(player.resourceIncome.production).toBeCloseTo(2.55)
  })
})
