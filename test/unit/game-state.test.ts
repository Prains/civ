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

  it('creates starting units and settlement for each player', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 50,
      mapHeight: 50,
      terrain: new Uint8Array(2500).fill(4),
      elevation: new Uint8Array(2500).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const p1Units = [...manager.state.units.values()].filter(u => u.ownerId === 'p1')
    expect(p1Units).toHaveLength(4) // 2 scouts + 1 gatherer + 1 builder

    const p1Settlements = [...manager.state.settlements.values()].filter(s => s.ownerId === 'p1')
    expect(p1Settlements).toHaveLength(1)
    expect(p1Settlements[0].isCapital).toBe(true)
  })

  it('initializes player resources', () => {
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
    expect(player.resources.food).toBeGreaterThan(0)
    expect(player.resources.gold).toBeGreaterThan(0)
    expect(player.advisors).toHaveLength(5)
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
    // Should see own units but not necessarily all of p2's units
    const ownUnits = p1View.visibleUnits.filter(u => u.ownerId === 'p1')
    expect(ownUnits.length).toBeGreaterThan(0)
  })

  it('stores correct starting resources', () => {
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
    expect(player.resources).toEqual({
      food: 50,
      production: 30,
      gold: 30,
      science: 0,
      culture: 0
    })
  })

  it('initializes advisors with faction-specific loyalty', () => {
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
    const general = player.advisors.find(a => a.type === 'general')!
    expect(general.loyalty).toBe(70) // solar_empire general starts at 70
    const priest = player.advisors.find(a => a.type === 'priest')!
    expect(priest.loyalty).toBe(40) // solar_empire priest starts at 40
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

  it('creates correct unit types for starting units', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 50,
      mapHeight: 50,
      terrain: new Uint8Array(2500).fill(4),
      elevation: new Uint8Array(2500).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const p1Units = [...manager.state.units.values()].filter(u => u.ownerId === 'p1')
    const scouts = p1Units.filter(u => u.type === 'scout')
    const gatherers = p1Units.filter(u => u.type === 'gatherer')
    const builders = p1Units.filter(u => u.type === 'builder')

    expect(scouts).toHaveLength(2)
    expect(gatherers).toHaveLength(1)
    expect(builders).toHaveLength(1)
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

  it('initializes empty collections for improvements, neutral units, and barbarian camps', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4),
      elevation: new Uint8Array(400).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    expect(manager.state.improvements.size).toBe(0)
    expect(manager.state.neutralUnits.size).toBe(0)
    expect(manager.state.barbarianCamps).toHaveLength(0)
  })

  it('initializes diplomacy as peace between all players', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 50,
      mapHeight: 50,
      terrain: new Uint8Array(2500).fill(4),
      elevation: new Uint8Array(2500).fill(128),
      players: [
        { userId: 'p1', factionId: 'solar_empire' },
        { userId: 'p2', factionId: 'merchant_league' },
        { userId: 'p3', factionId: 'forest_keepers' }
      ],
      speed: 1
    })

    // 3 players = 3 pairs of diplomacy
    expect(manager.state.diplomacy).toHaveLength(3)
    for (const d of manager.state.diplomacy) {
      expect(d.status).toBe('peace')
    }
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
    expect(view.resources).toBeDefined()
    expect(view.resourceIncome).toBeDefined()
    expect(view.resourceUpkeep).toBeDefined()
    expect(view.policies).toBeDefined()
    expect(view.advisors).toBeDefined()
    expect(view.currentResearch).toBeNull()
    expect(view.researchProgress).toBe(0)
    expect(view.researchedTechs).toEqual([])
    expect(view.passedLaws).toEqual([])
    expect(view.visibleUnits).toBeInstanceOf(Array)
    expect(view.visibleSettlements).toBeInstanceOf(Array)
    expect(view.fogMap).toBeInstanceOf(Array)
    expect(view.diplomacy).toBeInstanceOf(Array)
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

  it('units have correct stats from unit definitions', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 50,
      mapHeight: 50,
      terrain: new Uint8Array(2500).fill(4),
      elevation: new Uint8Array(2500).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const scout = [...manager.state.units.values()].find(u => u.type === 'scout')!
    expect(scout.maxHp).toBe(50)
    expect(scout.hp).toBe(50)
    expect(scout.strength).toBe(2)
    expect(scout.visionRange).toBe(4)
    expect(scout.moveSpeed).toBe(2)
    expect(scout.state).toBe('idle')
  })

  it('settlement has correct stats from settlement definitions', () => {
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
    expect(settlement.tier).toBe('outpost')
    expect(settlement.maxHp).toBe(100)
    expect(settlement.hp).toBe(100)
    expect(settlement.defense).toBe(5)
    expect(settlement.buildingSlots).toBe(2)
    expect(settlement.gatherRadius).toBe(2)
    expect(settlement.buildings).toEqual([])
  })
})
