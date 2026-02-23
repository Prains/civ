import { describe, expect, it } from 'vitest'
import type { GameState, GameUnit, GamePlayer, GameSettlement } from '../../shared/game-types'
import {
  tickUnitAI,
  decideAction,
  updateHunger,
  updateSafety
} from '../../server/game/systems/unit-ai-system'
import { getFaction } from '../../shared/faction-defs'

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
    players: new Map(),
    units: new Map(),
    settlements: new Map(),
    diplomacy: [],
    neutralUnits: new Map(),
    barbarianCamps: [],
    ...overrides
  }
}

// --- updateHunger ---

describe('updateHunger', () => {
  it('increases hunger by 1 each tick', () => {
    const unit = makeUnit({ hunger: 10 })
    updateHunger(unit)
    expect(unit.hunger).toBe(11)
  })

  it('caps hunger at 100', () => {
    const unit = makeUnit({ hunger: 100 })
    updateHunger(unit)
    expect(unit.hunger).toBe(100)
  })

  it('starts from 0 and increments', () => {
    const unit = makeUnit({ hunger: 0 })
    updateHunger(unit)
    expect(unit.hunger).toBe(1)
  })
})

// --- updateSafety ---

describe('updateSafety', () => {
  it('sets safety to 100 when no enemies nearby', () => {
    const unit = makeUnit({ safety: 50, ownerId: 'p1' })
    const state = makeGameState()
    state.units.set(unit.id, unit)

    updateSafety(unit, state)
    expect(unit.safety).toBe(100)
  })

  it('reduces safety when enemy units are within vision range', () => {
    const unit = makeUnit({ safety: 100, ownerId: 'p1', q: 5, r: 5, visionRange: 4 })
    const enemy = makeUnit({ id: 'e1', ownerId: 'p2', q: 6, r: 5, strength: 8 })

    const state = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })
    state.units.set(unit.id, unit)
    state.units.set(enemy.id, enemy)

    updateSafety(unit, state)
    expect(unit.safety).toBeLessThan(100)
  })

  it('reduces safety more with multiple enemies', () => {
    const unit = makeUnit({ safety: 100, ownerId: 'p1', q: 5, r: 5, visionRange: 4 })
    const enemy1 = makeUnit({ id: 'e1', ownerId: 'p2', q: 6, r: 5, strength: 8 })
    const enemy2 = makeUnit({ id: 'e2', ownerId: 'p2', q: 4, r: 5, strength: 8 })

    const state = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })
    state.units.set(unit.id, unit)
    state.units.set(enemy1.id, enemy1)
    state.units.set(enemy2.id, enemy2)

    updateSafety(unit, state)

    // Also check with just one enemy for comparison
    const unitSingle = makeUnit({ safety: 100, ownerId: 'p1', q: 5, r: 5, visionRange: 4 })
    const stateSingle = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })
    stateSingle.units.set(unitSingle.id, unitSingle)
    stateSingle.units.set(enemy1.id, enemy1)

    updateSafety(unitSingle, stateSingle)
    expect(unit.safety).toBeLessThan(unitSingle.safety)
  })

  it('does not count enemies beyond vision range', () => {
    const unit = makeUnit({ safety: 100, ownerId: 'p1', q: 5, r: 5, visionRange: 2 })
    const farEnemy = makeUnit({ id: 'e1', ownerId: 'p2', q: 15, r: 15, strength: 8 })

    const state = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })
    state.units.set(unit.id, unit)
    state.units.set(farEnemy.id, farEnemy)

    updateSafety(unit, state)
    expect(unit.safety).toBe(100)
  })

  it('considers neutral units as threats', () => {
    const unit = makeUnit({ safety: 100, ownerId: 'p1', q: 5, r: 5, visionRange: 4 })
    const barbarian = makeUnit({ id: 'n1', ownerId: 'neutral', q: 6, r: 5, strength: 5 })

    const state = makeGameState()
    state.units.set(unit.id, unit)
    state.neutralUnits.set(barbarian.id, barbarian)

    updateSafety(unit, state)
    expect(unit.safety).toBeLessThan(100)
  })
})

// --- decideAction: hunger-based behavior ---

describe('decideAction - hunger', () => {
  it('unit with hunger > 80 returns to nearest settlement', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const unit = makeUnit({ hunger: 85, ownerId: 'p1', q: 10, r: 10 })
    const settlement = makeSettlement({ q: 5, r: 5, ownerId: 'p1' })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)
    state.settlements.set(settlement.id, settlement)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('return_to_base')
    if (action.type === 'return_to_base') {
      expect(action.targetQ).toBe(5)
      expect(action.targetR).toBe(5)
    }
  })

  it('unit with hunger > 80 picks closest settlement', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const unit = makeUnit({ hunger: 85, ownerId: 'p1', q: 10, r: 10 })
    const farSettlement = makeSettlement({ id: 's-far', q: 1, r: 1, ownerId: 'p1' })
    const nearSettlement = makeSettlement({ id: 's-near', q: 9, r: 10, ownerId: 'p1' })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)
    state.settlements.set(farSettlement.id, farSettlement)
    state.settlements.set(nearSettlement.id, nearSettlement)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('return_to_base')
    if (action.type === 'return_to_base') {
      expect(action.targetQ).toBe(9)
      expect(action.targetR).toBe(10)
    }
  })

  it('unit with hunger > 80 and no settlements idles', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const unit = makeUnit({ hunger: 85, ownerId: 'p1', q: 10, r: 10 })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('idle')
  })
})

// --- decideAction: safety-based behavior ---

describe('decideAction - safety', () => {
  it('unit with safety < 20 retreats away from enemies', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    // safety = 10, below the default threshold of ~20
    const unit = makeUnit({ hunger: 0, safety: 10, ownerId: 'p1', q: 5, r: 5, visionRange: 4 })
    const enemy = makeUnit({ id: 'e1', ownerId: 'p2', q: 6, r: 5, strength: 8 })

    const state = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })
    state.players.set('p1', player)
    state.players.set('p2', makePlayer({ userId: 'p2', factionId: 'merchant_league' }))
    state.units.set(unit.id, unit)
    state.units.set(enemy.id, enemy)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('retreat')
    if (action.type === 'retreat') {
      // Retreats away from enemy at (6,5), so target should be to the left
      expect(action.targetQ).toBeLessThan(unit.q)
    }
  })

  it('unit with safety above threshold does not retreat', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const unit = makeUnit({ hunger: 0, safety: 80, ownerId: 'p1', q: 5, r: 5 })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).not.toBe('retreat')
  })
})

// --- decideAction: type-specific behavior (needs met) ---

describe('decideAction - scout with met needs follows curiosity', () => {
  it('scout explores toward nearest unexplored tile', () => {
    const player = makePlayer({
      // Fog map: mark most tiles as explored, leave some unexplored
      fogMap: (() => {
        const fog = new Uint8Array(400).fill(1) // all explored
        // Leave tiles at row 15 unexplored
        for (let q = 0; q < 20; q++) {
          fog[15 * 20 + q] = 0
        }
        return fog
      })()
    })
    const faction = getFaction(player.factionId)
    const unit = makeUnit({ hunger: 0, safety: 100, type: 'scout', ownerId: 'p1', q: 5, r: 5 })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('explore')
    if (action.type === 'explore') {
      // Should target an unexplored tile
      const targetIndex = action.targetR * 20 + action.targetQ
      expect(player.fogMap[targetIndex]).toBe(0)
    }
  })

  it('scout idles when all tiles are explored', () => {
    const player = makePlayer({
      fogMap: new Uint8Array(400).fill(1) // all explored
    })
    const faction = getFaction(player.factionId)
    const unit = makeUnit({ hunger: 0, safety: 100, type: 'scout', ownerId: 'p1', q: 5, r: 5 })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('idle')
  })
})

describe('decideAction - gatherer with met needs seeks resource tile', () => {
  it('gatherer seeks a resource tile near settlement', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const settlement = makeSettlement({ q: 5, r: 5, ownerId: 'p1', gatherRadius: 2 })
    // Gatherer placed near a settlement
    const unit = makeUnit({
      hunger: 0,
      safety: 100,
      type: 'gatherer',
      ownerId: 'p1',
      q: 5,
      r: 5
    })

    const state = makeGameState()
    // Terrain: put a forest tile (3) at (6,5) which is a resource tile
    state.terrain[5 * 20 + 6] = 3
    state.players.set('p1', player)
    state.units.set(unit.id, unit)
    state.settlements.set(settlement.id, settlement)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('gather')
    if (action.type === 'gather') {
      // Should target a resource tile within gather radius of a settlement
      expect(action.targetQ).toBeDefined()
      expect(action.targetR).toBeDefined()
    }
  })
})

describe('decideAction - warrior with met needs patrols territory', () => {
  it('warrior patrols when no enemies visible', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const settlement = makeSettlement({ q: 5, r: 5, ownerId: 'p1' })
    const unit = makeUnit({
      hunger: 0,
      safety: 100,
      type: 'warrior',
      ownerId: 'p1',
      q: 5,
      r: 5,
      strength: 8,
      visionRange: 2
    })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)
    state.settlements.set(settlement.id, settlement)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('patrol')
  })

  it('warrior attacks when enemies are visible', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const unit = makeUnit({
      hunger: 0,
      safety: 60, // Above safety threshold, so won't retreat
      type: 'warrior',
      ownerId: 'p1',
      q: 5,
      r: 5,
      strength: 8,
      visionRange: 2
    })
    const enemy = makeUnit({ id: 'e1', ownerId: 'p2', q: 6, r: 5, strength: 4 })

    const state = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })
    state.players.set('p1', player)
    state.players.set('p2', makePlayer({ userId: 'p2' }))
    state.units.set(unit.id, unit)
    state.units.set(enemy.id, enemy)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('attack')
    if (action.type === 'attack') {
      expect(action.targetQ).toBe(6)
      expect(action.targetR).toBe(5)
    }
  })
})

// --- Faction modifier changes thresholds ---

describe('decideAction - faction modifiers', () => {
  it('Solar Empire warrior attacks sooner (lower effective safety threshold)', () => {
    // Solar Empire has aggression modifier 1.3 which makes the safety threshold lower
    // This means they tolerate more danger before retreating
    const solarPlayer = makePlayer({ factionId: 'solar_empire' })
    const solarFaction = getFaction('solar_empire')

    // Merchant League has aggression modifier 0.7 which raises the safety threshold
    const merchantPlayer = makePlayer({ userId: 'p2', factionId: 'merchant_league' })
    const merchantFaction = getFaction('merchant_league')

    // Both warriors with same safety level
    const solarWarrior = makeUnit({
      id: 'sw',
      hunger: 0,
      safety: 15, // Low safety
      type: 'warrior',
      ownerId: 'p1',
      q: 5,
      r: 5,
      strength: 8,
      visionRange: 2
    })

    const merchantWarrior = makeUnit({
      id: 'mw',
      hunger: 0,
      safety: 15, // Same low safety
      type: 'warrior',
      ownerId: 'p2',
      q: 5,
      r: 5,
      strength: 8,
      visionRange: 2
    })

    const enemy = makeUnit({ id: 'e1', ownerId: 'p3', q: 6, r: 5, strength: 8 })

    // Solar empire state
    const solarState = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p3', status: 'war' }]
    })
    solarState.players.set('p1', solarPlayer)
    solarState.units.set(solarWarrior.id, solarWarrior)
    solarState.units.set(enemy.id, enemy)

    // Merchant league state
    const merchantState = makeGameState({
      diplomacy: [{ player1Id: 'p2', player2Id: 'p3', status: 'war' }]
    })
    merchantState.players.set('p2', merchantPlayer)
    merchantState.units.set(merchantWarrior.id, merchantWarrior)
    merchantState.units.set(enemy.id, enemy)

    const solarAction = decideAction(solarWarrior, solarPlayer, solarFaction, solarState)
    const merchantAction = decideAction(merchantWarrior, merchantPlayer, merchantFaction, merchantState)

    // Solar Empire warrior should NOT retreat (aggression factor lowers their safety threshold)
    // Merchant League warrior SHOULD retreat (safety factor raises their threshold)
    expect(solarAction.type).not.toBe('retreat')
    expect(merchantAction.type).toBe('retreat')
  })
})

// --- Player policy shifts priorities ---

describe('decideAction - player policy', () => {
  it('high aggression lowers safety threshold (warriors more aggressive)', () => {
    const aggressivePlayer = makePlayer({
      policies: { aggression: 100, expansion: 50, spending: 50, combatPolicy: 'aggressive' }
    })
    const defensivePlayer = makePlayer({
      userId: 'p2',
      policies: { aggression: 0, expansion: 50, spending: 50, combatPolicy: 'defensive' }
    })
    const faction = getFaction('solar_empire')

    const enemy = makeUnit({ id: 'e1', ownerId: 'p3', q: 6, r: 5, strength: 8 })

    const aggressiveWarrior = makeUnit({
      id: 'aw',
      hunger: 0,
      safety: 15,
      type: 'warrior',
      ownerId: 'p1',
      q: 5,
      r: 5,
      strength: 8,
      visionRange: 2
    })

    const defensiveWarrior = makeUnit({
      id: 'dw',
      hunger: 0,
      safety: 15,
      type: 'warrior',
      ownerId: 'p2',
      q: 5,
      r: 5,
      strength: 8,
      visionRange: 2
    })

    // Aggressive player state
    const aggState = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p3', status: 'war' }]
    })
    aggState.players.set('p1', aggressivePlayer)
    aggState.units.set(aggressiveWarrior.id, aggressiveWarrior)
    aggState.units.set(enemy.id, enemy)

    // Defensive player state
    const defState = makeGameState({
      diplomacy: [{ player1Id: 'p2', player2Id: 'p3', status: 'war' }]
    })
    defState.players.set('p2', defensivePlayer)
    defState.units.set(defensiveWarrior.id, defensiveWarrior)
    defState.units.set(enemy.id, enemy)

    const aggAction = decideAction(aggressiveWarrior, aggressivePlayer, faction, aggState)
    const defAction = decideAction(defensiveWarrior, defensivePlayer, faction, defState)

    // Aggressive player's warrior should attack (low safety threshold due to high aggression)
    // Defensive player's warrior should retreat (high safety threshold due to zero aggression)
    expect(aggAction.type).not.toBe('retreat')
    expect(defAction.type).toBe('retreat')
  })
})

// --- Settler behavior ---

describe('decideAction - settler', () => {
  it('settler seeks suitable settlement location', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const existingSettlement = makeSettlement({ q: 5, r: 5, ownerId: 'p1' })
    const unit = makeUnit({
      hunger: 0,
      safety: 100,
      type: 'settler',
      ownerId: 'p1',
      q: 5,
      r: 5,
      strength: 0
    })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)
    state.settlements.set(existingSettlement.id, existingSettlement)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('settle')
    if (action.type === 'settle') {
      // Target must be a land tile (terrain != 0 and != 5)
      const idx = action.targetR * state.mapWidth + action.targetQ
      expect(state.terrain[idx]).not.toBe(0) // not water
      expect(state.terrain[idx]).not.toBe(5) // not mountain

      // Must be at least 5 tiles away from existing settlements
      const dq = action.targetQ - existingSettlement.q
      const dr = action.targetR - existingSettlement.r
      const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
      expect(dist).toBeGreaterThanOrEqual(5)
    }
  })

  it('settler idles when no suitable location exists', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    // Fill the tiny 5x5 map so nowhere is 5+ tiles from existing settlement
    const mapWidth = 5
    const mapHeight = 5
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4)
    const existingSettlement = makeSettlement({ q: 2, r: 2, ownerId: 'p1' })
    const unit = makeUnit({
      hunger: 0,
      safety: 100,
      type: 'settler',
      ownerId: 'p1',
      q: 2,
      r: 2,
      strength: 0
    })

    const state = makeGameState({
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128)
    })
    state.players.set('p1', player)
    state.units.set(unit.id, unit)
    state.settlements.set(existingSettlement.id, existingSettlement)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('idle')
  })
})

// --- tickUnitAI integration ---

describe('tickUnitAI', () => {
  it('processes all units and updates their state', () => {
    const player = makePlayer()
    const settlement = makeSettlement({ q: 5, r: 5, ownerId: 'p1' })
    const hungryUnit = makeUnit({
      id: 'hungry',
      hunger: 85,
      safety: 100,
      ownerId: 'p1',
      q: 10,
      r: 10
    })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(hungryUnit.id, hungryUnit)
    state.settlements.set(settlement.id, settlement)

    tickUnitAI(state)

    // Hungry unit should be set to 'returning' state
    expect(hungryUnit.state).toBe('returning')
    expect(hungryUnit.targetQ).toBe(5)
    expect(hungryUnit.targetR).toBe(5)
    // Hunger should have incremented by 1
    expect(hungryUnit.hunger).toBe(86)
  })

  it('skips eliminated players', () => {
    const player = makePlayer({ eliminated: true })
    const unit = makeUnit({ hunger: 85, ownerId: 'p1', q: 10, r: 10 })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)

    tickUnitAI(state)

    // Unit should remain unchanged (no action taken)
    expect(unit.state).toBe('idle')
    expect(unit.targetQ).toBeUndefined()
  })

  it('builder unit with met needs returns build action', () => {
    const player = makePlayer()
    const faction = getFaction(player.factionId)
    const settlement = makeSettlement({ q: 5, r: 5, ownerId: 'p1', gatherRadius: 2 })
    const unit = makeUnit({
      hunger: 0,
      safety: 100,
      type: 'builder',
      ownerId: 'p1',
      q: 5,
      r: 5
    })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)
    state.settlements.set(settlement.id, settlement)

    const action = decideAction(unit, player, faction, state)
    expect(action.type).toBe('build')
  })
})

// --- applyAction integration ---

describe('applyAction via tickUnitAI', () => {
  it('sets unit state to moving for explore action', () => {
    const player = makePlayer({
      fogMap: (() => {
        const fog = new Uint8Array(400).fill(1)
        // Leave row 15 unexplored
        for (let q = 0; q < 20; q++) {
          fog[15 * 20 + q] = 0
        }
        return fog
      })()
    })
    const unit = makeUnit({
      hunger: 0,
      safety: 100,
      type: 'scout',
      ownerId: 'p1',
      q: 5,
      r: 5
    })

    const state = makeGameState()
    state.players.set('p1', player)
    state.units.set(unit.id, unit)

    tickUnitAI(state)

    expect(unit.state).toBe('moving')
    expect(unit.targetQ).toBeDefined()
    expect(unit.targetR).toBeDefined()
  })

  it('sets unit state to fighting for attack action', () => {
    const player = makePlayer()
    const enemy = makeUnit({
      id: 'e1',
      ownerId: 'p2',
      q: 6,
      r: 5,
      strength: 4
    })
    const warrior = makeUnit({
      hunger: 0,
      safety: 60,
      type: 'warrior',
      ownerId: 'p1',
      q: 5,
      r: 5,
      strength: 8,
      visionRange: 2
    })

    const state = makeGameState({
      diplomacy: [{ player1Id: 'p1', player2Id: 'p2', status: 'war' }]
    })
    state.players.set('p1', player)
    state.players.set('p2', makePlayer({ userId: 'p2' }))
    state.units.set(warrior.id, warrior)
    state.units.set(enemy.id, enemy)

    tickUnitAI(state)

    expect(warrior.state).toBe('fighting')
    expect(warrior.targetQ).toBe(6)
    expect(warrior.targetR).toBe(5)
  })
})
