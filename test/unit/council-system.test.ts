import { describe, expect, it } from 'vitest'
import type { GameState, GamePlayer, GameUnit, Resources, Advisor, AdvisorType } from '../../shared/game-types'
import { ADVISOR_TYPES } from '../../shared/game-types'
import { proposeLaw, tickAdvisorLoyalty } from '../../server/game/systems/council-system'

// --- Helpers to build minimal game state for testing ---

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { food: 0, production: 0, gold: 0, science: 0, culture: 0, ...overrides }
}

function makeAdvisors(overrides: Partial<Record<AdvisorType, number>> = {}): Advisor[] {
  const defaults: Record<AdvisorType, number> = {
    general: 50,
    treasurer: 50,
    priest: 50,
    scholar: 50,
    tribune: 50
  }
  const merged = { ...defaults, ...overrides }
  return ADVISOR_TYPES.map(type => ({ type, loyalty: merged[type] }))
}

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: 'p1',
    factionId: 'solar_empire',
    resources: makeResources({ food: 50, production: 30, gold: 30, science: 10, culture: 100 }),
    resourceIncome: makeResources({ food: 5, production: 3, gold: 2, science: 1, culture: 1 }),
    resourceUpkeep: makeResources({ food: 2 }),
    policies: { aggression: 50, expansion: 50, spending: 50, combatPolicy: 'defensive' },
    advisors: makeAdvisors(),
    researchedTechs: [],
    currentResearch: 'writing',
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

describe('proposeLaw', () => {
  it('passes a law with high loyalty advisors (3+ yes votes)', () => {
    // High loyalty advisors should vote yes more easily
    const player = makePlayer({
      advisors: makeAdvisors({ general: 80, treasurer: 80, priest: 80, scholar: 80, tribune: 80 }),
      resources: makeResources({ food: 50, gold: 30, culture: 100, science: 10 }),
      resourceIncome: makeResources({ food: 5, gold: 5, science: 2, culture: 3 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    // Add warriors so general is happy
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'warrior' }))
    state.units.set('u2', makeUnit({ id: 'u2', ownerId: 'p1', type: 'warrior' }))
    state.units.set('u3', makeUnit({ id: 'u3', ownerId: 'p1', type: 'warrior' }))

    // 'festivals' is a society law with no prerequisites, costs 40 culture
    const result = proposeLaw('p1', 'festivals', state)

    expect(result.passed).toBe(true)
    expect(result.lawId).toBe('festivals')
    const yesCount = result.votes.filter(v => v.vote === 'yes').length
    expect(yesCount).toBeGreaterThanOrEqual(3)
    expect(player.passedLaws).toContain('festivals')
  })

  it('fails a law with low loyalty advisors', () => {
    // Low loyalty advisors should vote no unless conditions are great
    const player = makePlayer({
      advisors: makeAdvisors({ general: 10, treasurer: 10, priest: 10, scholar: 10, tribune: 10 }),
      resources: makeResources({ food: -5, gold: -10, culture: 100, science: 0 }),
      resourceIncome: makeResources({ food: 0, gold: 0, science: 0, culture: 0 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    // 'mobilization' is military, all advisors have low loyalty + bad conditions
    const result = proposeLaw('p1', 'mobilization', state)

    expect(result.passed).toBe(false)
    const yesCount = result.votes.filter(v => v.vote === 'yes').length
    expect(yesCount).toBeLessThan(3)
    expect(player.passedLaws).not.toContain('mobilization')
  })

  it('general votes yes for military laws when army is strong', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 60 }),
      resources: makeResources({ culture: 100 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    // Add many warriors for a strong army
    for (let i = 0; i < 5; i++) {
      state.units.set(`w${i}`, makeUnit({ id: `w${i}`, ownerId: 'p1', type: 'warrior' }))
    }

    const result = proposeLaw('p1', 'mobilization', state)
    const generalVote = result.votes.find(v => v.advisor === 'general')!

    expect(generalVote.vote).toBe('yes')
  })

  it('treasurer votes no during gold deficit', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ treasurer: 50 }),
      resources: makeResources({ gold: -10, culture: 100 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    // 'taxation' is economy law, costs 50 culture
    const result = proposeLaw('p1', 'taxation', state)
    const treasurerVote = result.votes.find(v => v.advisor === 'treasurer')!

    expect(treasurerVote.vote).toBe('no')
  })

  it('tribune votes no during famine', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ tribune: 50 }),
      resources: makeResources({ food: -5, culture: 100 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const result = proposeLaw('p1', 'festivals', state)
    const tribuneVote = result.votes.find(v => v.advisor === 'tribune')!

    expect(tribuneVote.vote).toBe('no')
  })

  it('deducts culture cost on proposal', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 80, treasurer: 80, priest: 80, scholar: 80, tribune: 80 }),
      resources: makeResources({ food: 50, gold: 30, culture: 100, science: 10 }),
      resourceIncome: makeResources({ food: 5, gold: 5, science: 2, culture: 3 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'warrior' }))

    const cultureBefore = player.resources.culture
    proposeLaw('p1', 'festivals', state) // festivals costs 40 culture

    expect(player.resources.culture).toBe(cultureBefore - 40)
  })

  it('cannot propose law if prerequisites not met', () => {
    const player = makePlayer({
      passedLaws: [], // no laws passed, but 'free_trade' requires 'taxation'
      resources: makeResources({ culture: 200 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    expect(() => proposeLaw('p1', 'free_trade', state)).toThrow('Law prerequisites not met')
  })

  it('cannot propose law without enough culture', () => {
    const player = makePlayer({
      resources: makeResources({ culture: 5 }) // festivals costs 40
    })
    const state = makeGameState()
    state.players.set('p1', player)

    expect(() => proposeLaw('p1', 'festivals', state)).toThrow('Not enough culture')
  })

  it('passed law applies its effects to player state', () => {
    // Use 'taxation' which has resource_modifier +20% gold and loyalty_change -5 tribune
    const player = makePlayer({
      advisors: makeAdvisors({ general: 90, treasurer: 90, priest: 90, scholar: 90, tribune: 90 }),
      resources: makeResources({ food: 50, gold: 30, culture: 100, science: 10 }),
      resourceIncome: makeResources({ food: 5, gold: 5, science: 2, culture: 3 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set('u1', makeUnit({ id: 'u1', ownerId: 'p1', type: 'warrior' }))
    state.units.set('u2', makeUnit({ id: 'u2', ownerId: 'p1', type: 'warrior' }))

    const tribuneLoyaltyBefore = player.advisors.find(a => a.type === 'tribune')!.loyalty

    const result = proposeLaw('p1', 'taxation', state)

    expect(result.passed).toBe(true)
    // Check loyalty_change effect was applied: tribune -5
    const tribuneAfter = player.advisors.find(a => a.type === 'tribune')!.loyalty
    expect(tribuneAfter).toBe(tribuneLoyaltyBefore - 5)
  })

  it('does not apply law effects when vote fails', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 10, treasurer: 10, priest: 10, scholar: 10, tribune: 10 }),
      resources: makeResources({ food: -5, gold: -10, culture: 100, science: 0 }),
      resourceIncome: makeResources()
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const tribuneLoyaltyBefore = player.advisors.find(a => a.type === 'tribune')!.loyalty

    const result = proposeLaw('p1', 'taxation', state)

    expect(result.passed).toBe(false)
    // Tribune loyalty should not have changed
    const tribuneAfter = player.advisors.find(a => a.type === 'tribune')!.loyalty
    expect(tribuneAfter).toBe(tribuneLoyaltyBefore)
    expect(player.passedLaws).not.toContain('taxation')
  })

  it('scholar votes no for laws with science penalties', () => {
    // martial_law has science -50% effect
    const player = makePlayer({
      advisors: makeAdvisors({ scholar: 50 }),
      passedLaws: ['mobilization'], // prerequisite for martial_law
      resources: makeResources({ culture: 200 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const result = proposeLaw('p1', 'martial_law', state)
    const scholarVote = result.votes.find(v => v.advisor === 'scholar')!

    expect(scholarVote.vote).toBe('no')
  })

  it('priest votes yes for society/culture laws when culture is flowing', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ priest: 60 }),
      resources: makeResources({ culture: 100 }),
      resourceIncome: makeResources({ culture: 5 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const result = proposeLaw('p1', 'festivals', state)
    const priestVote = result.votes.find(v => v.advisor === 'priest')!

    expect(priestVote.vote).toBe('yes')
  })
})

describe('tickAdvisorLoyalty', () => {
  it('general loyalty increases when player has many warriors', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 50 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    // Add 4 warriors: strong army
    for (let i = 0; i < 4; i++) {
      state.units.set(`w${i}`, makeUnit({ id: `w${i}`, ownerId: 'p1', type: 'warrior' }))
    }

    const loyaltyBefore = player.advisors.find(a => a.type === 'general')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'general')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore + 1)
  })

  it('general loyalty decreases when player has few warriors', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 50 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    // No warriors at all

    const loyaltyBefore = player.advisors.find(a => a.type === 'general')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'general')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore - 1)
  })

  it('treasurer loyalty increases when gold is positive', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ treasurer: 50 }),
      resources: makeResources({ gold: 10 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'treasurer')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'treasurer')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore + 1)
  })

  it('treasurer loyalty decreases when gold is negative', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ treasurer: 50 }),
      resources: makeResources({ gold: -5 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'treasurer')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'treasurer')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore - 1)
  })

  it('priest loyalty increases when culture income is positive', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ priest: 50 }),
      resourceIncome: makeResources({ culture: 3 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'priest')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'priest')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore + 1)
  })

  it('priest loyalty decreases when culture income is zero or low', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ priest: 50 }),
      resourceIncome: makeResources({ culture: 0 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'priest')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'priest')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore - 1)
  })

  it('scholar loyalty increases when researching', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ scholar: 50 }),
      currentResearch: 'writing'
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'scholar')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'scholar')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore + 1)
  })

  it('scholar loyalty decreases when not researching', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ scholar: 50 }),
      currentResearch: null
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'scholar')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'scholar')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore - 1)
  })

  it('tribune loyalty increases when food is positive', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ tribune: 50 }),
      resources: makeResources({ food: 20 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'tribune')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'tribune')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore + 1)
  })

  it('tribune loyalty decreases when food is negative', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ tribune: 50 }),
      resources: makeResources({ food: -5 })
    })
    const state = makeGameState()
    state.players.set('p1', player)

    const loyaltyBefore = player.advisors.find(a => a.type === 'tribune')!.loyalty
    tickAdvisorLoyalty(state)
    const loyaltyAfter = player.advisors.find(a => a.type === 'tribune')!.loyalty

    expect(loyaltyAfter).toBe(loyaltyBefore - 1)
  })

  it('loyalty is clamped between 0 and 100', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 100, treasurer: 0 }),
      resources: makeResources({ gold: -5 })
    })
    const state = makeGameState()
    state.players.set('p1', player)
    // Add warriors so general would gain loyalty (but already at 100)
    for (let i = 0; i < 4; i++) {
      state.units.set(`w${i}`, makeUnit({ id: `w${i}`, ownerId: 'p1', type: 'warrior' }))
    }

    tickAdvisorLoyalty(state)

    const generalLoyalty = player.advisors.find(a => a.type === 'general')!.loyalty
    const treasurerLoyalty = player.advisors.find(a => a.type === 'treasurer')!.loyalty

    expect(generalLoyalty).toBe(100)
    expect(treasurerLoyalty).toBe(0)
  })

  it('skips eliminated players', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 50 }),
      eliminated: true
    })
    const state = makeGameState()
    state.players.set('p1', player)

    tickAdvisorLoyalty(state)

    const generalLoyalty = player.advisors.find(a => a.type === 'general')!.loyalty
    expect(generalLoyalty).toBe(50)
  })

  it('loyalty increases when domain prospers (all conditions positive)', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 50, treasurer: 50, priest: 50, scholar: 50, tribune: 50 }),
      resources: makeResources({ food: 50, gold: 30 }),
      resourceIncome: makeResources({ culture: 5 }),
      currentResearch: 'writing'
    })
    const state = makeGameState()
    state.players.set('p1', player)
    // Warriors for general
    for (let i = 0; i < 4; i++) {
      state.units.set(`w${i}`, makeUnit({ id: `w${i}`, ownerId: 'p1', type: 'warrior' }))
    }

    tickAdvisorLoyalty(state)

    // All advisors should have gained loyalty
    for (const advisor of player.advisors) {
      expect(advisor.loyalty).toBe(51)
    }
  })

  it('loyalty decreases during domain crisis (all conditions negative)', () => {
    const player = makePlayer({
      advisors: makeAdvisors({ general: 50, treasurer: 50, priest: 50, scholar: 50, tribune: 50 }),
      resources: makeResources({ food: -5, gold: -10 }),
      resourceIncome: makeResources({ culture: 0 }),
      currentResearch: null
    })
    const state = makeGameState()
    state.players.set('p1', player)
    // No warriors for general

    tickAdvisorLoyalty(state)

    // All advisors should have lost loyalty
    for (const advisor of player.advisors) {
      expect(advisor.loyalty).toBe(49)
    }
  })
})
