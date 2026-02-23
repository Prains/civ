import { Container, Sprite } from 'pixi.js'
import type { HexMapData, VisibleRange, TerrainId } from './hex-map-data'
import { getTerrain, seededRandom, HEX_SIZE, SQRT3 } from './hex-map-data'
import { BIOME_FEATURE_CONFIGS, createFeatureTextures, type FeatureTextureSet } from './hex-feature-textures'

interface FeaturePlacement {
  typeIndex: number
  variant: number
  offsetX: number
  offsetY: number
  scale: number
}

export function getFeaturesForTile(terrainId: number, q: number, r: number): FeaturePlacement[] {
  const config = BIOME_FEATURE_CONFIGS[terrainId]
  if (!config) return []

  const rng = seededRandom(q * 73856093 ^ r * 19349663)
  const count = config.minCount + Math.floor(rng() * (config.maxCount - config.minCount + 1))
  const features: FeaturePlacement[] = []

  for (let i = 0; i < count; i++) {
    features.push({
      typeIndex: Math.floor(rng() * config.types.length),
      variant: Math.floor(rng() * 3),
      offsetX: (rng() - 0.5) * HEX_SIZE * 0.7,
      offsetY: (rng() - 0.5) * HEX_SIZE * SQRT3 * 0.35,
      scale: 0.8 + rng() * 0.4
    })
  }
  return features
}

export interface FeaturePool {
  container: Container
  update(range: VisibleRange, mapData: HexMapData): void
  getActiveFeatures(): Map<string, Sprite[]>
  destroy(): void
}

export function createFeaturePool(): FeaturePool {
  const container = new Container({ sortableChildren: true })
  const textures: FeatureTextureSet = createFeatureTextures()
  const active = new Map<string, Sprite[]>()
  const freeList: Sprite[] = []

  for (let i = 0; i < 2000; i++) {
    const sprite = new Sprite({ anchor: { x: 0.5, y: 0.9 }, visible: false })
    container.addChild(sprite)
    freeList.push(sprite)
  }

  function acquire(): Sprite {
    if (freeList.length === 0) {
      for (let i = 0; i < 500; i++) {
        const sprite = new Sprite({ anchor: { x: 0.5, y: 0.9 }, visible: false })
        container.addChild(sprite)
        freeList.push(sprite)
      }
    }
    return freeList.pop()!
  }

  return {
    container,

    getActiveFeatures: () => active,

    update(range: VisibleRange, mapData: HexMapData) {
      const newKeys = new Set<string>()

      for (let r = range.rMin; r <= range.rMax; r++) {
        for (let q = range.qMin; q <= range.qMax; q++) {
          const key = `${q},${r}`
          newKeys.add(key)

          if (active.has(key)) continue

          const terrain = getTerrain(mapData, q, r) as TerrainId
          const placements = getFeaturesForTile(terrain, q, r)
          if (placements.length === 0) continue

          const config = BIOME_FEATURE_CONFIGS[terrain]!
          const px = HEX_SIZE * 1.5 * q
          const py = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r)
          const sprites: Sprite[] = []

          for (const p of placements) {
            const sprite = acquire()
            const ft = config.types[p.typeIndex]
            if (!ft) continue
            sprite.texture = textures.getTexture(ft, p.variant)
            sprite.position.set(px + p.offsetX, py + p.offsetY)
            sprite.scale.set(p.scale)
            sprite.zIndex = r * 1000 + 500
            sprite.visible = true
            sprites.push(sprite)
          }

          if (sprites.length > 0) {
            active.set(key, sprites)
          }
        }
      }

      for (const [key, sprites] of active) {
        if (!newKeys.has(key)) {
          for (const sprite of sprites) {
            sprite.visible = false
            freeList.push(sprite)
          }
          active.delete(key)
        }
      }
    },

    destroy() {
      textures.destroy()
      container.destroy({ children: true })
    }
  }
}
