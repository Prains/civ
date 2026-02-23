import { describe, expect, it } from 'vitest'
import { GameStateManager } from '../../server/game/game-state'

describe('GameStateManager', () => {
  it('initializes with map data and players', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4), // all plains
      elevation: new Uint8Array(400).fill(128),
      players: [
        { userId: 'p1', factionId: 'solar_empire' },
        { userId: 'p2', factionId: 'merchant_league' }
      ],
      speed: 1
    })

    expect(manager.state.tick).toBe(0)
    expect(manager.state.players.size).toBe(2)
    expect(manager.state.paused).toBe(false)
  })

  it('creates starting settlement for each player', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 50,
      mapHeight: 50,
      terrain: new Uint8Array(2500).fill(4),
      elevation: new Uint8Array(2500).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const p1Settlements = [...manager.state.settlements.values()].filter(s => s.ownerId === 'p1')
    expect(p1Settlements).toHaveLength(1)
    expect(p1Settlements[0].isCapital).toBe(true)
  })

  it('getPlayerView filters by fog of war', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4),
      elevation: new Uint8Array(400).fill(128),
      players: [
        { userId: 'p1', factionId: 'solar_empire' },
        { userId: 'p2', factionId: 'merchant_league' }
      ],
      speed: 1
    })

    const p1View = manager.getPlayerView('p1')
    // Should see own settlement
    const ownSettlements = p1View.visibleSettlements.filter(s => s.ownerId === 'p1')
    expect(ownSettlements.length).toBeGreaterThan(0)
  })

  it('creates fog map initialized around starting positions', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4),
      elevation: new Uint8Array(400).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const player = manager.state.players.get('p1')!
    // Fog map should exist with correct size
    expect(player.fogMap).toBeInstanceOf(Uint8Array)
    expect(player.fogMap.length).toBe(400)

    // Some tiles should be visible (value 2) around starting position
    const visibleCount = [...player.fogMap].filter(v => v === 2).length
    expect(visibleCount).toBeGreaterThan(0)
  })

  it('findSpawnPosition places players far apart', () => {
    const mapWidth = 50
    const mapHeight = 50
    const terrain = new Uint8Array(mapWidth * mapHeight).fill(4) // all plains

    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128),
      players: [
        { userId: 'p1', factionId: 'solar_empire' },
        { userId: 'p2', factionId: 'merchant_league' }
      ],
      speed: 1
    })

    const p1Settlement = [...manager.state.settlements.values()].find(s => s.ownerId === 'p1')!
    const p2Settlement = [...manager.state.settlements.values()].find(s => s.ownerId === 'p2')!

    // Calculate distance between settlements
    const dq = p1Settlement.q - p2Settlement.q
    const dr = p1Settlement.r - p2Settlement.r
    const distance = Math.sqrt(dq * dq + dr * dr)
    expect(distance).toBeGreaterThanOrEqual(15)
  })

  it('avoids water and mountain tiles for spawning', () => {
    const mapWidth = 20
    const mapHeight = 20
    const terrain = new Uint8Array(mapWidth * mapHeight)
    // Fill with water (0)
    terrain.fill(0)
    // Create a small land patch in center
    for (let r = 8; r <= 12; r++) {
      for (let q = 8; q <= 12; q++) {
        terrain[r * mapWidth + q] = 4 // plains
      }
    }

    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth,
      mapHeight,
      terrain,
      elevation: new Uint8Array(mapWidth * mapHeight).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const settlement = [...manager.state.settlements.values()].find(s => s.ownerId === 'p1')!
    // Settlement should be placed on land (within the patch)
    expect(settlement.q).toBeGreaterThanOrEqual(8)
    expect(settlement.q).toBeLessThanOrEqual(12)
    expect(settlement.r).toBeGreaterThanOrEqual(8)
    expect(settlement.r).toBeLessThanOrEqual(12)
  })

  it('sets correct game metadata', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game-123',
      mapWidth: 30,
      mapHeight: 25,
      terrain: new Uint8Array(750).fill(4),
      elevation: new Uint8Array(750).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 2
    })

    expect(manager.state.gameId).toBe('test-game-123')
    expect(manager.state.mapWidth).toBe(30)
    expect(manager.state.mapHeight).toBe(25)
    expect(manager.state.speed).toBe(2)
    expect(manager.state.terrain.length).toBe(750)
    expect(manager.state.elevation.length).toBe(750)
  })

  it('getPlayerView returns correct client state shape', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4),
      elevation: new Uint8Array(400).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const view = manager.getPlayerView('p1')
    expect(view.tick).toBe(0)
    expect(view.factionId).toBe('solar_empire')
    expect(view.paused).toBe(false)
    expect(view.speed).toBe(1)
    expect(view.visibleSettlements).toBeInstanceOf(Array)
    expect(view.fogMap).toBeInstanceOf(Array)
  })

  it('getPlayerView includes own settlements', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4),
      elevation: new Uint8Array(400).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const view = manager.getPlayerView('p1')
    const ownSettlements = view.visibleSettlements.filter(s => s.ownerId === 'p1')
    expect(ownSettlements).toHaveLength(1)
  })

  it('settlement has correct stats', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 50,
      mapHeight: 50,
      terrain: new Uint8Array(2500).fill(4),
      elevation: new Uint8Array(2500).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const settlement = [...manager.state.settlements.values()].find(s => s.ownerId === 'p1')!
    expect(settlement.gatherRadius).toBe(2)
    expect(settlement.isCapital).toBe(true)
    expect(settlement.name).toBeTruthy()
  })
})
