import { AMBIENT_CONFIGS, type AmbientConfig } from './hex-animation-config'

interface AmbientUpdateParams {
  deltaMs: number
  totalTime: number
  zoom: number
  activeTiles: Map<string, { sprite: { scale: { x: number, y: number }, skew: { x: number, y: number }, alpha: number, rotation: number }, q: number, r: number }>
  activeWaterTiles: Map<string, { sprite: { texture: unknown }, q: number, r: number }>
  activeFeatures: Map<string, Array<{ rotation: number, skew: { x: number, y: number }, scale: { x: number, y: number }, alpha: number }>>
  getTerrainId: (q: number, r: number) => number
  waterFrames: ((terrainId: number) => unknown[]) | null
}

export interface AmbientSystem {
  update(params: AmbientUpdateParams): void
}

const WATER_FRAME_INTERVAL_MS = 250

function hashSeed(q: number, r: number): number {
  return Math.abs((q * 73856093) ^ (r * 19349663))
}

function applyAmbientToSprite(
  sprite: { rotation: number, scale: { x: number, y: number }, skew: { x: number, y: number }, alpha: number },
  config: AmbientConfig,
  totalTime: number,
  seed: number
) {
  const phase = (seed % 1000) / 1000 * Math.PI * 2
  const value = config.base + Math.sin((totalTime / config.period) * Math.PI * 2 + phase) * config.amplitude

  switch (config.property) {
    case 'rotation':
      sprite.rotation = value
      break
    case 'skewX':
      sprite.skew.x = value
      break
    case 'scaleX':
      sprite.scale.x = value
      break
    case 'scaleY':
      sprite.scale.y = value
      break
    case 'alpha':
      sprite.alpha = value
      break
  }
}

export function createAmbientSystem(): AmbientSystem {
  // Instance-level water frame state (not module-level) for testability and multiple instances
  let waterFrameIndex = 0
  let waterFrameTimer = 0

  function update(params: AmbientUpdateParams): void {
    const { totalTime, zoom, activeTiles, activeWaterTiles, activeFeatures, getTerrainId, waterFrames } = params

    // Water texture frame cycling (migrated from hex-water-animator)
    if (waterFrames && zoom >= 0.25) {
      waterFrameTimer += params.deltaMs
      if (waterFrameTimer >= WATER_FRAME_INTERVAL_MS) {
        waterFrameTimer -= WATER_FRAME_INTERVAL_MS
        waterFrameIndex = (waterFrameIndex + 1) % 4
        for (const [, entry] of activeWaterTiles) {
          const terrain = getTerrainId(entry.q, entry.r)
          const frames = waterFrames(terrain)
          if (frames && frames[waterFrameIndex]) {
            entry.sprite.texture = frames[waterFrameIndex]
          }
        }
      }
    }

    // Tile ambient effects
    for (const [, entry] of activeTiles) {
      const terrain = getTerrainId(entry.q, entry.r)
      const config = AMBIENT_CONFIGS[terrain]
      if (!config || config.target !== 'tile' || zoom < config.minZoom) continue
      const seed = hashSeed(entry.q, entry.r)
      applyAmbientToSprite(entry.sprite, config, totalTime, seed)
    }

    // Feature ambient effects
    for (const [key, sprites] of activeFeatures) {
      const [qStr, rStr] = key.split(',')
      const q = Number(qStr)
      const r = Number(rStr)
      const terrain = getTerrainId(q, r)
      const config = AMBIENT_CONFIGS[terrain]
      if (!config || config.target !== 'feature' || zoom < config.minZoom) continue

      for (let i = 0; i < sprites.length; i++) {
        const seed = hashSeed(q, r) + i * 7919
        applyAmbientToSprite(sprites[i], config, totalTime, seed)
      }
    }
  }

  return { update }
}
