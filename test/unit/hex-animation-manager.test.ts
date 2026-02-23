import { describe, it, expect } from 'vitest'
import { createAnimationManager } from '../../app/utils/hex-animation-manager'

describe('hex-animation-manager', () => {
  it('creates with all subsystems', () => {
    const manager = createAnimationManager()
    expect(manager).toBeDefined()
    expect(manager.tween).toBeDefined()
    expect(manager.ambient).toBeDefined()
    expect(manager.particles).toBeDefined()
    expect(manager.transitions).toBeDefined()
  })

  it('update increments totalTime', () => {
    const manager = createAnimationManager()
    expect(manager.totalTime()).toBe(0)

    manager.update({
      deltaMs: 100,
      zoom: 1.0,
      activeTiles: new Map(),
      activeWaterTiles: new Map(),
      activeFeatures: new Map(),
      getTerrainId: () => 0,
      waterFrames: null,
      visibleTilesPerTerrain: new Map()
    })

    expect(manager.totalTime()).toBe(100)
  })

  it('update drives tween engine (and transitions via tween hook)', () => {
    const manager = createAnimationManager()
    const target = { x: 0, y: 0, alpha: 1, rotation: 0 }
    manager.tween.to(target, { x: 100 }, { duration: 1000, easing: 'linear' })

    manager.update({
      deltaMs: 500,
      zoom: 1.0,
      activeTiles: new Map(),
      activeWaterTiles: new Map(),
      activeFeatures: new Map(),
      getTerrainId: () => 0,
      waterFrames: null,
      visibleTilesPerTerrain: new Map()
    })

    expect(target.x).toBeCloseTo(50, 0)
  })
})
