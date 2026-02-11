<script setup lang="ts">
import { Application, Graphics } from 'pixi.js'

interface Tile {
  q: number
  r: number
  type: 'grass' | 'water' | 'mountain'
}

const props = defineProps<{
  tiles: Tile[]
}>()

const canvasRef = ref<HTMLDivElement>()

const terrainColors: Record<string, number> = {
  grass: 0x4ade80,
  water: 0x60a5fa,
  mountain: 0x9ca3af
}

const HEX_SIZE = 30

function drawHex(g: Graphics, cx: number, cy: number, size: number, color: number) {
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    points.push(cx + size * Math.cos(angle))
    points.push(cy + size * Math.sin(angle))
  }
  g.poly(points, true)
  g.fill({ color })
  g.stroke({ color: 0x1e293b, width: 1.5 })
}

onMounted(async () => {
  if (!canvasRef.value) return

  const sqrt3 = Math.sqrt(3)

  let maxX = 0
  let maxY = 0
  for (const tile of props.tiles) {
    const x = HEX_SIZE * 1.5 * tile.q
    const y = HEX_SIZE * (sqrt3 / 2 * tile.q + sqrt3 * tile.r)
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  const padding = HEX_SIZE * 2
  const width = maxX + padding * 2
  const height = maxY + padding * 2

  const app = new Application()
  await app.init({
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  })

  canvasRef.value.appendChild(app.canvas)

  const g = new Graphics()

  for (const tile of props.tiles) {
    const cx = padding + HEX_SIZE * 1.5 * tile.q
    const cy = padding + HEX_SIZE * (sqrt3 / 2 * tile.q + sqrt3 * tile.r)
    drawHex(g, cx, cy, HEX_SIZE, terrainColors[tile.type] ?? 0xffffff)
  }

  app.stage.addChild(g)

  onBeforeUnmount(() => {
    app.destroy(true)
  })
})
</script>

<template>
  <div ref="canvasRef" class="flex justify-center" />
</template>
