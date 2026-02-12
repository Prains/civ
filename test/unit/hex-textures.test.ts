import { describe, it, expect } from 'vitest'
import { BIOME_TEXTURE_CONFIGS } from '../../app/utils/hex-texture-atlas'
import { BIOME_FEATURE_CONFIGS } from '../../app/utils/hex-feature-textures'

describe('texture atlas config', () => {
  it('BIOME_TEXTURE_CONFIGS has entry for each terrain ID 0-9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(BIOME_TEXTURE_CONFIGS[i]).toBeDefined()
      expect(BIOME_TEXTURE_CONFIGS[i].variants).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('feature texture config', () => {
  it('BIOME_FEATURE_CONFIGS maps biomes to feature types', () => {
    // Forest (6) should have tree features
    expect(BIOME_FEATURE_CONFIGS[6]).toBeDefined()
    expect(BIOME_FEATURE_CONFIGS[6]!.types.length).toBeGreaterThan(0)
    // Deep water (0) should have no features
    expect(BIOME_FEATURE_CONFIGS[0]).toBeUndefined()
  })
})
