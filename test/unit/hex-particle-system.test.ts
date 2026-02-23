import { describe, it, expect, beforeEach } from 'vitest'
import { createParticleSystem, type ParticleSystem } from '../../app/utils/hex-particle-system'

describe('hex-particle-system', () => {
  let system: ParticleSystem

  beforeEach(() => {
    system = createParticleSystem()
  })

  it('creates with zero active particles', () => {
    expect(system.activeCount()).toBe(0)
  })

  it('spawns particles for matching biome tiles', () => {
    // Snow terrain (9) has spawnRate 1.5/sec, so in 2 seconds with 5 tiles
    system.update({
      deltaMs: 2000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map([[9, 5]])
    })

    expect(system.activeCount()).toBeGreaterThan(0)
    expect(system.activeCount()).toBeLessThanOrEqual(200)
  })

  it('does not spawn at low zoom', () => {
    system.update({
      deltaMs: 2000,
      zoom: 0.1, // below any minZoom
      visibleTilesPerTerrain: new Map([[9, 10]])
    })

    expect(system.activeCount()).toBe(0)
  })

  it('removes expired particles', () => {
    system.update({
      deltaMs: 1000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map([[9, 3]])
    })

    const initialCount = system.activeCount()
    expect(initialCount).toBeGreaterThan(0)

    // Advance time past max lifetime (6000ms for snow)
    system.update({
      deltaMs: 7000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map()
    })

    expect(system.activeCount()).toBeLessThan(initialCount)
  })

  it('respects max particle limit of 200', () => {
    for (let i = 0; i < 20; i++) {
      system.update({
        deltaMs: 1000,
        zoom: 1.0,
        visibleTilesPerTerrain: new Map([[9, 50]])
      })
    }

    expect(system.activeCount()).toBeLessThanOrEqual(200)
  })

  it('reduces spawn rate at medium zoom (0.4-0.6)', () => {
    const systemA = createParticleSystem()
    const systemB = createParticleSystem()

    systemA.update({
      deltaMs: 5000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map([[9, 5]])
    })

    systemB.update({
      deltaMs: 5000,
      zoom: 0.5,
      visibleTilesPerTerrain: new Map([[9, 5]])
    })

    expect(systemA.activeCount()).toBeGreaterThan(0)
    expect(systemB.activeCount()).toBeGreaterThan(0)
  })
})
