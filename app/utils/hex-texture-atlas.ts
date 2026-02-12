import { Texture } from 'pixi.js'
import type { TerrainId } from './hex-map-data'
import { HEX_SIZE, SQRT3 } from './hex-map-data'

export interface BiomeTextureConfig {
  baseColor: string
  detailType: 'grain' | 'patches' | 'striations' | 'waves'
  detailColor: string
  noiseIntensity: number
  variants: number
}

export const BIOME_TEXTURE_CONFIGS: Record<number, BiomeTextureConfig> = {
  0: { baseColor: '#1e3a5f', detailType: 'waves', detailColor: '#162d4a', noiseIntensity: 0.3, variants: 3 },
  1: { baseColor: '#60a5fa', detailType: 'waves', detailColor: '#4a8fd4', noiseIntensity: 0.25, variants: 3 },
  2: { baseColor: '#f5d08a', detailType: 'grain', detailColor: '#e0bc70', noiseIntensity: 0.4, variants: 3 },
  3: { baseColor: '#e8c86a', detailType: 'striations', detailColor: '#d4b456', noiseIntensity: 0.35, variants: 2 },
  4: { baseColor: '#a8d86a', detailType: 'grain', detailColor: '#94c456', noiseIntensity: 0.3, variants: 3 },
  5: { baseColor: '#4ade80', detailType: 'patches', detailColor: '#36c96c', noiseIntensity: 0.4, variants: 3 },
  6: { baseColor: '#2d8a4e', detailType: 'patches', detailColor: '#1f6e3a', noiseIntensity: 0.5, variants: 3 },
  7: { baseColor: '#b8956a', detailType: 'striations', detailColor: '#a07e56', noiseIntensity: 0.45, variants: 2 },
  8: { baseColor: '#9ca3af', detailType: 'grain', detailColor: '#8a919b', noiseIntensity: 0.5, variants: 2 },
  9: { baseColor: '#e8edf3', detailType: 'patches', detailColor: '#c8d4e4', noiseIntensity: 0.2, variants: 2 }
}

const HEX_TEX_W = Math.ceil(2 * HEX_SIZE) + 2
const HEX_TEX_H = Math.ceil(SQRT3 * HEX_SIZE) + 2

function createHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawDetail(
  ctx: CanvasRenderingContext2D,
  config: BiomeTextureConfig,
  seed: number,
  w: number,
  h: number
) {
  let s = seed | 0
  const rng = () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }

  ctx.globalAlpha = config.noiseIntensity

  switch (config.detailType) {
    case 'grain':
      for (let i = 0; i < 80; i++) {
        const x = rng() * w
        const y = rng() * h
        const radius = 0.5 + rng() * 1.5
        ctx.fillStyle = rng() > 0.5 ? config.detailColor : config.baseColor
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      break

    case 'patches':
      for (let i = 0; i < 12; i++) {
        const x = rng() * w
        const y = rng() * h
        const radius = 3 + rng() * 6
        ctx.fillStyle = config.detailColor
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      break

    case 'striations':
      ctx.strokeStyle = config.detailColor
      ctx.lineWidth = 1
      for (let i = 0; i < 6; i++) {
        const y = rng() * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.quadraticCurveTo(w / 2, y + (rng() - 0.5) * 10, w, y + (rng() - 0.5) * 5)
        ctx.stroke()
      }
      break

    case 'waves':
      ctx.strokeStyle = config.detailColor
      ctx.lineWidth = 1.5
      for (let i = 0; i < 5; i++) {
        const baseY = (h / 6) * (i + 1)
        ctx.beginPath()
        for (let x = 0; x <= w; x += 4) {
          const y = baseY + Math.sin((x + seed * 10) * 0.15) * 2.5
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      break
  }

  ctx.globalAlpha = 1.0
}

function generateHexTexture(terrainId: number, variantIndex: number): HTMLCanvasElement {
  const config = BIOME_TEXTURE_CONFIGS[terrainId]
  if (!config) {
    throw new Error(`No texture config for terrain ${terrainId}`)
  }
  const canvas = document.createElement('canvas')
  canvas.width = HEX_TEX_W
  canvas.height = HEX_TEX_H
  const ctx = canvas.getContext('2d')!
  const cx = HEX_TEX_W / 2
  const cy = HEX_TEX_H / 2

  createHexPath(ctx, cx, cy, HEX_SIZE)
  ctx.clip()

  ctx.fillStyle = config.baseColor
  ctx.fillRect(0, 0, HEX_TEX_W, HEX_TEX_H)

  drawDetail(ctx, config, terrainId * 100 + variantIndex * 37, HEX_TEX_W, HEX_TEX_H)

  return canvas
}

export interface HexTextureAtlas {
  getTexture(terrainId: TerrainId, q: number, r: number): Texture
  getWaterFrames(terrainId: 0 | 1): Texture[]
  destroy(): void
}

export function createHexTextureAtlas(): HexTextureAtlas {
  const textures: Texture[][] = []

  for (let t = 0; t <= 9; t++) {
    const config = BIOME_TEXTURE_CONFIGS[t]
    if (!config) {
      throw new Error(`No texture config for terrain ${t}`)
    }
    const variants: Texture[] = []
    for (let v = 0; v < config.variants; v++) {
      const canvas = generateHexTexture(t, v)
      variants.push(Texture.from({ resource: canvas, label: `terrain-${t}-v${v}` }))
    }
    textures.push(variants)
  }

  const waterFrames: Map<number, Texture[]> = new Map()
  for (const waterTerrain of [0, 1] as const) {
    const frames: Texture[] = []
    for (let f = 0; f < 4; f++) {
      const canvas = generateHexTexture(waterTerrain, 10 + f)
      frames.push(Texture.from({ resource: canvas, label: `water-${waterTerrain}-f${f}` }))
    }
    waterFrames.set(waterTerrain, frames)
  }

  return {
    getTexture(terrainId: TerrainId, q: number, r: number): Texture {
      const variants = textures[terrainId]
      if (!variants) {
        throw new Error(`No textures for terrain ${terrainId}`)
      }
      const variantIndex = Math.abs((q * 7 + r * 13) % variants.length)
      const texture = variants[variantIndex]
      if (!texture) {
        throw new Error(`No texture variant ${variantIndex} for terrain ${terrainId}`)
      }
      return texture
    },

    getWaterFrames(terrainId: 0 | 1): Texture[] {
      const frames = waterFrames.get(terrainId)
      if (!frames) {
        throw new Error(`No water frames for terrain ${terrainId}`)
      }
      return frames
    },

    destroy() {
      for (const variants of textures) {
        for (const tex of variants) tex.destroy(true)
      }
      for (const frames of waterFrames.values()) {
        for (const tex of frames) tex.destroy(true)
      }
    }
  }
}
