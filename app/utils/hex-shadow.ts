import { Container, Sprite, Texture } from 'pixi.js'
import type { HexMapData, VisibleRange } from './hex-map-data'
import { getTerrain, HEX_SIZE, SQRT3 } from './hex-map-data'

const SHADOW_OFFSET_X = 4
const SHADOW_OFFSET_Y = 6
const SHADOW_ALPHA = 0.25

function generateShadowTexture(): Texture {
  const w = 64
  const h = 56
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const cx = w / 2
  const cy = h / 2

  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    const x = cx + 28 * Math.cos(angle)
    const y = cy + 28 * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)')
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fill()

  return Texture.from({ resource: canvas, label: 'hex-shadow' })
}

export interface ShadowPool {
  container: Container
  update(range: VisibleRange, mapData: HexMapData): void
  destroy(): void
}

export function createShadowPool(): ShadowPool {
  const container = new Container()
  const shadowTexture = generateShadowTexture()
  const active = new Map<string, Sprite>()
  const freeList: Sprite[] = []

  for (let i = 0; i < 200; i++) {
    const sprite = new Sprite({ texture: shadowTexture, anchor: 0.5, alpha: SHADOW_ALPHA, visible: false })
    container.addChild(sprite)
    freeList.push(sprite)
  }

  function acquire(): Sprite {
    if (freeList.length === 0) {
      for (let i = 0; i < 100; i++) {
        const sprite = new Sprite({ texture: shadowTexture, anchor: 0.5, alpha: SHADOW_ALPHA, visible: false })
        container.addChild(sprite)
        freeList.push(sprite)
      }
    }
    return freeList.pop()!
  }

  return {
    container,

    update(range: VisibleRange, mapData: HexMapData) {
      const newKeys = new Set<string>()

      for (let r = range.rMin; r <= range.rMax; r++) {
        for (let q = range.qMin; q <= range.qMax; q++) {
          const terrain = getTerrain(mapData, q, r)
          if (terrain < 7) continue

          const key = `${q},${r}`
          newKeys.add(key)

          if (!active.has(key)) {
            const sprite = acquire()
            const px = HEX_SIZE * 1.5 * q + SHADOW_OFFSET_X
            const py = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r) + SHADOW_OFFSET_Y
            sprite.position.set(px, py)
            sprite.visible = true
            active.set(key, sprite)
          }
        }
      }

      for (const [key, sprite] of active) {
        if (!newKeys.has(key)) {
          sprite.visible = false
          freeList.push(sprite)
          active.delete(key)
        }
      }
    },

    destroy() {
      shadowTexture.destroy(true)
      container.destroy({ children: true })
    }
  }
}
