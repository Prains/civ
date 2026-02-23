import { describe, expect, it, beforeEach } from 'vitest'
import type { GameState, GameUnit, GameSettlement, HexCoord } from '../../shared/game-types'
import {
  spawnInitialNeutrals,
  tickNeutrals,
  tickBarbarianCamps,
  resetNeutralIdCounter
} from '../../server/game/systems/neutral-system'

// --- Helpers ---

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: 'test',
    tick: 0,
    speed: 1,
    paused: false,
    mapWidth: 20,
    mapHeight: 20,
    terrain: new Uint8Array(400).fill(4), // all grassland by default
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

function makeUnit(overrides: Partial<GameUnit> = {}): GameUnit {
  return {
    id: 'unit-' + Math.random().toString(36).slice(2, 8),
    type: 'warrior',
    ownerId: 'player1',
    q: 5,
    r: 5,
    hp: 100,
    maxHp: 100,
    hunger: 0,
    safety: 100,
    strength: 8,
    visionRange: 2,
    moveSpeed: 1,
    state: 'idle',
    ...overrides
  }
}

function makeSettlement(overrides: Partial<GameSettlement> = {}): GameSettlement {
  return {
    id: 'settlement-' + Math.random().toString(36).slice(2, 8),
    ownerId: 'player1',
    name: 'TestTown',
    tier: 'outpost',
    q: 5,
    r: 5,
    buildings: [],
    buildingSlots: 3,
    gatherRadius: 3,
    isCapital: true,
    hp: 100,
    maxHp: 100,
    defense: 5,
    ...overrides
  }
}

// Reset counter before each test to get predictable IDs
beforeEach(() => {
  resetNeutralIdCounter()
})

// --- spawnInitialNeutrals ---

describe('spawnInitialNeutrals', () => {
  it('creates animal units on forest tiles', () => {
    const terrain = new Uint8Array(400).fill(4) // all grassland
    // Set some tiles to forest (terrain=3)
    for (let i = 0; i < 15; i++) {
      terrain[i] = 3 // first 15 tiles are forest
    }
    const state = makeState({ terrain })

    spawnInitialNeutrals(state)

    // Count animal units
    const animals = [...state.neutralUnits.values()].filter(
      u => u.ownerId === 'neutral_animal'
    )

    // Should have 5-10 animals
    expect(animals.length).toBeGreaterThanOrEqual(5)
    expect(animals.length).toBeLessThanOrEqual(10)

    // All animals should be on forest tiles
    for (const animal of animals) {
      const idx = animal.r * state.mapWidth + animal.q
      expect(state.terrain[idx]).toBe(3)
    }

    // Animals should have correct stats
    for (const animal of animals) {
      expect(animal.type).toBe('gatherer')
      expect(animal.strength).toBe(3)
      expect(animal.hp).toBe(15)
      expect(animal.maxHp).toBe(15)
      expect(animal.visionRange).toBe(2)
      expect(animal.moveSpeed).toBe(1)
    }
  })

  it('creates barbarian camps with units', () => {
    // Create a larger map so there is space for camps far from settlements
    const mapWidth = 40
    const mapHeight = 40
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4) // all grassland

    // Place a player settlement in one corner
    const settlements = new Map<string, GameSettlement>()
    const settlement = makeSettlement({ q: 2, r: 2 })
    settlements.set(settlement.id, settlement)

    const state = makeState({
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128),
      settlements
    })

    spawnInitialNeutrals(state)

    // Should have 2-3 barbarian camps
    expect(state.barbarianCamps.length).toBeGreaterThanOrEqual(2)
    expect(state.barbarianCamps.length).toBeLessThanOrEqual(3)

    // Count barbarian units
    const barbarians = [...state.neutralUnits.values()].filter(
      u => u.ownerId === 'neutral_barbarian'
    )

    // Should have 2 barbarians per camp
    expect(barbarians.length).toBe(state.barbarianCamps.length * 2)

    // Barbarians should have correct stats
    for (const barb of barbarians) {
      expect(barb.type).toBe('warrior')
      expect(barb.strength).toBe(8)
      expect(barb.hp).toBe(30)
      expect(barb.maxHp).toBe(30)
      expect(barb.visionRange).toBe(3)
      expect(barb.moveSpeed).toBe(1)
    }

    // Camps should be far from player settlement
    for (const camp of state.barbarianCamps) {
      const dist = Math.max(
        Math.abs(camp.q - settlement.q),
        Math.abs(camp.r - settlement.r),
        Math.abs((camp.q + camp.r) - (settlement.q + settlement.r))
      )
      expect(dist).toBeGreaterThanOrEqual(10)
    }
  })
})

// --- tickNeutrals ---

describe('tickNeutrals', () => {
  it('animals stay idle when not attacked', () => {
    const state = makeState()
    const animal: GameUnit = {
      id: 'animal-1',
      type: 'gatherer',
      ownerId: 'neutral_animal',
      q: 10,
      r: 10,
      hp: 15,
      maxHp: 15,
      hunger: 0,
      safety: 100,
      strength: 3,
      visionRange: 2,
      moveSpeed: 1,
      state: 'idle'
    }
    state.neutralUnits.set(animal.id, animal)

    tickNeutrals(state)

    expect(animal.state).toBe('idle')
    expect(animal.targetQ).toBeUndefined()
    expect(animal.targetR).toBeUndefined()
  })

  it('animals fight back when damaged (hp < maxHp)', () => {
    const state = makeState()

    const animal: GameUnit = {
      id: 'animal-1',
      type: 'gatherer',
      ownerId: 'neutral_animal',
      q: 10,
      r: 10,
      hp: 10, // Damaged! (maxHp = 15)
      maxHp: 15,
      hunger: 0,
      safety: 100,
      strength: 3,
      visionRange: 2,
      moveSpeed: 1,
      state: 'idle'
    }
    state.neutralUnits.set(animal.id, animal)

    // Place an enemy unit within vision range
    const enemyUnit = makeUnit({
      id: 'enemy-1',
      ownerId: 'player1',
      q: 11, // Adjacent to animal
      r: 10
    })
    state.units.set(enemyUnit.id, enemyUnit)

    tickNeutrals(state)

    expect(animal.state).toBe('fighting')
    expect(animal.targetQ).toBe(11)
    expect(animal.targetR).toBe(10)
  })

  it('barbarians patrol around camp', () => {
    const state = makeState({ tick: 1 })

    // Place a camp
    const campPos: HexCoord = { q: 10, r: 10 }
    state.barbarianCamps.push(campPos)

    // Place a barbarian near the camp
    const barbarian: GameUnit = {
      id: 'barb-1',
      type: 'warrior',
      ownerId: 'neutral_barbarian',
      q: 10,
      r: 10,
      hp: 30,
      maxHp: 30,
      hunger: 0,
      safety: 100,
      strength: 8,
      visionRange: 3,
      moveSpeed: 1,
      state: 'idle'
    }
    state.neutralUnits.set(barbarian.id, barbarian)

    tickNeutrals(state)

    // Barbarian should be moving (patrolling)
    expect(barbarian.state).toBe('moving')
    expect(barbarian.targetQ).toBeDefined()
    expect(barbarian.targetR).toBeDefined()

    // Target should be within patrol radius of camp
    const dist = Math.max(
      Math.abs(barbarian.targetQ! - campPos.q),
      Math.abs(barbarian.targetR! - campPos.r),
      Math.abs((barbarian.targetQ! + barbarian.targetR!) - (campPos.q + campPos.r))
    )
    expect(dist).toBeLessThanOrEqual(5)
  })

  it('barbarians move toward nearby enemy settlement', () => {
    const state = makeState({ tick: 1 })

    // Place a camp
    const campPos: HexCoord = { q: 10, r: 10 }
    state.barbarianCamps.push(campPos)

    // Place a barbarian near the camp
    const barbarian: GameUnit = {
      id: 'barb-1',
      type: 'warrior',
      ownerId: 'neutral_barbarian',
      q: 10,
      r: 10,
      hp: 30,
      maxHp: 30,
      hunger: 0,
      safety: 100,
      strength: 8,
      visionRange: 3,
      moveSpeed: 1,
      state: 'idle'
    }
    state.neutralUnits.set(barbarian.id, barbarian)

    // Place an enemy settlement within vision range
    const settlement = makeSettlement({ q: 12, r: 10, ownerId: 'player1' })
    state.settlements.set(settlement.id, settlement)

    tickNeutrals(state)

    // Barbarian should be moving toward the settlement
    expect(barbarian.state).toBe('moving')
    expect(barbarian.targetQ).toBeDefined()
    expect(barbarian.targetR).toBeDefined()

    // Target should be closer to the settlement than the barbarian's current position
    const currentDist = Math.max(
      Math.abs(10 - 12),
      Math.abs(10 - 10),
      Math.abs(20 - 22)
    )
    const targetDist = Math.max(
      Math.abs(barbarian.targetQ! - 12),
      Math.abs(barbarian.targetR! - 10),
      Math.abs((barbarian.targetQ! + barbarian.targetR!) - 22)
    )
    expect(targetDist).toBeLessThan(currentDist)
  })

  it('barbarians prioritize attacking nearby enemy units over settlements', () => {
    const state = makeState({ tick: 1 })

    // Place a camp
    const campPos: HexCoord = { q: 10, r: 10 }
    state.barbarianCamps.push(campPos)

    const barbarian: GameUnit = {
      id: 'barb-1',
      type: 'warrior',
      ownerId: 'neutral_barbarian',
      q: 10,
      r: 10,
      hp: 30,
      maxHp: 30,
      hunger: 0,
      safety: 100,
      strength: 8,
      visionRange: 3,
      moveSpeed: 1,
      state: 'idle'
    }
    state.neutralUnits.set(barbarian.id, barbarian)

    // Place both an enemy unit and settlement in vision
    const enemyUnit = makeUnit({ q: 11, r: 10, ownerId: 'player1' })
    state.units.set(enemyUnit.id, enemyUnit)

    const settlement = makeSettlement({ q: 12, r: 10, ownerId: 'player1' })
    state.settlements.set(settlement.id, settlement)

    tickNeutrals(state)

    // Barbarian should be fighting (targeting the unit, not just moving to settlement)
    expect(barbarian.state).toBe('fighting')
  })
})

// --- tickBarbarianCamps ---

describe('tickBarbarianCamps', () => {
  it('spawns new camp after 50 ticks', () => {
    const mapWidth = 30
    const mapHeight = 30
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4)

    // Place a settlement in one corner
    const settlements = new Map<string, GameSettlement>()
    const settlement = makeSettlement({ q: 2, r: 2 })
    settlements.set(settlement.id, settlement)

    const state = makeState({
      tick: 50, // exactly on the spawn interval
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128),
      settlements
    })

    tickBarbarianCamps(state)

    // Should have spawned exactly 1 camp
    expect(state.barbarianCamps.length).toBe(1)

    // Should have spawned 2 barbarian units
    const barbarians = [...state.neutralUnits.values()].filter(
      u => u.ownerId === 'neutral_barbarian'
    )
    expect(barbarians.length).toBe(2)
  })

  it('does not spawn camp on non-interval ticks', () => {
    const mapWidth = 30
    const mapHeight = 30
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4)

    const state = makeState({
      tick: 49, // not on the interval
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128)
    })

    tickBarbarianCamps(state)

    expect(state.barbarianCamps.length).toBe(0)
  })

  it('respects max 5 camps limit', () => {
    const mapWidth = 30
    const mapHeight = 30
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4)

    // Pre-fill with 5 camps
    const existingCamps: HexCoord[] = [
      { q: 5, r: 5 },
      { q: 10, r: 5 },
      { q: 15, r: 5 },
      { q: 5, r: 15 },
      { q: 15, r: 15 }
    ]

    const state = makeState({
      tick: 50,
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128),
      barbarianCamps: existingCamps
    })

    tickBarbarianCamps(state)

    // Should still be 5 (no new camp spawned)
    expect(state.barbarianCamps.length).toBe(5)
  })

  it('does not spawn camp near settlements', () => {
    const mapWidth = 30
    const mapHeight = 30
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4)

    // Place settlements covering most of the map
    const settlements = new Map<string, GameSettlement>()
    // Settlement at center and corners: all tiles within 8 hex radius of some settlement
    for (let r = 4; r < mapHeight; r += 8) {
      for (let q = 4; q < mapWidth; q += 8) {
        const s = makeSettlement({ q, r, id: `s-${q}-${r}` })
        settlements.set(s.id, s)
      }
    }

    const state = makeState({
      tick: 50,
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128),
      settlements
    })

    tickBarbarianCamps(state)

    // With dense settlement coverage, there should be no valid location
    // Any spawned camp must be at least 8 hexes from all settlements
    for (const camp of state.barbarianCamps) {
      for (const settlement of state.settlements.values()) {
        const dist = Math.max(
          Math.abs(camp.q - settlement.q),
          Math.abs(camp.r - settlement.r),
          Math.abs((camp.q + camp.r) - (settlement.q + settlement.r))
        )
        expect(dist).toBeGreaterThanOrEqual(8)
      }
    }
  })
})
