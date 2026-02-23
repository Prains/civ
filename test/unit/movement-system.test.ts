import { describe, expect, it } from 'vitest'
import type { GameState, GameUnit } from '../../shared/game-types'
import {
  getHexNeighbors,
  findPath,
  tickMovement
} from '../../server/game/systems/movement-system'

// --- Helpers ---

function makeUnit(overrides: Partial<GameUnit> = {}): GameUnit {
  return {
    id: 'u1',
    type: 'scout',
    ownerId: 'p1',
    q: 0,
    r: 0,
    hp: 50,
    maxHp: 50,
    hunger: 0,
    safety: 100,
    strength: 2,
    visionRange: 4,
    moveSpeed: 1,
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

// --- getHexNeighbors ---

describe('getHexNeighbors', () => {
  it('returns 6 neighbors for even row', () => {
    const neighbors = getHexNeighbors(5, 4) // row 4 is even
    expect(neighbors).toHaveLength(6)

    // Even row offsets: (-1,-1), (0,-1), (-1,0), (+1,0), (-1,+1), (0,+1)
    expect(neighbors).toContainEqual({ q: 4, r: 3 })
    expect(neighbors).toContainEqual({ q: 5, r: 3 })
    expect(neighbors).toContainEqual({ q: 4, r: 4 })
    expect(neighbors).toContainEqual({ q: 6, r: 4 })
    expect(neighbors).toContainEqual({ q: 4, r: 5 })
    expect(neighbors).toContainEqual({ q: 5, r: 5 })
  })

  it('returns 6 neighbors for odd row', () => {
    const neighbors = getHexNeighbors(5, 3) // row 3 is odd
    expect(neighbors).toHaveLength(6)

    // Odd row offsets: (0,-1), (+1,-1), (-1,0), (+1,0), (0,+1), (+1,+1)
    expect(neighbors).toContainEqual({ q: 5, r: 2 })
    expect(neighbors).toContainEqual({ q: 6, r: 2 })
    expect(neighbors).toContainEqual({ q: 4, r: 3 })
    expect(neighbors).toContainEqual({ q: 6, r: 3 })
    expect(neighbors).toContainEqual({ q: 5, r: 4 })
    expect(neighbors).toContainEqual({ q: 6, r: 4 })
  })

  it('returns neighbors at origin even row (0,0)', () => {
    const neighbors = getHexNeighbors(0, 0)
    expect(neighbors).toHaveLength(6)
    // Even row: (-1,-1), (0,-1), (-1,0), (+1,0), (-1,+1), (0,+1)
    expect(neighbors).toContainEqual({ q: -1, r: -1 })
    expect(neighbors).toContainEqual({ q: 0, r: -1 })
    expect(neighbors).toContainEqual({ q: -1, r: 0 })
    expect(neighbors).toContainEqual({ q: 1, r: 0 })
    expect(neighbors).toContainEqual({ q: -1, r: 1 })
    expect(neighbors).toContainEqual({ q: 0, r: 1 })
  })
})

// --- findPath (BFS) ---

describe('findPath', () => {
  it('finds shortest path on open hex grid', () => {
    const state = makeGameState()
    const path = findPath(0, 0, 3, 0, state)

    // Path should start at origin and end at target
    expect(path[0]).toEqual({ q: 0, r: 0 })
    expect(path[path.length - 1]).toEqual({ q: 3, r: 0 })

    // On an open grid, path should be short (3 or 4 steps including start)
    expect(path.length).toBeGreaterThanOrEqual(2)
    expect(path.length).toBeLessThanOrEqual(5)
  })

  it('returns single-element path when already at target', () => {
    const state = makeGameState()
    const path = findPath(5, 5, 5, 5, state)
    expect(path).toEqual([{ q: 5, r: 5 }])
  })

  it('avoids water tiles (terrain=0)', () => {
    const state = makeGameState()
    // Block the direct horizontal path with water
    state.terrain[0 * 20 + 1] = 0 // (1,0) is water
    state.terrain[0 * 20 + 2] = 0 // (2,0) is water

    const path = findPath(0, 0, 3, 0, state)

    // Path should still reach the target
    expect(path[path.length - 1]).toEqual({ q: 3, r: 0 })

    // Path should not go through water tiles
    for (const step of path) {
      const idx = step.r * 20 + step.q
      expect(state.terrain[idx]).not.toBe(0)
    }
  })

  it('avoids mountain tiles (terrain=5)', () => {
    const state = makeGameState()
    // Block with mountains
    state.terrain[0 * 20 + 1] = 5 // (1,0) is mountain
    state.terrain[0 * 20 + 2] = 5 // (2,0) is mountain

    const path = findPath(0, 0, 3, 0, state)

    // Path should still reach the target
    expect(path[path.length - 1]).toEqual({ q: 3, r: 0 })

    // Path should not go through mountain tiles
    for (const step of path) {
      const idx = step.r * 20 + step.q
      expect(state.terrain[idx]).not.toBe(5)
    }
  })

  it('returns empty array when target is unreachable', () => {
    // Create a small map surrounded by water
    const mapWidth = 5
    const mapHeight = 5
    const terrain = new Uint8Array(25).fill(0) // all water
    terrain[0 * 5 + 0] = 4 // only (0,0) is land
    terrain[4 * 5 + 4] = 4 // only (4,4) is land

    const state = makeGameState({
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(25).fill(128)
    })

    const path = findPath(0, 0, 4, 4, state)
    expect(path).toEqual([])
  })

  it('path consists of hex-adjacent steps', () => {
    const state = makeGameState()
    const path = findPath(2, 2, 5, 4, state)

    // Verify each consecutive pair of steps are hex neighbors
    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i]
      const next = path[i + 1]
      const neighbors = getHexNeighbors(current.q, current.r)
      const isNeighbor = neighbors.some(n => n.q === next.q && n.r === next.r)
      expect(isNeighbor).toBe(true)
    }
  })

  it('does not traverse out-of-bounds tiles', () => {
    const state = makeGameState({ mapWidth: 10, mapHeight: 10 })
    state.terrain = new Uint8Array(100).fill(4)
    const path = findPath(0, 0, 9, 9, state)

    for (const step of path) {
      expect(step.q).toBeGreaterThanOrEqual(0)
      expect(step.q).toBeLessThan(10)
      expect(step.r).toBeGreaterThanOrEqual(0)
      expect(step.r).toBeLessThan(10)
    }
  })
})

// --- tickMovement ---

describe('tickMovement', () => {
  it('unit moves one tile per tick toward target', () => {
    const state = makeGameState()
    const unit = makeUnit({
      q: 2, r: 2, moveSpeed: 1,
      state: 'moving', targetQ: 5, targetR: 2
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    // Unit should have moved 1 tile closer to target
    // It started at (2,2), target is (5,2)
    // After one tick with moveSpeed=1, it should be one step along the path
    expect(unit.q !== 2 || unit.r !== 2).toBe(true) // moved from start
    expect(unit.state).toBe('moving') // still moving, not at target yet
  })

  it('unit stops at target tile and becomes idle', () => {
    const state = makeGameState()
    // Place unit 1 tile away from target
    const unit = makeUnit({
      q: 1, r: 0, moveSpeed: 1,
      state: 'moving', targetQ: 0, targetR: 0
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    // Unit should have reached target and become idle
    expect(unit.q).toBe(0)
    expect(unit.r).toBe(0)
    expect(unit.state).toBe('idle')
    expect(unit.targetQ).toBeUndefined()
    expect(unit.targetR).toBeUndefined()
  })

  it('unit avoids water/mountain tiles while moving', () => {
    const state = makeGameState()
    // Block direct path with water
    state.terrain[2 * 20 + 3] = 0 // (3,2) water
    state.terrain[2 * 20 + 4] = 0 // (4,2) water

    const unit = makeUnit({
      q: 2, r: 2, moveSpeed: 1,
      state: 'moving', targetQ: 5, targetR: 2
    })
    state.units.set(unit.id, unit)

    // Run multiple ticks to let unit path around obstacles
    for (let i = 0; i < 10; i++) {
      if (unit.state !== 'moving') break
      tickMovement(state)
    }

    // Unit should eventually reach target
    expect(unit.q).toBe(5)
    expect(unit.r).toBe(2)
    expect(unit.state).toBe('idle')
  })

  it('road tiles give speed bonus (move 2 tiles per tick on road)', () => {
    const state = makeGameState()
    // Place roads along the path including the unit's starting tile
    state.improvements.set('0,0', 'road')
    state.improvements.set('1,0', 'road')
    state.improvements.set('2,0', 'road')
    state.improvements.set('3,0', 'road')

    const unit = makeUnit({
      q: 0, r: 0, moveSpeed: 1,
      state: 'moving', targetQ: 4, targetR: 0
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    // With road bonus at start tile, unit should move 2 tiles instead of 1
    // base moveSpeed (1) + road bonus (1) = 2 effective speed
    // Unit starts at (0,0), should reach (2,0) after one tick
    expect(unit.q).toBe(2)
    expect(unit.r).toBe(0)
  })

  it('does not move idle units', () => {
    const state = makeGameState()
    const unit = makeUnit({ q: 5, r: 5, state: 'idle' })
    state.units.set(unit.id, unit)

    tickMovement(state)

    expect(unit.q).toBe(5)
    expect(unit.r).toBe(5)
  })

  it('does not move fighting units', () => {
    const state = makeGameState()
    const unit = makeUnit({
      q: 5, r: 5, state: 'fighting',
      targetQ: 6, targetR: 5
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    expect(unit.q).toBe(5)
    expect(unit.r).toBe(5)
  })

  it('moves returning units toward their target', () => {
    const state = makeGameState()
    const unit = makeUnit({
      q: 5, r: 5, moveSpeed: 1,
      state: 'returning', targetQ: 2, targetR: 2
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    // Unit should have moved closer to target
    expect(unit.q !== 5 || unit.r !== 5).toBe(true)
  })

  it('moves gathering units toward their target', () => {
    const state = makeGameState()
    const unit = makeUnit({
      q: 5, r: 5, moveSpeed: 1,
      state: 'gathering', targetQ: 7, targetR: 5
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    // Unit should have moved closer to target
    expect(unit.q !== 5 || unit.r !== 5).toBe(true)
  })

  it('moves building units toward their target', () => {
    const state = makeGameState()
    const unit = makeUnit({
      q: 5, r: 5, moveSpeed: 1,
      state: 'building', targetQ: 7, targetR: 5
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    // Unit should have moved closer to target
    expect(unit.q !== 5 || unit.r !== 5).toBe(true)
  })

  it('handles unit with no valid path (target surrounded by water)', () => {
    const state = makeGameState()

    // Surround target (10,10) with water
    const neighbors = getHexNeighbors(10, 10)
    for (const n of neighbors) {
      if (n.q >= 0 && n.q < 20 && n.r >= 0 && n.r < 20) {
        state.terrain[n.r * 20 + n.q] = 0
      }
    }

    const unit = makeUnit({
      q: 5, r: 5, moveSpeed: 1,
      state: 'moving', targetQ: 10, targetR: 10
    })
    state.units.set(unit.id, unit)

    tickMovement(state)

    // Unit should not crash, stays in place
    expect(unit.q).toBe(5)
    expect(unit.r).toBe(5)
  })

  it('processes multiple units independently', () => {
    const state = makeGameState()
    const unit1 = makeUnit({
      id: 'u1', q: 0, r: 0, moveSpeed: 1,
      state: 'moving', targetQ: 3, targetR: 0
    })
    const unit2 = makeUnit({
      id: 'u2', q: 10, r: 10, moveSpeed: 1,
      state: 'moving', targetQ: 7, targetR: 10
    })
    state.units.set(unit1.id, unit1)
    state.units.set(unit2.id, unit2)

    tickMovement(state)

    // Both units should have moved
    expect(unit1.q !== 0 || unit1.r !== 0).toBe(true)
    expect(unit2.q !== 10 || unit2.r !== 10).toBe(true)
  })
})

// --- BFS finds shortest path on hex grid ---

describe('BFS finds shortest path on hex grid', () => {
  it('finds the optimal path length on an unobstructed grid', () => {
    const state = makeGameState()

    // From (0,0) to (0,2): should be 2 steps along r-axis
    const path = findPath(0, 0, 0, 2, state)
    // Path includes start and end
    // On an offset hex grid, going from row 0 to row 2 via row 1 should be 3 nodes
    expect(path.length).toBe(3)
    expect(path[0]).toEqual({ q: 0, r: 0 })
    expect(path[path.length - 1]).toEqual({ q: 0, r: 2 })
  })

  it('finds a longer path when direct route is blocked', () => {
    const state = makeGameState()
    const directPath = findPath(0, 0, 3, 0, state)
    const directLen = directPath.length

    // Block part of the direct route
    state.terrain[0 * 20 + 1] = 0 // water at (1,0)

    const detourPath = findPath(0, 0, 3, 0, state)
    expect(detourPath.length).toBeGreaterThan(directLen)
    expect(detourPath[detourPath.length - 1]).toEqual({ q: 3, r: 0 })
  })
})
