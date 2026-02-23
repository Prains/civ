export interface AmbientConfig {
  /** Which sprite property to animate */
  property: 'rotation' | 'skewX' | 'scaleX' | 'scaleY' | 'alpha'
  /** Max deviation from base value */
  amplitude: number
  /** Oscillation period in ms */
  period: number
  /** Base value (sprite default) */
  base: number
  /** Apply to 'tile' sprites or 'feature' sprites */
  target: 'tile' | 'feature'
  /** Minimum zoom to show this effect */
  minZoom: number
}

export interface ParticleConfig {
  /** Particle texture type */
  texture: 'dot' | 'flake' | 'spark'
  /** Particles spawned per second per visible tile of this biome */
  spawnRate: number
  /** Lifetime range [min, max] in ms */
  lifetime: [number, number]
  /** Speed range [min, max] in px/s */
  speed: [number, number]
  /** Direction range [min, max] in radians (0 = right, PI/2 = down) */
  direction: [number, number]
  /** Alpha [start, end] */
  alpha: [number, number]
  /** Scale [start, end] */
  scale: [number, number]
  /** Tint color */
  tint: number
  /** Minimum zoom to show particles */
  minZoom: number
}

/**
 * Per-terrain ambient animation configs.
 * Key = terrain ID (0-9). Undefined means no ambient effect.
 *
 * Terrain IDs: 0=deep_water, 1=shallow_water, 2=beach, 3=desert,
 * 4=plains, 5=grassland, 6=forest, 7=hills, 8=mountain, 9=snow
 */
export const AMBIENT_CONFIGS: Partial<Record<number, AmbientConfig>> = {
  0: { property: 'scaleX', amplitude: 0.02, period: 3000, base: 1, target: 'tile', minZoom: 0.25 },
  1: { property: 'scaleX', amplitude: 0.02, period: 2500, base: 1, target: 'tile', minZoom: 0.25 },
  2: { property: 'alpha', amplitude: 0.05, period: 4000, base: 1, target: 'tile', minZoom: 0.4 },
  3: { property: 'scaleY', amplitude: 0.003, period: 2000, base: 1, target: 'tile', minZoom: 0.4 },
  4: { property: 'skewX', amplitude: 0.04, period: 2800, base: 0, target: 'feature', minZoom: 0.4 },
  5: { property: 'skewX', amplitude: 0.05, period: 2500, base: 0, target: 'feature', minZoom: 0.4 },
  6: { property: 'rotation', amplitude: 0.03, period: 3500, base: 0, target: 'feature', minZoom: 0.4 },
  7: { property: 'rotation', amplitude: 0.015, period: 4000, base: 0, target: 'feature', minZoom: 0.4 }
}

/**
 * Per-terrain particle configs.
 * Key = terrain ID. Undefined means no particles.
 *
 * Terrain IDs: 0=deep_water, 1=shallow_water, 2=beach, 3=desert,
 * 4=plains, 5=grassland, 6=forest, 7=hills, 8=mountain, 9=snow
 */
export const PARTICLE_CONFIGS: Partial<Record<number, ParticleConfig>> = {
  0: { texture: 'spark', spawnRate: 0.3, lifetime: [800, 1500], speed: [0, 0], direction: [0, 0], alpha: [0, 0.6], scale: [0.5, 0.5], tint: 0xffffff, minZoom: 0.6 },
  1: { texture: 'spark', spawnRate: 0.5, lifetime: [600, 1200], speed: [0, 0], direction: [0, 0], alpha: [0, 0.7], scale: [0.4, 0.4], tint: 0xffffff, minZoom: 0.6 },
  3: { texture: 'dot', spawnRate: 0.8, lifetime: [2000, 4000], speed: [8, 20], direction: [-0.3, 0.3], alpha: [0.4, 0], scale: [0.3, 0.6], tint: 0xd4c090, minZoom: 0.4 },
  4: { texture: 'dot', spawnRate: 0.3, lifetime: [3000, 5000], speed: [3, 8], direction: [-Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5], alpha: [0.3, 0], scale: [0.2, 0.3], tint: 0xf0e080, minZoom: 0.6 },
  6: { texture: 'spark', spawnRate: 0.4, lifetime: [2000, 4000], speed: [2, 5], direction: [0, Math.PI * 2], alpha: [0, 0.8], scale: [0.3, 0.3], tint: 0xccff66, minZoom: 0.6 },
  8: { texture: 'flake', spawnRate: 0.6, lifetime: [2000, 4000], speed: [10, 25], direction: [Math.PI / 2 - 0.6, Math.PI / 2 + 0.2], alpha: [0.5, 0], scale: [0.2, 0.4], tint: 0xe8edf3, minZoom: 0.4 },
  9: { texture: 'flake', spawnRate: 1.5, lifetime: [3000, 6000], speed: [5, 15], direction: [Math.PI / 2 - 0.4, Math.PI / 2 + 0.4], alpha: [0.7, 0], scale: [0.3, 0.5], tint: 0xffffff, minZoom: 0.4 }
}
