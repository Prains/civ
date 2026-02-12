import { describe, it, expect } from 'vitest'
import { getFeaturesForTile } from '../../app/utils/hex-feature-pool'

describe('getFeaturesForTile', () => {
  it('returns no features for deep water', () => {
    const features = getFeaturesForTile(0, 5, 5)
    expect(features).toHaveLength(0)
  })

  it('returns features for forest tiles', () => {
    const features = getFeaturesForTile(6, 10, 10)
    expect(features.length).toBeGreaterThanOrEqual(2)
    expect(features.length).toBeLessThanOrEqual(4)
  })

  it('is deterministic for same coordinates', () => {
    const a = getFeaturesForTile(6, 10, 10)
    const b = getFeaturesForTile(6, 10, 10)
    expect(a).toEqual(b)
  })
})
