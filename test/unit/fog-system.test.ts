import { describe, expect, it } from 'vitest'
import { tickFog, revealTiles } from '../../server/game/systems/fog-system'
import type { GameState, GamePlayer, GameUnit, GameSettlement } from '../../shared/game-types'

// --- Helpers ---

function createFogMap(width: number, height: number, fill = 0): Uint8Array {
  return new Uint8Array(width * height).fill(fill)
}

function createPlayer(userId: string, fogMap: Uint8Array): GamePlayer {
  return {
    userId,
    factionId: 'solar_empire',
    resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0 },
    resourceIncome: { food: 0, production: 0, gold: 0, science: 0, culture: 0 },
    resourceUpkeep: { food: 0, production: 0, gold: 0, science: 0, culture: 0 },
    policies: { aggression: 50, expansion: 50, spending: 50, combatPolicy: 'defensive' },
    advisors: [],
    researchedTechs: [],
    currentResearch: null,
    researchProgress: 0,
    passedLaws: [],
    eliminated: false,
    fogMap
  }
}

function createUnit(id: string, ownerId: string, q: number, r: number, visionRange: number, type: GameUnit['type'] = 'scout'): GameUnit {
  return {
    id,
    type,
    ownerId,
    q,
    r,
    hp: 50,
    maxHp: 50,
    hunger: 0,
    safety: 100,
    strength: 2,
    visionRange,
    moveSpeed: 1,
    state: 'idle'
  }
}

function createSettlement(id: string, ownerId: string, q: number, r: number, gatherRadius: number): GameSettlement {
  return {
    id,
    ownerId,
    name: 'TestTown',
    tier: 'outpost',
    q,
    r,
    buildings: [],
    buildingSlots: 2,
    gatherRadius,
    isCapital: true,
    hp: 100,
    maxHp: 100,
    defense: 5
  }
}

function createMinimalGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: 'test',
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

function getFog(fogMap: Uint8Array, q: number, r: number, width: number): number {
  return fogMap[r * width + q]
}

// --- Tests ---

describe('revealTiles', () => {
  it('reveals tiles around a position within the given range', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)

    revealTiles(fogMap, 5, 5, 2, width, height)

    // Center tile should be visible
    expect(getFog(fogMap, 5, 5, width)).toBe(2)
    // Adjacent tiles should be visible
    expect(getFog(fogMap, 5, 4, width)).toBe(2)
    expect(getFog(fogMap, 5, 6, width)).toBe(2)
    expect(getFog(fogMap, 4, 5, width)).toBe(2)
    expect(getFog(fogMap, 6, 5, width)).toBe(2)
    // Diagonal at distance sqrt(2) ~ 1.41, within range 2
    expect(getFog(fogMap, 6, 6, width)).toBe(2)
    expect(getFog(fogMap, 4, 4, width)).toBe(2)
  })

  it('does not reveal tiles outside the range', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)

    revealTiles(fogMap, 5, 5, 2, width, height)

    // Tile at distance 3 (straight) should NOT be visible
    expect(getFog(fogMap, 5, 8, width)).toBe(0)
    expect(getFog(fogMap, 8, 5, width)).toBe(0)
    // Tile at (7,7) is distance sqrt(8) ~ 2.83, outside range 2
    expect(getFog(fogMap, 7, 7, width)).toBe(0)
  })

  it('clamps to map boundaries', () => {
    const width = 10
    const height = 10
    const fogMap = createFogMap(width, height, 0)

    // Reveal near edge: should not crash and only reveal valid tiles
    revealTiles(fogMap, 0, 0, 3, width, height)

    expect(getFog(fogMap, 0, 0, width)).toBe(2)
    expect(getFog(fogMap, 1, 0, width)).toBe(2)
    expect(getFog(fogMap, 0, 1, width)).toBe(2)
    // Should not wrap around or go negative
    // Verify no out-of-bounds writes by checking total visible count is reasonable
    const visibleCount = [...fogMap].filter(v => v === 2).length
    expect(visibleCount).toBeGreaterThan(0)
    expect(visibleCount).toBeLessThan(width * height)
  })
})

describe('tickFog', () => {
  it('unit at (5,5) with vision 2 reveals surrounding tiles', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)
    const player = createPlayer('p1', fogMap)
    const unit = createUnit('u1', 'p1', 5, 5, 2)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      units: new Map([['u1', unit]])
    })

    tickFog(state)

    // Center tile visible
    expect(getFog(fogMap, 5, 5, width)).toBe(2)
    // Tiles within range 2
    expect(getFog(fogMap, 5, 3, width)).toBe(2) // distance 2
    expect(getFog(fogMap, 5, 7, width)).toBe(2) // distance 2
    expect(getFog(fogMap, 3, 5, width)).toBe(2) // distance 2
    expect(getFog(fogMap, 7, 5, width)).toBe(2) // distance 2
    // Diagonals at sqrt(2) ~ 1.41
    expect(getFog(fogMap, 6, 6, width)).toBe(2)
    expect(getFog(fogMap, 4, 4, width)).toBe(2)
    // Tiles just outside range
    expect(getFog(fogMap, 5, 2, width)).toBe(0) // distance 3
    expect(getFog(fogMap, 8, 5, width)).toBe(0) // distance 3
  })

  it('settlement at (10,10) with gather radius 3 grants vision', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)
    const player = createPlayer('p1', fogMap)
    const settlement = createSettlement('s1', 'p1', 10, 10, 3)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      settlements: new Map([['s1', settlement]])
    })

    tickFog(state)

    // Center visible
    expect(getFog(fogMap, 10, 10, width)).toBe(2)
    // Tiles within gather radius 3
    expect(getFog(fogMap, 10, 7, width)).toBe(2) // distance 3
    expect(getFog(fogMap, 13, 10, width)).toBe(2) // distance 3
    expect(getFog(fogMap, 7, 10, width)).toBe(2) // distance 3
    // Diagonal at distance sqrt(4+4) ~ 2.83, within range 3
    expect(getFog(fogMap, 12, 12, width)).toBe(2)
    // Tile at distance 4 should NOT be visible
    expect(getFog(fogMap, 10, 6, width)).toBe(0)
    expect(getFog(fogMap, 14, 10, width)).toBe(0)
  })

  it('resets visible (2) to explored (1), keeps explored (1) and unexplored (0) as-is', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)

    // Simulate previous state: some tiles visible, some explored, some unexplored
    // Mark tile (0,0) as explored
    fogMap[0 * width + 0] = 1
    // Mark tile (1,0) as visible
    fogMap[0 * width + 1] = 2
    // Tile (19,19) stays unexplored (0)

    const player = createPlayer('p1', fogMap)
    // Place unit far from (0,0) and (1,0) so those tiles are not re-revealed
    const unit = createUnit('u1', 'p1', 10, 10, 1)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      units: new Map([['u1', unit]])
    })

    tickFog(state)

    // Previously visible tile (1,0) should now be explored (1), since no unit is nearby
    expect(getFog(fogMap, 1, 0, width)).toBe(1)
    // Previously explored tile (0,0) should remain explored (1)
    expect(getFog(fogMap, 0, 0, width)).toBe(1)
    // Unexplored tile (19,19) should remain unexplored (0)
    expect(getFog(fogMap, 19, 19, width)).toBe(0)
    // Tile around unit at (10,10) should be visible
    expect(getFog(fogMap, 10, 10, width)).toBe(2)
  })

  it('scout has vision 4 tiles, warrior has vision 2 tiles', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)
    const player = createPlayer('p1', fogMap)

    // Scout at (5,10) with vision 4
    const scout = createUnit('scout1', 'p1', 5, 10, 4, 'scout')
    // Warrior at (15,10) with vision 2
    const warrior = createUnit('warrior1', 'p1', 15, 10, 2, 'warrior')

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      units: new Map([['scout1', scout], ['warrior1', warrior]])
    })

    tickFog(state)

    // Scout can see 4 tiles away
    expect(getFog(fogMap, 5, 6, width)).toBe(2) // distance 4 from (5,10)
    expect(getFog(fogMap, 5, 14, width)).toBe(2) // distance 4 from (5,10)
    expect(getFog(fogMap, 9, 10, width)).toBe(2) // distance 4 from (5,10)
    expect(getFog(fogMap, 1, 10, width)).toBe(2) // distance 4 from (5,10)
    // Scout cannot see 5 tiles away
    expect(getFog(fogMap, 5, 5, width)).toBe(0) // distance 5 from (5,10)
    expect(getFog(fogMap, 10, 10, width)).toBe(0) // distance 5 from (5,10)

    // Warrior can see 2 tiles away
    expect(getFog(fogMap, 15, 8, width)).toBe(2) // distance 2 from (15,10)
    expect(getFog(fogMap, 17, 10, width)).toBe(2) // distance 2 from (15,10)
    // Warrior cannot see 3 tiles away
    expect(getFog(fogMap, 15, 7, width)).toBe(0) // distance 3 from (15,10)
    expect(getFog(fogMap, 18, 10, width)).toBe(0) // distance 3 from (15,10)
  })

  it('only own units/settlements grant vision (not enemies)', () => {
    const width = 20
    const height = 20
    const fogMapP1 = createFogMap(width, height, 0)
    const fogMapP2 = createFogMap(width, height, 0)
    const player1 = createPlayer('p1', fogMapP1)
    const player2 = createPlayer('p2', fogMapP2)

    // P1 has a unit at (5,5)
    const unitP1 = createUnit('u1', 'p1', 5, 5, 2)
    // P2 has a unit at (15,15)
    const unitP2 = createUnit('u2', 'p2', 15, 15, 2)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player1], ['p2', player2]]),
      units: new Map([['u1', unitP1], ['u2', unitP2]])
    })

    tickFog(state)

    // P1 sees around (5,5) but NOT around (15,15)
    expect(getFog(fogMapP1, 5, 5, width)).toBe(2)
    expect(getFog(fogMapP1, 15, 15, width)).toBe(0)

    // P2 sees around (15,15) but NOT around (5,5)
    expect(getFog(fogMapP2, 15, 15, width)).toBe(2)
    expect(getFog(fogMapP2, 5, 5, width)).toBe(0)
  })

  it('skips eliminated players', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)
    // Set some tiles to visible so we can check they get left alone
    fogMap[5 * width + 5] = 2

    const player = createPlayer('p1', fogMap)
    player.eliminated = true

    const unit = createUnit('u1', 'p1', 10, 10, 2)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      units: new Map([['u1', unit]])
    })

    tickFog(state)

    // Fog should NOT be reset or updated for eliminated player
    // The previously visible tile should remain visible (not reset to explored)
    expect(getFog(fogMap, 5, 5, width)).toBe(2)
    // The unit's position should NOT be revealed (eliminated player skipped)
    expect(getFog(fogMap, 10, 10, width)).toBe(0)
  })

  it('combines vision from multiple units and settlements', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)
    const player = createPlayer('p1', fogMap)

    const unit = createUnit('u1', 'p1', 3, 3, 2)
    const settlement = createSettlement('s1', 'p1', 15, 15, 3)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      units: new Map([['u1', unit]]),
      settlements: new Map([['s1', settlement]])
    })

    tickFog(state)

    // Both areas should be visible
    expect(getFog(fogMap, 3, 3, width)).toBe(2) // unit center
    expect(getFog(fogMap, 15, 15, width)).toBe(2) // settlement center
    expect(getFog(fogMap, 4, 4, width)).toBe(2) // near unit
    expect(getFog(fogMap, 16, 16, width)).toBe(2) // near settlement
  })

  it('maintains explored status across multiple ticks as units move', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)
    const player = createPlayer('p1', fogMap)

    // First tick: unit at (5,5)
    const unit = createUnit('u1', 'p1', 5, 5, 2)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      units: new Map([['u1', unit]])
    })

    tickFog(state)
    expect(getFog(fogMap, 5, 5, width)).toBe(2) // visible

    // Move unit to (10,10)
    unit.q = 10
    unit.r = 10

    tickFog(state)

    // Old position should be explored (1), not visible (2)
    expect(getFog(fogMap, 5, 5, width)).toBe(1)
    // New position should be visible
    expect(getFog(fogMap, 10, 10, width)).toBe(2)
  })
})
