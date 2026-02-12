import { Texture } from 'pixi.js'

export interface FeatureType {
  name: string
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => void
  width: number
  height: number
}

interface BiomeFeatureConfig {
  types: FeatureType[]
  minCount: number
  maxCount: number
}

function drawTree(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  let s = seed | 0
  const rng = () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
  ctx.fillStyle = '#5c4033'
  ctx.fillRect(w / 2 - 1.5, h * 0.55, 3, h * 0.35)
  const green = Math.floor(100 + rng() * 60)
  ctx.fillStyle = `rgb(30, ${green}, 50)`
  ctx.beginPath()
  ctx.arc(w / 2, h * 0.4, w * 0.38, 0, Math.PI * 2)
  ctx.fill()
}

function drawRock(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  let s = seed | 0
  const rng = () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
  const gray = Math.floor(100 + rng() * 80)
  ctx.fillStyle = `rgb(${gray}, ${gray + 5}, ${gray + 10})`
  ctx.beginPath()
  ctx.moveTo(w * 0.2, h * 0.8)
  ctx.lineTo(w * 0.1, h * 0.4)
  ctx.lineTo(w * 0.4, h * 0.15)
  ctx.lineTo(w * 0.7, h * 0.2)
  ctx.lineTo(w * 0.9, h * 0.5)
  ctx.lineTo(w * 0.8, h * 0.8)
  ctx.closePath()
  ctx.fill()
}

function drawPeak(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number) {
  ctx.fillStyle = '#7a8490'
  ctx.beginPath()
  ctx.moveTo(w * 0.1, h * 0.9)
  ctx.lineTo(w * 0.5, h * 0.05)
  ctx.lineTo(w * 0.9, h * 0.9)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#e8edf3'
  ctx.beginPath()
  ctx.moveTo(w * 0.3, h * 0.35)
  ctx.lineTo(w * 0.5, h * 0.05)
  ctx.lineTo(w * 0.7, h * 0.35)
  ctx.closePath()
  ctx.fill()
}

function drawCactus(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number) {
  ctx.fillStyle = '#4a8a3a'
  ctx.fillRect(w * 0.4, h * 0.2, w * 0.2, h * 0.7)
  ctx.fillRect(w * 0.15, h * 0.3, w * 0.25, h * 0.12)
  ctx.fillRect(w * 0.6, h * 0.45, w * 0.25, h * 0.12)
}

function drawPalm(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number) {
  ctx.fillStyle = '#8B6914'
  ctx.fillRect(w * 0.45, h * 0.3, 3, h * 0.6)
  ctx.fillStyle = '#2d8a3e'
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.ellipse(w * 0.47 + Math.cos(angle) * 5, h * 0.25, 7, 3, angle, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawBush(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  let s = seed | 0
  const rng = () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
  const green = Math.floor(80 + rng() * 80)
  ctx.fillStyle = `rgb(40, ${green}, 40)`
  ctx.beginPath()
  ctx.arc(w / 2, h * 0.6, w * 0.35, 0, Math.PI * 2)
  ctx.fill()
}

function drawGrassTuft(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number) {
  ctx.strokeStyle = '#6aaa44'
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const x = w * 0.2 + i * (w * 0.15)
    ctx.beginPath()
    ctx.moveTo(x, h * 0.9)
    ctx.quadraticCurveTo(x + (i % 2 ? 2 : -2), h * 0.4, x + (i % 2 ? 3 : -3), h * 0.2)
    ctx.stroke()
  }
}

function drawSnowDrift(ctx: CanvasRenderingContext2D, w: number, h: number, _seed: number) {
  ctx.fillStyle = '#d4dce8'
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.7, w * 0.4, h * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
}

const TREE: FeatureType = { name: 'tree', draw: drawTree, width: 14, height: 22 }
const ROCK: FeatureType = { name: 'rock', draw: drawRock, width: 12, height: 10 }
const PEAK: FeatureType = { name: 'peak', draw: drawPeak, width: 14, height: 18 }
const CACTUS: FeatureType = { name: 'cactus', draw: drawCactus, width: 10, height: 16 }
const PALM: FeatureType = { name: 'palm', draw: drawPalm, width: 14, height: 22 }
const BUSH: FeatureType = { name: 'bush', draw: drawBush, width: 10, height: 10 }
const GRASS_TUFT: FeatureType = { name: 'grass', draw: drawGrassTuft, width: 12, height: 12 }
const SNOW_DRIFT: FeatureType = { name: 'snowdrift', draw: drawSnowDrift, width: 14, height: 10 }

export const BIOME_FEATURE_CONFIGS: Partial<Record<number, BiomeFeatureConfig>> = {
  2: { types: [PALM, ROCK], minCount: 0, maxCount: 1 },
  3: { types: [CACTUS, ROCK], minCount: 0, maxCount: 2 },
  4: { types: [GRASS_TUFT, BUSH], minCount: 0, maxCount: 2 },
  5: { types: [BUSH, TREE, GRASS_TUFT], minCount: 1, maxCount: 2 },
  6: { types: [TREE], minCount: 2, maxCount: 4 },
  7: { types: [ROCK, BUSH], minCount: 1, maxCount: 2 },
  8: { types: [PEAK, ROCK], minCount: 1, maxCount: 3 },
  9: { types: [SNOW_DRIFT, ROCK], minCount: 0, maxCount: 2 }
}

export interface FeatureTextureSet {
  getTexture(featureType: FeatureType, variant: number): Texture
  destroy(): void
}

export function createFeatureTextures(): FeatureTextureSet {
  const cache = new Map<string, Texture[]>()

  function getOrCreate(ft: FeatureType, variant: number): Texture {
    const key = ft.name
    if (!cache.has(key)) {
      const variants: Texture[] = []
      for (let v = 0; v < 3; v++) {
        const canvas = document.createElement('canvas')
        canvas.width = ft.width * 2
        canvas.height = ft.height * 2
        const ctx = canvas.getContext('2d')!
        ctx.scale(2, 2)
        ft.draw(ctx, ft.width, ft.height, v * 31)
        variants.push(Texture.from({ resource: canvas, label: `feature-${ft.name}-v${v}` }))
      }
      cache.set(key, variants)
    }
    const variants = cache.get(key)
    if (!variants) {
      throw new Error(`Failed to get variants for ${ft.name}`)
    }
    const texture = variants[variant % variants.length]
    if (!texture) {
      throw new Error(`Failed to get texture variant for ${ft.name}`)
    }
    return texture
  }

  return {
    getTexture(featureType: FeatureType, variant: number): Texture {
      const texture = getOrCreate(featureType, variant)
      if (!texture) {
        throw new Error(`Failed to create texture for ${featureType.name}`)
      }
      return texture
    },
    destroy() {
      for (const variants of cache.values()) {
        for (const tex of variants) tex.destroy(true)
      }
      cache.clear()
    }
  }
}
