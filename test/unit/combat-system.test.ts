import { describe, expect, it } from 'vitest'
import type { GameState, GameUnit, DiplomacyState } from '../../shared/game-types'
import {
  tickCombat,
  hexDistance,
  calculateDamage,
  shouldFight
} from '../../server/game/systems/combat-system'

// --- Helpers ---

/** Terrain values: 0=water, 1=desert, 2=steppe, 3=forest, 4=plains, 5=mountains */
function createTestState(overrides: Partial<GameState> = {}): GameState {
  const mapWidth = 20
  const mapHeight = 20
  const terrain = new Uint8Array(mapWidth * mapHeight).fill(4) // all plains
  return {
    gameId: 'test',
    tick: 1,
    speed: 1,
    paused: false,
    mapWidth,
    mapHeight,
    terrain,
    elevation: new Uint8Array(mapWidth * mapHeight).fill(128),
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

function createUnit(overrides: Partial<GameUnit> = {}): GameUnit {
  return {
    id: crypto.randomUUID(),
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

// --- hexDistance ---

describe('hexDistance', () => {
  it('returns 0 for same tile', () => {
    expect(hexDistance(5, 5, 5, 5)).toBe(0)
  })

  it('returns 1 for directly adjacent tiles', () => {
    // Axial neighbors
    expect(hexDistance(5, 5, 6, 5)).toBe(1)
    expect(hexDistance(5, 5, 4, 5)).toBe(1)
    expect(hexDistance(5, 5, 5, 6)).toBe(1)
    expect(hexDistance(5, 5, 5, 4)).toBe(1)
    expect(hexDistance(5, 5, 6, 4)).toBe(1)
    expect(hexDistance(5, 5, 4, 6)).toBe(1)
  })

  it('returns 2 for tiles two steps away', () => {
    expect(hexDistance(5, 5, 7, 5)).toBe(2)
    expect(hexDistance(5, 5, 5, 7)).toBe(2)
    expect(hexDistance(5, 5, 7, 3)).toBe(2)
  })

  it('handles negative coordinates', () => {
    expect(hexDistance(-1, -1, 0, -1)).toBe(1)
    expect(hexDistance(-2, 0, 0, 0)).toBe(2)
  })
})

// --- shouldFight ---

describe('shouldFight', () => {
  it('returns true when units belong to players at war', () => {
    const unitA = createUnit({ ownerId: 'p1', strength: 8 })
    const unitB = createUnit({ ownerId: 'p2', strength: 8 })
    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ diplomacy })

    expect(shouldFight(unitA, unitB, state)).toBe(true)
  })

  it('returns false when units belong to players at peace', () => {
    const unitA = createUnit({ ownerId: 'p1', strength: 8 })
    const unitB = createUnit({ ownerId: 'p2', strength: 8 })
    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'peace' }
    ]
    const state = createTestState({ diplomacy })

    expect(shouldFight(unitA, unitB, state)).toBe(false)
  })

  it('returns false when units belong to players at tension (not war)', () => {
    const unitA = createUnit({ ownerId: 'p1', strength: 8 })
    const unitB = createUnit({ ownerId: 'p2', strength: 8 })
    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'tension' }
    ]
    const state = createTestState({ diplomacy })

    expect(shouldFight(unitA, unitB, state)).toBe(false)
  })

  it('returns true when one unit is neutral (barbarian/animal)', () => {
    const playerUnit = createUnit({ ownerId: 'p1', strength: 8 })
    const neutralUnit = createUnit({ ownerId: 'neutral', strength: 5 })
    const state = createTestState()

    // Neutral units have no diplomacy entry, so they always fight
    expect(shouldFight(playerUnit, neutralUnit, state)).toBe(true)
  })

  it('returns false when attacker has 0 strength (settler)', () => {
    const settler = createUnit({ ownerId: 'p1', type: 'settler', strength: 0 })
    const enemy = createUnit({ ownerId: 'p2', strength: 8 })
    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ diplomacy })

    expect(shouldFight(settler, enemy, state)).toBe(false)
  })

  it('returns false when defender has 0 strength (settler)', () => {
    const warrior = createUnit({ ownerId: 'p1', strength: 8 })
    const settler = createUnit({ ownerId: 'p2', type: 'settler', strength: 0 })
    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ diplomacy })

    expect(shouldFight(warrior, settler, state)).toBe(false)
  })
})

// --- calculateDamage ---

describe('calculateDamage', () => {
  it('applies base strength on plains (no terrain modifier)', () => {
    const attacker = createUnit({ q: 5, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const defender = createUnit({ q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const state = createTestState()

    // On plains: terrainMod=1.0, healthMod=1.0, groupMod=1.0
    // Damage = 8 * 1.0 * 1.0 * 1.0 * random(0.8-1.2)
    const damage = calculateDamage(attacker, defender, state, () => 1.0)
    expect(damage).toBe(8)
  })

  it('applies forest terrain defense modifier (+20%)', () => {
    const mapWidth = 20
    const mapHeight = 20
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4) // plains
    // Defender is on forest tile (3)
    terrain[5 * mapWidth + 6] = 3 // tile at q=6, r=5 is forest
    const state = createTestState({ terrain, mapWidth, mapHeight })

    const attacker = createUnit({ q: 5, r: 5, strength: 10, hp: 100, maxHp: 100 })
    const defender = createUnit({ q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })

    // Forest defense: defender takes 20% less damage -> attacker damage * (1 / 1.2)
    const damage = calculateDamage(attacker, defender, state, () => 1.0)
    // 10 * (1/1.2) * 1.0 * 1.0 = 8.333... -> floor = 8
    expect(damage).toBeCloseTo(8.33, 1)
  })

  it('applies mountain terrain defense modifier (+30%)', () => {
    const mapWidth = 20
    const mapHeight = 20
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4)
    // Defender is on mountain tile (5)
    terrain[5 * mapWidth + 6] = 5 // tile at q=6, r=5 is mountain
    const state = createTestState({ terrain, mapWidth, mapHeight })

    const attacker = createUnit({ q: 5, r: 5, strength: 13, hp: 100, maxHp: 100 })
    const defender = createUnit({ q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })

    // Mountain defense: damage * (1 / 1.3)
    const damage = calculateDamage(attacker, defender, state, () => 1.0)
    // 13 * (1/1.3) * 1.0 * 1.0 = 10.0
    expect(damage).toBeCloseTo(10.0, 1)
  })

  it('applies health modifier (reduced HP = reduced damage)', () => {
    const attacker = createUnit({ q: 5, r: 5, strength: 10, hp: 50, maxHp: 100 })
    const defender = createUnit({ q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const state = createTestState()

    // healthMod = 50/100 = 0.5
    // Damage = 10 * 1.0 * 0.5 * 1.0 * 1.0 = 5
    const damage = calculateDamage(attacker, defender, state, () => 1.0)
    expect(damage).toBe(5)
  })

  it('applies group modifier for nearby allies', () => {
    const attacker = createUnit({ id: 'a1', ownerId: 'p1', q: 5, r: 5, strength: 10, hp: 100, maxHp: 100 })
    const defender = createUnit({ id: 'd1', ownerId: 'p2', q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const ally1 = createUnit({ id: 'ally1', ownerId: 'p1', q: 4, r: 5, strength: 5 })
    const ally2 = createUnit({ id: 'ally2', ownerId: 'p1', q: 5, r: 4, strength: 5 })

    const units = new Map<string, GameUnit>()
    units.set(attacker.id, attacker)
    units.set(defender.id, defender)
    units.set(ally1.id, ally1)
    units.set(ally2.id, ally2)

    const state = createTestState({ units })

    // groupMod = 1.0 + (0.1 * 2 allies) = 1.2
    // Damage = 10 * 1.0 * 1.0 * 1.2 * 1.0 = 12
    const damage = calculateDamage(attacker, defender, state, () => 1.0)
    expect(damage).toBe(12)
  })

  it('random factor scales damage within 0.8-1.2 range', () => {
    const attacker = createUnit({ q: 5, r: 5, strength: 10, hp: 100, maxHp: 100 })
    const defender = createUnit({ q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const state = createTestState()

    const damageLow = calculateDamage(attacker, defender, state, () => 0.8)
    const damageHigh = calculateDamage(attacker, defender, state, () => 1.2)

    // Base damage = 10, so range should be 8 to 12
    expect(damageLow).toBe(8)
    expect(damageHigh).toBe(12)
  })

  it('returns at least 1 damage when attacker has strength', () => {
    const attacker = createUnit({ q: 5, r: 5, strength: 1, hp: 10, maxHp: 100 })
    const defender = createUnit({ q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })

    const mapWidth = 20
    const mapHeight = 20
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4)
    terrain[5 * mapWidth + 6] = 5 // mountain
    const state = createTestState({ terrain, mapWidth, mapHeight })

    // Very low damage scenario: 1 * (1/1.3) * 0.1 * 1.0 * 0.8 = 0.0615...
    // Should be clamped to minimum 1
    const damage = calculateDamage(attacker, defender, state, () => 0.8)
    expect(damage).toBeGreaterThanOrEqual(1)
  })
})

// --- tickCombat integration ---

describe('tickCombat', () => {
  it('triggers combat between adjacent units at war', () => {
    const unitA = createUnit({ id: 'a', ownerId: 'p1', q: 5, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const unitB = createUnit({ id: 'b', ownerId: 'p2', q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })

    const units = new Map<string, GameUnit>()
    units.set('a', unitA)
    units.set('b', unitB)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)

    // Should produce 2 events (each unit attacks the other)
    expect(events).toHaveLength(2)
    expect(events.some(e => e.attackerId === 'a' && e.defenderId === 'b')).toBe(true)
    expect(events.some(e => e.attackerId === 'b' && e.defenderId === 'a')).toBe(true)

    // Both should have taken damage
    expect(unitA.hp).toBeLessThan(100)
    expect(unitB.hp).toBeLessThan(100)
  })

  it('does not trigger combat between adjacent units at peace', () => {
    const unitA = createUnit({ id: 'a', ownerId: 'p1', q: 5, r: 5, strength: 8 })
    const unitB = createUnit({ id: 'b', ownerId: 'p2', q: 6, r: 5, strength: 8 })

    const units = new Map<string, GameUnit>()
    units.set('a', unitA)
    units.set('b', unitB)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'peace' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)
    expect(events).toHaveLength(0)
  })

  it('does not trigger combat between non-adjacent units at war', () => {
    const unitA = createUnit({ id: 'a', ownerId: 'p1', q: 5, r: 5, strength: 8 })
    const unitB = createUnit({ id: 'b', ownerId: 'p2', q: 8, r: 8, strength: 8 })

    const units = new Map<string, GameUnit>()
    units.set('a', unitA)
    units.set('b', unitB)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)
    expect(events).toHaveLength(0)
  })

  it('triggers combat against neutral units (always fight)', () => {
    const playerUnit = createUnit({ id: 'p', ownerId: 'p1', q: 5, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const neutralUnit = createUnit({ id: 'n', ownerId: 'neutral', q: 6, r: 5, strength: 3, hp: 40, maxHp: 40 })

    const units = new Map<string, GameUnit>()
    units.set('p', playerUnit)

    const neutralUnits = new Map<string, GameUnit>()
    neutralUnits.set('n', neutralUnit)

    const state = createTestState({ units, neutralUnits })

    const events = tickCombat(state, () => 1.0)
    expect(events.length).toBeGreaterThan(0)
    expect(events.some(e => e.attackerId === 'p' && e.defenderId === 'n')).toBe(true)
  })

  it('removes dead units after combat', () => {
    // Weak unit will die from strong unit's attack
    const strong = createUnit({ id: 's', ownerId: 'p1', q: 5, r: 5, strength: 50, hp: 100, maxHp: 100 })
    const weak = createUnit({ id: 'w', ownerId: 'p2', q: 6, r: 5, strength: 1, hp: 5, maxHp: 100 })

    const units = new Map<string, GameUnit>()
    units.set('s', strong)
    units.set('w', weak)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)

    // Weak unit should be dead and removed
    const killEvent = events.find(e => e.defenderId === 'w')
    expect(killEvent).toBeDefined()
    expect(killEvent!.killed).toBe(true)
    expect(state.units.has('w')).toBe(false)
  })

  it('removes dead neutral units after combat', () => {
    const strong = createUnit({ id: 's', ownerId: 'p1', q: 5, r: 5, strength: 50, hp: 100, maxHp: 100 })
    const neutral = createUnit({ id: 'n', ownerId: 'neutral', q: 6, r: 5, strength: 1, hp: 3, maxHp: 40 })

    const units = new Map<string, GameUnit>()
    units.set('s', strong)

    const neutralUnits = new Map<string, GameUnit>()
    neutralUnits.set('n', neutral)

    const state = createTestState({ units, neutralUnits })

    tickCombat(state, () => 1.0)

    expect(state.neutralUnits.has('n')).toBe(false)
  })

  it('does not process same pair twice', () => {
    const unitA = createUnit({ id: 'a', ownerId: 'p1', q: 5, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const unitB = createUnit({ id: 'b', ownerId: 'p2', q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })

    const units = new Map<string, GameUnit>()
    units.set('a', unitA)
    units.set('b', unitB)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)

    // Exactly 2 events for one combat pair (A attacks B, B attacks A)
    expect(events).toHaveLength(2)
  })

  it('does not trigger combat between units of the same player', () => {
    const unitA = createUnit({ id: 'a', ownerId: 'p1', q: 5, r: 5, strength: 8 })
    const unitB = createUnit({ id: 'b', ownerId: 'p1', q: 6, r: 5, strength: 8 })

    const units = new Map<string, GameUnit>()
    units.set('a', unitA)
    units.set('b', unitB)

    const state = createTestState({ units })

    const events = tickCombat(state, () => 1.0)
    expect(events).toHaveLength(0)
  })

  it('handles multiple combat pairs in single tick', () => {
    const u1 = createUnit({ id: 'u1', ownerId: 'p1', q: 5, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const u2 = createUnit({ id: 'u2', ownerId: 'p2', q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const u3 = createUnit({ id: 'u3', ownerId: 'p1', q: 10, r: 10, strength: 8, hp: 100, maxHp: 100 })
    const u4 = createUnit({ id: 'u4', ownerId: 'p2', q: 11, r: 10, strength: 8, hp: 100, maxHp: 100 })

    const units = new Map<string, GameUnit>()
    units.set('u1', u1)
    units.set('u2', u2)
    units.set('u3', u3)
    units.set('u4', u4)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)

    // 2 pairs * 2 events each = 4
    expect(events).toHaveLength(4)
  })

  it('combat events correctly report killed status', () => {
    const unitA = createUnit({ id: 'a', ownerId: 'p1', q: 5, r: 5, strength: 8, hp: 100, maxHp: 100 })
    const unitB = createUnit({ id: 'b', ownerId: 'p2', q: 6, r: 5, strength: 8, hp: 100, maxHp: 100 })

    const units = new Map<string, GameUnit>()
    units.set('a', unitA)
    units.set('b', unitB)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)

    // With 8 strength, single hit should not kill 100HP units
    for (const event of events) {
      expect(event.killed).toBe(false)
      expect(event.damage).toBeGreaterThan(0)
    }
  })

  it('group bonus increases damage from allied units nearby', () => {
    // Attacker with 2 allies nearby vs isolated defender
    const attacker = createUnit({ id: 'att', ownerId: 'p1', q: 5, r: 5, strength: 10, hp: 100, maxHp: 100 })
    const ally1 = createUnit({ id: 'al1', ownerId: 'p1', q: 4, r: 5, strength: 5, hp: 100, maxHp: 100 })
    const ally2 = createUnit({ id: 'al2', ownerId: 'p1', q: 5, r: 4, strength: 5, hp: 100, maxHp: 100 })
    const defender = createUnit({ id: 'def', ownerId: 'p2', q: 6, r: 5, strength: 10, hp: 100, maxHp: 100 })

    const units = new Map<string, GameUnit>()
    units.set(attacker.id, attacker)
    units.set(ally1.id, ally1)
    units.set(ally2.id, ally2)
    units.set(defender.id, defender)

    const diplomacy: DiplomacyState[] = [
      { player1Id: 'p1', player2Id: 'p2', status: 'war' }
    ]
    const state = createTestState({ units, diplomacy })

    const events = tickCombat(state, () => 1.0)

    // Attacker's damage should be boosted: 10 * 1.0 * 1.0 * 1.2 * 1.0 = 12
    const attackEvent = events.find(e => e.attackerId === 'att' && e.defenderId === 'def')
    expect(attackEvent).toBeDefined()
    expect(attackEvent!.damage).toBe(12)

    // Defender (isolated) damage: 10 * 1.0 * 1.0 * 1.0 * 1.0 = 10
    const defenseEvent = events.find(e => e.attackerId === 'def' && e.defenderId === 'att')
    expect(defenseEvent).toBeDefined()
    expect(defenseEvent!.damage).toBe(10)
  })
})
