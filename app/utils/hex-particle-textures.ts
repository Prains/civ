import { Texture } from 'pixi.js'

export interface ParticleTextures {
  dot: Texture
  flake: Texture
  spark: Texture
  destroy(): void
}

function createCircleTexture(size: number, color: string, blur: boolean, label: string): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')!

  if (blur) {
    const gradient = ctx.createRadialGradient(size, size, 0, size, size, size)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
  } else {
    ctx.fillStyle = color
  }

  ctx.beginPath()
  ctx.arc(size, size, size, 0, Math.PI * 2)
  ctx.fill()

  return Texture.from({ resource: canvas, label })
}

function createFlakeTexture(): Texture {
  const size = 6
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')!
  const cx = size
  const cy = size

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1

  // 6 arms of snowflake
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(angle) * (size - 1), cy + Math.sin(angle) * (size - 1))
    ctx.stroke()
  }

  // Center dot
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(cx, cy, 1, 0, Math.PI * 2)
  ctx.fill()

  return Texture.from({ resource: canvas, label: 'particle-flake' })
}

export function createParticleTextures(): ParticleTextures {
  const dot = createCircleTexture(3, 'white', false, 'particle-dot')
  const spark = createCircleTexture(4, 'white', true, 'particle-spark')
  const flake = createFlakeTexture()

  return {
    dot,
    flake,
    spark,
    destroy() {
      dot.destroy(true)
      spark.destroy(true)
      flake.destroy(true)
    }
  }
}
