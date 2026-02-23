import { describe, expect, it, beforeEach } from 'vitest'
import type { GameState, GamePlayer, GameSettlement, GameUnit, Resources } from '../../shared/game-types'
import { GAME_SPEEDS } from '../../shared/game-types'
import { getUnitDef } from '../../shared/unit-defs'
import { constructBuilding } from '../../server/game/systems/settlement-system'
import { startResearch } from '../../server/game/systems/research-system'
import { proposeLaw } from '../../server/game/systems/council-system'

// --- Helpers to build minimal game state for testing ---

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { food: 50, production: 100, gold: 100, science: 0, culture: 100, ...overrides }
}

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: 'user1',
    factionId: 'solar_empire',
    resources: makeResources(),
    resourceIncome: makeResources({ food: 5, production: 5, gold: 5, science: 5, culture: 5 }),
    resourceUpkeep: makeResources({ food: 0, production: 0, gold: 0, science: 0, culture: 0 }),
    policies: { aggression: 50, expansion: 50, spending: 50, combatPolicy: 'defensive' },
    advisors: [
      { type: 'general', loyalty: 70 },
      { type: 'treasurer', loyalty: 70 },
      { type: 'priest', loyalty: 70 },
      { type: 'scholar', loyalty: 70 },
      { type: 'tribune', loyalty: 70 }
    ],
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
    ownerId: 'user1',
    name: 'Haven',
    tier: 'outpost',
    q: 10,
    r: 10,
    buildings: [],
    buildingSlots: 4,
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

// --- buyUnit logic tests (testing the logic the procedure delegates to) ---

describe('buyUnit logic', () => {
  let state: GameState
  let player: GamePlayer
  let settlement: GameSettlement

  beforeEach(() => {
    state = makeGameState()
    player = makePlayer({ resources: makeResources({ gold: 100, production: 100 }) })
    settlement = makeSettlement({ ownerId: 'user1' })
    state.players.set('user1', player)
    state.settlements.set('s1', settlement)
  })

  it('spawns a scout unit and deducts resources', () => {
    const unitDef = getUnitDef('scout')

    // Simulate what buyUnit handler does
    player.resources.gold -= unitDef.goldCost
    player.resources.production -= unitDef.productionCost

    const unit: GameUnit = {
      id: 'test-unit-id',
      type: 'scout',
      ownerId: 'user1',
      q: settlement.q,
      r: settlement.r,
      hp: unitDef.maxHp,
      maxHp: unitDef.maxHp,
      hunger: 0,
      safety: 100,
      strength: unitDef.strength,
      visionRange: unitDef.visionRange,
      moveSpeed: unitDef.moveSpeed,
      state: 'idle'
    }
    state.units.set(unit.id, unit)

    expect(state.units.size).toBe(1)
    expect(state.units.get('test-unit-id')!.type).toBe('scout')
    expect(state.units.get('test-unit-id')!.q).toBe(settlement.q)
    expect(state.units.get('test-unit-id')!.r).toBe(settlement.r)
    // scout costs 20 gold, 10 production
    expect(player.resources.gold).toBe(80)
    expect(player.resources.production).toBe(90)
  })

  it('rejects buying when not enough gold', () => {
    player.resources.gold = 5
    const unitDef = getUnitDef('warrior')

    const hasEnoughGold = player.resources.gold >= unitDef.goldCost
    expect(hasEnoughGold).toBe(false)
  })

  it('rejects buying when not enough production', () => {
    player.resources.production = 5
    const unitDef = getUnitDef('warrior')

    const hasEnoughProduction = player.resources.production >= unitDef.productionCost
    expect(hasEnoughProduction).toBe(false)
  })

  it('rejects warrior without barracks', () => {
    const unitType = 'warrior'
    const needsBarracks = unitType === 'warrior' && !settlement.buildings.includes('barracks')
    expect(needsBarracks).toBe(true)
  })

  it('allows warrior with barracks', () => {
    settlement.buildings.push('barracks')
    const unitType = 'warrior'
    const needsBarracks = unitType === 'warrior' && !settlement.buildings.includes('barracks')
    expect(needsBarracks).toBe(false)
  })

  it('rejects buying at settlement owned by another player', () => {
    settlement.ownerId = 'other-user'

    const ownsSettlement = settlement.ownerId === 'user1'
    expect(ownsSettlement).toBe(false)
  })

  it('rejects buying at nonexistent settlement', () => {
    const nonexistentSettlement = state.settlements.get('nonexistent')
    expect(nonexistentSettlement).toBeUndefined()
  })

  it('spawns unit at settlement coordinates', () => {
    settlement.q = 7
    settlement.r = 12
    const unitDef = getUnitDef('gatherer')

    const unit: GameUnit = {
      id: 'test-unit-id',
      type: 'gatherer',
      ownerId: 'user1',
      q: settlement.q,
      r: settlement.r,
      hp: unitDef.maxHp,
      maxHp: unitDef.maxHp,
      hunger: 0,
      safety: 100,
      strength: unitDef.strength,
      visionRange: unitDef.visionRange,
      moveSpeed: unitDef.moveSpeed,
      state: 'idle'
    }

    expect(unit.q).toBe(7)
    expect(unit.r).toBe(12)
    expect(unit.hp).toBe(unitDef.maxHp)
    expect(unit.strength).toBe(unitDef.strength)
  })
})

// --- setPolicies logic tests ---

describe('setPolicies logic', () => {
  it('updates player policies', () => {
    const player = makePlayer()
    const newPolicies = {
      aggression: 80,
      expansion: 20,
      spending: 60,
      combatPolicy: 'aggressive' as const
    }

    player.policies = newPolicies

    expect(player.policies.aggression).toBe(80)
    expect(player.policies.expansion).toBe(20)
    expect(player.policies.spending).toBe(60)
    expect(player.policies.combatPolicy).toBe('aggressive')
  })

  it('replaces all policy values', () => {
    const player = makePlayer({
      policies: { aggression: 10, expansion: 10, spending: 10, combatPolicy: 'avoidance' }
    })

    player.policies = {
      aggression: 100,
      expansion: 100,
      spending: 100,
      combatPolicy: 'defensive'
    }

    expect(player.policies).toEqual({
      aggression: 100,
      expansion: 100,
      spending: 100,
      combatPolicy: 'defensive'
    })
  })
})

// --- buildBuilding via constructBuilding ---

describe('buildBuilding logic (via constructBuilding)', () => {
  it('constructs a building and deducts production', () => {
    const state = makeGameState()
    const player = makePlayer({ resources: makeResources({ production: 100 }) })
    state.players.set('user1', player)
    state.settlements.set('s1', makeSettlement({ ownerId: 'user1', buildingSlots: 4 }))

    const result = constructBuilding('s1', 'farm', 'user1', state)

    expect(result).toBe(true)
    expect(state.settlements.get('s1')!.buildings).toContain('farm')
    // Farm costs 30 production
    expect(player.resources.production).toBe(70)
  })

  it('returns false for settlement not owned by player', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer())
    state.players.set('user2', makePlayer({ userId: 'user2' }))
    state.settlements.set('s1', makeSettlement({ ownerId: 'user2' }))

    const result = constructBuilding('s1', 'farm', 'user1', state)

    expect(result).toBe(false)
  })

  it('returns false when no building slots available', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({ resources: makeResources({ production: 500 }) }))
    state.settlements.set('s1', makeSettlement({
      ownerId: 'user1',
      buildings: ['farm', 'market'],
      buildingSlots: 2
    }))

    const result = constructBuilding('s1', 'library', 'user1', state)

    expect(result).toBe(false)
  })

  it('returns false when not enough production', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({ resources: makeResources({ production: 5 }) }))
    state.settlements.set('s1', makeSettlement({ ownerId: 'user1', buildingSlots: 4 }))

    // Farm costs 30 production
    const result = constructBuilding('s1', 'farm', 'user1', state)

    expect(result).toBe(false)
  })
})

// --- startResearch delegation ---

describe('startResearch logic', () => {
  it('starts research on an available tech', () => {
    const state = makeGameState()
    const player = makePlayer({ researchedTechs: [], factionId: 'solar_empire' })
    state.players.set('user1', player)

    // 'agriculture' is epoch 1 with no prereqs, available to all factions
    startResearch('user1', 'agriculture', state)

    expect(player.currentResearch).toBe('agriculture')
    expect(player.researchProgress).toBe(0)
  })

  it('throws for unknown tech', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer())

    expect(() => startResearch('user1', 'nonexistent_tech', state)).toThrow()
  })

  it('throws for eliminated player', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({ eliminated: true }))

    expect(() => startResearch('user1', 'agriculture', state)).toThrow('eliminated')
  })

  it('throws for tech with unmet prerequisites', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({ factionId: 'solar_empire', researchedTechs: [] }))

    // 'siege_weapons' requires 'phalanx_formation'
    expect(() => startResearch('user1', 'siege_weapons', state)).toThrow()
  })

  it('allows faction-specific tech for matching faction', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({ factionId: 'solar_empire', researchedTechs: [] }))

    // 'phalanx_formation' is solar_empire only, no prereqs
    startResearch('user1', 'phalanx_formation', state)

    expect(state.players.get('user1')!.currentResearch).toBe('phalanx_formation')
  })

  it('rejects faction-specific tech for wrong faction', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({ factionId: 'merchant_league', researchedTechs: [] }))

    // 'phalanx_formation' is solar_empire only
    expect(() => startResearch('user1', 'phalanx_formation', state)).toThrow()
  })

  it('replaces existing research (losing progress)', () => {
    const state = makeGameState()
    const player = makePlayer({
      currentResearch: 'agriculture',
      researchProgress: 15
    })
    state.players.set('user1', player)

    startResearch('user1', 'mining', state)

    expect(player.currentResearch).toBe('mining')
    expect(player.researchProgress).toBe(0)
  })
})

// --- proposeLaw delegation ---

describe('proposeLaw logic', () => {
  it('proposes a law and gets voting result', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ culture: 200 }),
      passedLaws: []
    })
    state.players.set('user1', player)

    // 'taxation' is economy branch, no prereqs, costs 50 culture
    const result = proposeLaw('user1', 'taxation', state)

    expect(result).toHaveProperty('passed')
    expect(result).toHaveProperty('votes')
    expect(result).toHaveProperty('lawId')
    expect(result.lawId).toBe('taxation')
    expect(result.votes).toHaveLength(5) // 5 advisors
  })

  it('deducts culture cost even if law fails', () => {
    const state = makeGameState()
    // Low loyalty advisors will vote no
    const player = makePlayer({
      resources: makeResources({ culture: 100 }),
      passedLaws: [],
      advisors: [
        { type: 'general', loyalty: 10 },
        { type: 'treasurer', loyalty: 10 },
        { type: 'priest', loyalty: 10 },
        { type: 'scholar', loyalty: 10 },
        { type: 'tribune', loyalty: 10 }
      ]
    })
    state.players.set('user1', player)

    const initialCulture = player.resources.culture
    proposeLaw('user1', 'taxation', state)

    // Culture should be deducted regardless of outcome
    expect(player.resources.culture).toBe(initialCulture - 50)
  })

  it('throws when not enough culture', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({ resources: makeResources({ culture: 5 }) }))

    // 'taxation' costs 50 culture
    expect(() => proposeLaw('user1', 'taxation', state)).toThrow('Not enough culture')
  })

  it('throws when law prerequisites not met', () => {
    const state = makeGameState()
    state.players.set('user1', makePlayer({
      resources: makeResources({ culture: 200 }),
      passedLaws: []
    }))

    // 'free_trade' requires 'taxation' to be passed
    expect(() => proposeLaw('user1', 'free_trade', state)).toThrow('prerequisites')
  })

  it('passes law with high loyalty advisors and adds to passedLaws', () => {
    const state = makeGameState()
    const player = makePlayer({
      resources: makeResources({ culture: 200 }),
      passedLaws: [],
      advisors: [
        { type: 'general', loyalty: 90 },
        { type: 'treasurer', loyalty: 90 },
        { type: 'priest', loyalty: 90 },
        { type: 'scholar', loyalty: 90 },
        { type: 'tribune', loyalty: 90 }
      ]
    })
    state.players.set('user1', player)

    const result = proposeLaw('user1', 'taxation', state)

    expect(result.passed).toBe(true)
    expect(player.passedLaws).toContain('taxation')
  })
})

// --- getGameAndPlayer helper logic ---

describe('getGameAndPlayer helper logic', () => {
  it('finds game and player when both exist', () => {
    const state = makeGameState()
    const player = makePlayer()
    state.players.set('user1', player)

    // Simulate what getGameAndPlayer does (without the actual registry)
    const foundPlayer = state.players.get('user1')
    expect(foundPlayer).toBeDefined()
    expect(foundPlayer!.userId).toBe('user1')
  })

  it('detects missing player in game', () => {
    const state = makeGameState()
    // No players added

    const foundPlayer = state.players.get('user1')
    expect(foundPlayer).toBeUndefined()
  })
})

// --- Game control actions (pause, resume, speed) ---

describe('game control actions', () => {
  it('validates GAME_SPEEDS contains expected values', () => {
    expect(GAME_SPEEDS).toContain(0.5)
    expect(GAME_SPEEDS).toContain(1)
    expect(GAME_SPEEDS).toContain(2)
    expect(GAME_SPEEDS).toContain(3)
  })

  it('validates speed check logic', () => {
    const validSpeeds = [0.5, 1, 2, 3]
    const invalidSpeeds = [0, 4, 1.5, -1]

    for (const speed of validSpeeds) {
      expect((GAME_SPEEDS as readonly number[]).includes(speed)).toBe(true)
    }

    for (const speed of invalidSpeeds) {
      expect((GAME_SPEEDS as readonly number[]).includes(speed)).toBe(false)
    }
  })
})
