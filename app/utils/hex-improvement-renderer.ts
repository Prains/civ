import { Container, Graphics } from 'pixi.js'
import { hexToPixel, HEX_SIZE } from '~/utils/hex-map-data'
import type { ImprovementType } from '../../shared/game-types'

const ROAD_COLOR = 0x8B4513
const FARM_COLOR = 0x228B22
const MINE_COLOR = 0x808080

interface ImprovementSprite {
  container: Container
  graphics: Graphics
  key: string
}

export interface VisibleBounds {
  minQ: number
  maxQ: number
  minR: number
  maxR: number
}

export interface ImprovementRenderer {
  container: Container
  update(improvements: Map<string, ImprovementType>, visibleBounds: VisibleBounds): void
  destroy(): void
}

function drawImprovement(g: Graphics, type: ImprovementType): void {
  const size = HEX_SIZE * 0.25

  switch (type) {
    case 'road': {
      // Brown horizontal strip
      g.rect(-size * 1.5, -size * 0.3, size * 3, size * 0.6)
      g.fill({ color: ROAD_COLOR })
      break
    }
    case 'farm_improvement': {
      // Green square patch
      g.rect(-size, -size, size * 2, size * 2)
      g.fill({ color: FARM_COLOR })
      // Cross-hatch lines for field effect
      g.setStrokeStyle({ width: 1, color: 0x1a6b1a })
      g.moveTo(-size, 0)
      g.lineTo(size, 0)
      g.stroke()
      g.moveTo(0, -size)
      g.lineTo(0, size)
      g.stroke()
      break
    }
    case 'mine': {
      // Gray triangle (pickaxe shape)
      g.beginPath()
      g.moveTo(0, -size)
      g.lineTo(-size, size)
      g.lineTo(size, size)
      g.closePath()
      g.fill({ color: MINE_COLOR })
      break
    }
  }
}

function parseKey(key: string): { q: number, r: number } | null {
  const parts = key.split(',')
  if (parts.length !== 2) return null
  const q = Number(parts[0])
  const r = Number(parts[1])
  if (Number.isNaN(q) || Number.isNaN(r)) return null
  return { q, r }
}

export function createImprovementRenderer(): ImprovementRenderer {
  const container = new Container({ sortableChildren: true })
  const pool: ImprovementSprite[] = []
  const active = new Map<string, ImprovementSprite>()

  function getSprite(): ImprovementSprite {
    const pooled = pool.pop()
    if (pooled) {
      pooled.graphics.clear()
      pooled.container.visible = true
      return pooled
    }

    const c = new Container()
    const g = new Graphics()
    c.addChild(g)
    container.addChild(c)
    return { container: c, graphics: g, key: '' }
  }

  function releaseSprite(sprite: ImprovementSprite): void {
    sprite.container.visible = false
    pool.push(sprite)
  }

  function update(
    improvements: Map<string, ImprovementType>,
    visibleBounds: VisibleBounds
  ): void {
    const stillVisible = new Set<string>()

    for (const [key, type] of improvements) {
      const coords = parseKey(key)
      if (!coords) continue

      const { q, r } = coords

      // Skip tiles outside visible bounds
      if (q < visibleBounds.minQ || q > visibleBounds.maxQ) continue
      if (r < visibleBounds.minR || r > visibleBounds.maxR) continue

      stillVisible.add(key)

      // Already rendered at this position
      if (active.has(key)) continue

      // Get or create sprite
      const sprite = getSprite()
      sprite.key = key

      // Draw the improvement shape
      drawImprovement(sprite.graphics, type)

      // Position on hex grid
      const pos = hexToPixel(q, r)
      sprite.container.position.set(pos.x, pos.y)
      sprite.container.zIndex = r * 1000 + 100

      active.set(key, sprite)
    }

    // Release sprites that are no longer visible or no longer exist
    for (const [key, sprite] of active) {
      if (!stillVisible.has(key)) {
        releaseSprite(sprite)
        active.delete(key)
      }
    }
  }

  function destroy(): void {
    active.clear()
    pool.length = 0
    container.destroy({ children: true })
  }

  return {
    container,
    update,
    destroy
  }
}
