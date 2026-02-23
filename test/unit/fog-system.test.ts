import { describe, expect, it } from 'vitest'
import { tickFog, revealTiles } from '../../server/game/systems/fog-system'
import type { GameState, GamePlayer, GameSettlement } from '../../shared/game-types'

// --- Helpers ---

function createFogMap(width: number, height: number, fill = 0): Uint8Array {
  return new Uint8Array(width * height).fill(fill)
}

function createPlayer(userId: string, fogMap: Uint8Array): GamePlayer {
  return {
    userId,
    factionId: 'solar_empire',
    fogMap
  }
}

function createSettlement(id: string, ownerId: string, q: number, r: number, gatherRadius: number): GameSettlement {
  return {
    id,
    ownerId,
    name: 'TestTown',
    q,
    r,
    gatherRadius,
    isCapital: true
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
    players: new Map(),
    settlements: new Map(),
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
    // Place settlement far from (0,0) and (1,0) so those tiles are not re-revealed
    const settlement = createSettlement('s1', 'p1', 10, 10, 1)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      settlements: new Map([['s1', settlement]])
    })

    tickFog(state)

    // Previously visible tile (1,0) should now be explored (1), since no settlement is nearby
    expect(getFog(fogMap, 1, 0, width)).toBe(1)
    // Previously explored tile (0,0) should remain explored (1)
    expect(getFog(fogMap, 0, 0, width)).toBe(1)
    // Unexplored tile (19,19) should remain unexplored (0)
    expect(getFog(fogMap, 19, 19, width)).toBe(0)
    // Tile around settlement at (10,10) should be visible
    expect(getFog(fogMap, 10, 10, width)).toBe(2)
  })

  it('only own settlements grant vision (not enemies)', () => {
    const width = 20
    const height = 20
    const fogMapP1 = createFogMap(width, height, 0)
    const fogMapP2 = createFogMap(width, height, 0)
    const player1 = createPlayer('p1', fogMapP1)
    const player2 = createPlayer('p2', fogMapP2)

    // P1 has a settlement at (5,5)
    const settlementP1 = createSettlement('s1', 'p1', 5, 5, 2)
    // P2 has a settlement at (15,15)
    const settlementP2 = createSettlement('s2', 'p2', 15, 15, 2)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player1], ['p2', player2]]),
      settlements: new Map([['s1', settlementP1], ['s2', settlementP2]])
    })

    tickFog(state)

    // P1 sees around (5,5) but NOT around (15,15)
    expect(getFog(fogMapP1, 5, 5, width)).toBe(2)
    expect(getFog(fogMapP1, 15, 15, width)).toBe(0)

    // P2 sees around (15,15) but NOT around (5,5)
    expect(getFog(fogMapP2, 15, 15, width)).toBe(2)
    expect(getFog(fogMapP2, 5, 5, width)).toBe(0)
  })

  it('combines vision from multiple settlements', () => {
    const width = 20
    const height = 20
    const fogMap = createFogMap(width, height, 0)
    const player = createPlayer('p1', fogMap)

    const settlement1 = createSettlement('s1', 'p1', 3, 3, 2)
    const settlement2 = createSettlement('s2', 'p1', 15, 15, 3)

    const state = createMinimalGameState({
      mapWidth: width,
      mapHeight: height,
      players: new Map([['p1', player]]),
      settlements: new Map([['s1', settlement1], ['s2', settlement2]])
    })

    tickFog(state)

    // Both areas should be visible
    expect(getFog(fogMap, 3, 3, width)).toBe(2) // settlement 1 center
    expect(getFog(fogMap, 15, 15, width)).toBe(2) // settlement 2 center
    expect(getFog(fogMap, 4, 4, width)).toBe(2) // near settlement 1
    expect(getFog(fogMap, 16, 16, width)).toBe(2) // near settlement 2
  })
})
