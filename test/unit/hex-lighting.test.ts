import { describe, it, expect } from 'vitest'
import { calculateLightTint, elevationYOffset } from '../../app/utils/hex-lighting'
import { buildMapData } from '../../app/utils/hex-map-data'

describe('elevationYOffset', () => {
  it('returns 0 for water-level elevation', () => {
    expect(elevationYOffset(50)).toBe(0)
  })

  it('returns negative offset for mountains', () => {
    const offset = elevationYOffset(230)
    expect(offset).toBeLessThan(0)
    expect(offset).toBeGreaterThan(-10)
  })
})

describe('calculateLightTint', () => {
  it('returns neutral tint for flat terrain', () => {
    const map = buildMapData(
      Array(9).fill(5),
      Array(9).fill(128),
      3, 3
    )
    const tint = calculateLightTint(map, 1, 1)
    expect(tint).toBeGreaterThan(0xd0d0d0)
  })

  it('returns brighter tint when facing light source', () => {
    const elev = [80, 80, 80, 80, 200, 80, 80, 80, 80]
    const map = buildMapData(Array(9).fill(5), elev, 3, 3)
    const tint = calculateLightTint(map, 1, 1)
    expect(tint).toBeGreaterThan(0xc8c8c8)
  })
})
