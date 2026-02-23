import { describe, it, expect } from 'vitest'
import {
  AMBIENT_CONFIGS,
  PARTICLE_CONFIGS
} from '../../app/utils/hex-animation-config'

describe('hex-animation-config', () => {
  describe('AMBIENT_CONFIGS', () => {
    it('has configs for terrains that need ambient effects', () => {
      expect(AMBIENT_CONFIGS[0]).toBeDefined() // deep water
      expect(AMBIENT_CONFIGS[1]).toBeDefined() // shallow water
      expect(AMBIENT_CONFIGS[4]).toBeDefined() // plains
      expect(AMBIENT_CONFIGS[5]).toBeDefined() // grassland
      expect(AMBIENT_CONFIGS[6]).toBeDefined() // forest
    })

    it('has no ambient for static terrains', () => {
      expect(AMBIENT_CONFIGS[8]).toBeUndefined() // mountain
      expect(AMBIENT_CONFIGS[9]).toBeUndefined() // snow
    })

    it('ambient configs have required fields', () => {
      const waterConfig = AMBIENT_CONFIGS[0]!
      expect(waterConfig.property).toBeDefined()
      expect(waterConfig.amplitude).toBeGreaterThan(0)
      expect(waterConfig.period).toBeGreaterThan(0)
    })
  })

  describe('PARTICLE_CONFIGS', () => {
    it('has particle configs for atmospheric biomes', () => {
      expect(PARTICLE_CONFIGS[9]).toBeDefined() // snow
      expect(PARTICLE_CONFIGS[3]).toBeDefined() // desert dust
      expect(PARTICLE_CONFIGS[6]).toBeDefined() // forest fireflies
    })

    it('particle configs have required fields', () => {
      const snowConfig = PARTICLE_CONFIGS[9]!
      expect(snowConfig.spawnRate).toBeGreaterThan(0)
      expect(snowConfig.lifetime).toHaveLength(2)
      expect(snowConfig.speed).toHaveLength(2)
      expect(snowConfig.alpha).toHaveLength(2)
      expect(snowConfig.scale).toHaveLength(2)
    })
  })
})
