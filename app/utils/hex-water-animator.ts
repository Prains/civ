import type { HexMapData } from './hex-map-data'
import { getTerrain } from './hex-map-data'
import type { HexTextureAtlas } from './hex-texture-atlas'
import type { TilePool } from './hex-tile-pool'

const WATER_FRAME_INTERVAL = 15

export interface WaterAnimator {
  update(frameCount: number, tilePool: TilePool, mapData: HexMapData, atlas: HexTextureAtlas): void
  destroy(): void
}

export function createWaterAnimator(): WaterAnimator {
  let currentFrame = 0
  let lastFrameChange = 0

  return {
    update(frameCount: number, tilePool: TilePool, mapData: HexMapData, atlas: HexTextureAtlas) {
      if (frameCount - lastFrameChange < WATER_FRAME_INTERVAL) return
      lastFrameChange = frameCount
      currentFrame = (currentFrame + 1) % 4

      const waterTiles = tilePool.getActiveWaterTiles()
      for (const [_key, entry] of waterTiles) {
        const terrain = getTerrain(mapData, entry.q, entry.r) as 0 | 1
        const frames = atlas.getWaterFrames(terrain)
        entry.sprite.texture = frames[currentFrame]!
      }
    },

    destroy() {
      // Nothing to clean up
    }
  }
}
