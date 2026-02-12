import { Container, Sprite, type Texture } from 'pixi.js'
import type { HexMapData, VisibleRange, TerrainId } from '~/utils/hex-map-data'
import { getTerrain, getElevation, HEX_SIZE, SQRT3 } from '~/utils/hex-map-data'
import type { HexTextureAtlas } from '~/utils/hex-texture-atlas'
import { elevationYOffset, calculateLightTint } from '~/utils/hex-lighting'

export interface TilePoolEntry {
  sprite: Sprite
  q: number
  r: number
}

export interface TilePool {
  tileContainer: Container
  update(range: VisibleRange, mapData: HexMapData, atlas: HexTextureAtlas, zoom: number): void
  getActiveTiles(): Map<string, TilePoolEntry>
  getActiveWaterTiles(): Map<string, TilePoolEntry>
  destroy(): void
}

const GROW_AMOUNT = 500

export function createTilePool(initialCapacity: number = 2000): TilePool {
  const tileContainer = new Container({ sortableChildren: true })

  // Pool of inactive sprites ready for reuse
  const pool: Sprite[] = []

  // Active tiles keyed by "q,r"
  const activeTiles = new Map<string, TilePoolEntry>()

  // Subset of active tiles that are water (terrain <= 1)
  const activeWaterTiles = new Map<string, TilePoolEntry>()

  // Pre-allocate initial sprites
  allocateSprites(initialCapacity)

  function allocateSprites(count: number) {
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite()
      sprite.anchor.set(0.5)
      sprite.visible = false
      sprite.tint = 0xffffff
      tileContainer.addChild(sprite)
      pool.push(sprite)
    }
  }

  function acquireSprite(): Sprite {
    if (pool.length === 0) {
      allocateSprites(GROW_AMOUNT)
    }
    const sprite = pool.pop()!
    sprite.visible = true
    return sprite
  }

  function releaseSprite(sprite: Sprite) {
    sprite.visible = false
    pool.push(sprite)
  }

  function update(
    range: VisibleRange,
    mapData: HexMapData,
    atlas: HexTextureAtlas,
    _zoom: number
  ) {
    // Build set of keys that should be visible
    const neededKeys = new Set<string>()
    for (let r = range.rMin; r <= range.rMax; r++) {
      for (let q = range.qMin; q <= range.qMax; q++) {
        neededKeys.add(`${q},${r}`)
      }
    }

    // Release tiles that are no longer visible
    for (const [key, entry] of activeTiles) {
      if (!neededKeys.has(key)) {
        releaseSprite(entry.sprite)
        activeTiles.delete(key)
        activeWaterTiles.delete(key)
      }
    }

    // Add tiles that are newly visible
    for (let r = range.rMin; r <= range.rMax; r++) {
      for (let q = range.qMin; q <= range.qMax; q++) {
        const key = `${q},${r}`
        if (activeTiles.has(key)) continue

        const terrain: TerrainId = getTerrain(mapData, q, r)
        const texture: Texture = atlas.getTexture(terrain, q, r)

        const sprite = acquireSprite()
        sprite.texture = texture

        const elev = getElevation(mapData, q, r)
        const yOffset = elevationYOffset(elev)
        sprite.x = HEX_SIZE * 1.5 * q
        sprite.y = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r) + yOffset
        sprite.zIndex = r * 1000 + Math.floor(elev / 25)
        sprite.tint = calculateLightTint(mapData, q, r)

        const entry: TilePoolEntry = { sprite, q, r }
        activeTiles.set(key, entry)

        // Track water tiles separately
        if (terrain <= 1) {
          activeWaterTiles.set(key, entry)
        }
      }
    }
  }

  function getActiveTiles(): Map<string, TilePoolEntry> {
    return activeTiles
  }

  function getActiveWaterTiles(): Map<string, TilePoolEntry> {
    return activeWaterTiles
  }

  function destroy() {
    activeTiles.clear()
    activeWaterTiles.clear()
    pool.length = 0
    tileContainer.destroy({ children: true })
  }

  return {
    tileContainer,
    update,
    getActiveTiles,
    getActiveWaterTiles,
    destroy
  }
}
