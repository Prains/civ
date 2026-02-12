import { describe, it, expect } from 'vitest'
import {
  buildMapData, getElevation, getElevationSafe,
  getHexNeighbors, seededRandom
} from '../../app/utils/hex-map-data'

describe('elevation in HexMapData', () => {
  it('buildMapData stores elevation as Uint8Array', () => {
    const map = buildMapData([5, 0], [128, 255], 2, 1)
    expect(map.elevation).toBeInstanceOf(Uint8Array)
    expect(map.elevation[0]).toBe(128)
    expect(map.elevation[1]).toBe(255)
  })

  it('getElevation returns correct value', () => {
    const map = buildMapData([0, 0, 0, 0], [10, 20, 30, 40], 2, 2)
    expect(getElevation(map, 1, 0)).toBe(20)
    expect(getElevation(map, 0, 1)).toBe(30)
  })

  it('getElevationSafe returns 0 for out-of-bounds', () => {
    const map = buildMapData([0], [100], 1, 1)
    expect(getElevationSafe(map, -1, 0)).toBe(0)
    expect(getElevationSafe(map, 0, 5)).toBe(0)
  })

  it('getHexNeighbors returns 6 neighbors for even column', () => {
    const neighbors = getHexNeighbors(2, 2)
    expect(neighbors).toHaveLength(6)
  })

  it('seededRandom is deterministic', () => {
    const rng1 = seededRandom(42)
    const rng2 = seededRandom(42)
    expect(rng1()).toBe(rng2())
    expect(rng1()).toBe(rng2())
  })
})
