import { Container, Graphics } from 'pixi.js'
import { hexToPixel, HEX_SIZE } from '~/utils/hex-map-data'
import type { VisibleRange } from '~/utils/hex-map-data'

export interface FogRenderer {
  container: Container
  update(fogMap: number[], mapWidth: number, mapHeight: number, visibleRange: VisibleRange): void
  destroy(): void
}

// Fog state constants matching shared/game-types.ts FOG_STATES
const FOG_UNEXPLORED = 0
const FOG_EXPLORED = 1
// FOG_VISIBLE = 2 — no overlay needed

const UNEXPLORED_ALPHA = 1.0
const EXPLORED_ALPHA = 0.5
const FOG_COLOR = 0x000000

const GROW_AMOUNT = 500

// Pre-compute flat-top hex polygon points centered at origin
const HEX_POINTS: number[] = []
for (let i = 0; i < 6; i++) {
  const angle = Math.PI / 3 * i
  HEX_POINTS.push(HEX_SIZE * Math.cos(angle), HEX_SIZE * Math.sin(angle))
}

interface FogPoolEntry {
  graphic: Graphics
  q: number
  r: number
}

export function createFogRenderer(initialCapacity: number = 1000): FogRenderer {
  const container = new Container()

  // Pool of inactive graphics ready for reuse
  const pool: Graphics[] = []

  // Active fog overlays keyed by "q,r"
  const activeOverlays = new Map<string, FogPoolEntry>()

  // Pre-allocate initial graphics
  allocateGraphics(initialCapacity)

  function allocateGraphics(count: number) {
    for (let i = 0; i < count; i++) {
      const graphic = new Graphics()
      graphic.visible = false
      container.addChild(graphic)
      pool.push(graphic)
    }
  }

  function acquireGraphic(): Graphics {
    if (pool.length === 0) {
      allocateGraphics(GROW_AMOUNT)
    }
    const graphic = pool.pop()!
    graphic.visible = true
    return graphic
  }

  function releaseGraphic(graphic: Graphics) {
    graphic.visible = false
    graphic.clear()
    pool.push(graphic)
  }

  function drawFogHex(graphic: Graphics, alpha: number) {
    graphic.clear()
    graphic.poly(HEX_POINTS)
    graphic.fill({ color: FOG_COLOR, alpha })
  }

  function update(
    fogMap: number[],
    mapWidth: number,
    mapHeight: number,
    visibleRange: VisibleRange
  ) {
    // Build set of keys that need fog overlays
    const neededKeys = new Set<string>()

    for (let r = visibleRange.rMin; r <= visibleRange.rMax; r++) {
      for (let q = visibleRange.qMin; q <= visibleRange.qMax; q++) {
        // Bounds check
        if (q < 0 || q >= mapWidth || r < 0 || r >= mapHeight) continue

        const fogState = fogMap[r * mapWidth + q]
        // Only need overlays for unexplored and explored tiles
        if (fogState === FOG_UNEXPLORED || fogState === FOG_EXPLORED) {
          neededKeys.add(`${q},${r}`)
        }
      }
    }

    // Release overlays that are no longer needed
    for (const [key, entry] of activeOverlays) {
      if (!neededKeys.has(key)) {
        releaseGraphic(entry.graphic)
        activeOverlays.delete(key)
      }
    }

    // Add or update fog overlays
    for (let r = visibleRange.rMin; r <= visibleRange.rMax; r++) {
      for (let q = visibleRange.qMin; q <= visibleRange.qMax; q++) {
        if (q < 0 || q >= mapWidth || r < 0 || r >= mapHeight) continue

        const fogState = fogMap[r * mapWidth + q]

        // Visible tiles get no overlay
        if (fogState !== FOG_UNEXPLORED && fogState !== FOG_EXPLORED) {
          continue
        }

        const key = `${q},${r}`
        const alpha = fogState === FOG_UNEXPLORED ? UNEXPLORED_ALPHA : EXPLORED_ALPHA
        const existing = activeOverlays.get(key)

        if (existing) {
          // Re-draw in case fog state changed (e.g. unexplored -> explored)
          drawFogHex(existing.graphic, alpha)
        } else {
          const graphic = acquireGraphic()
          const pos = hexToPixel(q, r)
          graphic.x = pos.x
          graphic.y = pos.y
          drawFogHex(graphic, alpha)
          activeOverlays.set(key, { graphic, q, r })
        }
      }
    }
  }

  function destroy() {
    activeOverlays.clear()
    pool.length = 0
    container.destroy({ children: true })
  }

  return {
    container,
    update,
    destroy
  }
}
