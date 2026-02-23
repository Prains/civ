import { describe, it, expect } from 'vitest'
import { createAmbientSystem } from '../../app/utils/hex-ambient-system'

function mockSprite() {
  return {
    x: 0, y: 0, alpha: 1, rotation: 0,
    scale: { x: 1, y: 1 },
    skew: { x: 0, y: 0 },
    texture: null as unknown
  }
}

describe('hex-ambient-system', () => {
  it('creates without errors', () => {
    const system = createAmbientSystem()
    expect(system).toBeDefined()
  })

  it('modifies forest feature rotation over time', () => {
    const system = createAmbientSystem()
    const featureSprite = mockSprite()
    const features = new Map([['3,3', [featureSprite]]])

    system.update({
      deltaMs: 1000,
      totalTime: 1000,
      zoom: 1.0,
      activeTiles: new Map([['3,3', { sprite: mockSprite(), q: 3, r: 3 }]]),
      activeWaterTiles: new Map(),
      activeFeatures: features,
      getTerrainId: () => 6, // forest
      waterFrames: null
    })

    // Forest config: rotation, amplitude 0.03
    expect(featureSprite.rotation).not.toBe(0)
    expect(Math.abs(featureSprite.rotation)).toBeLessThanOrEqual(0.04)
  })

  it('does not animate features at low zoom', () => {
    const system = createAmbientSystem()
    const featureSprite = mockSprite()
    const features = new Map([['3,3', [featureSprite]]])

    system.update({
      deltaMs: 1000,
      totalTime: 1000,
      zoom: 0.2, // below minZoom 0.4
      activeTiles: new Map([['3,3', { sprite: mockSprite(), q: 3, r: 3 }]]),
      activeWaterTiles: new Map(),
      activeFeatures: features,
      getTerrainId: () => 6,
      waterFrames: null
    })

    expect(featureSprite.rotation).toBe(0)
  })

  it('animates water tile scaleX', () => {
    const system = createAmbientSystem()
    const waterSprite = mockSprite()
    const tiles = new Map([['2,3', { sprite: waterSprite, q: 2, r: 3 }]])

    system.update({
      deltaMs: 1000,
      totalTime: 1500,
      zoom: 0.5,
      activeTiles: tiles,
      activeWaterTiles: tiles,
      activeFeatures: new Map(),
      getTerrainId: () => 0, // deep water
      waterFrames: null
    })

    // Water scaleX should oscillate around 1.0 with amplitude 0.02
    expect(waterSprite.scale.x).not.toBe(1)
    expect(waterSprite.scale.x).toBeGreaterThanOrEqual(0.97)
    expect(waterSprite.scale.x).toBeLessThanOrEqual(1.03)
  })
})
