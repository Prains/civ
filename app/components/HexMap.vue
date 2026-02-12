<script setup lang="ts">
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { HexMapData } from '~/utils/hex-map-data'

const props = defineProps<{
  mapData: HexMapData
}>()

const containerRef = ref<HTMLDivElement>()

// Pre-computed hex vertices for a flat-top hexagon
const HEX_VERTICES: number[] = []
for (let i = 0; i < 6; i++) {
  const angle = (Math.PI / 180) * (60 * i)
  HEX_VERTICES.push(Math.cos(angle), Math.sin(angle))
}

// Store cleanup function for onBeforeUnmount (must register before await)
let cleanup: (() => void) | null = null

onBeforeUnmount(() => {
  cleanup?.()
})

onMounted(async () => {
  if (!containerRef.value) return

  const app = new Application()
  await app.init({
    resizeTo: containerRef.value,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  })

  containerRef.value.appendChild(app.canvas)

  const worldContainer = new Container({ isRenderGroup: true })
  app.stage.addChild(worldContainer)

  const tileGraphics = new Graphics()
  worldContainer.addChild(tileGraphics)

  // FPS counter (fixed on screen)
  const fpsText = new Text({
    text: 'FPS: 0',
    style: new TextStyle({
      fontSize: 14,
      fill: 0xffffff,
      fontFamily: 'monospace',
      stroke: { color: 0x000000, width: 3 }
    })
  })
  fpsText.position.set(8, 8)
  app.stage.addChild(fpsText)

  const { camera, update: updateCamera, destroy: destroyCamera } = useHexCamera(
    app,
    worldContainer,
    props.mapData
  )

  let lastVisibleKey = ''
  let fpsUpdateTimer = 0

  function redrawVisibleTiles() {
    const range = getVisibleRange(
      camera.x,
      camera.y,
      app.screen.width,
      app.screen.height,
      camera.zoom,
      props.mapData.width,
      props.mapData.height
    )

    const visibleKey = `${range.qMin},${range.qMax},${range.rMin},${range.rMax},${camera.zoom.toFixed(3)}`
    if (visibleKey === lastVisibleKey) return
    lastVisibleKey = visibleKey

    tileGraphics.clear()

    const useRect = camera.zoom < 0.25
    const useStroke = camera.zoom >= 0.5

    if (useRect) {
      // LOD: rectangles for very zoomed out view
      const rectW = HEX_SIZE * 1.5
      const rectH = HEX_SIZE * SQRT3

      for (let r = range.rMin; r <= range.rMax; r++) {
        for (let q = range.qMin; q <= range.qMax; q++) {
          const terrain = getTerrain(props.mapData, q, r)
          const px = HEX_SIZE * 1.5 * q
          const py = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r)
          tileGraphics.rect(px - rectW / 2, py - rectH / 2, rectW, rectH)
          tileGraphics.fill({ color: TERRAIN_COLORS[terrain] })
        }
      }
    } else {
      // Hex polygons
      for (let r = range.rMin; r <= range.rMax; r++) {
        for (let q = range.qMin; q <= range.qMax; q++) {
          const terrain = getTerrain(props.mapData, q, r)
          const cx = HEX_SIZE * 1.5 * q
          const cy = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r)

          const points: number[] = []
          for (let i = 0; i < 12; i += 2) {
            points.push(cx + HEX_SIZE * HEX_VERTICES[i]!, cy + HEX_SIZE * HEX_VERTICES[i + 1]!)
          }

          tileGraphics.poly(points, true)
          tileGraphics.fill({ color: TERRAIN_COLORS[terrain] })

          if (useStroke) {
            tileGraphics.stroke({ color: 0x1e293b, width: 1.5 })
          }
        }
      }
    }
  }

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime / 60 // normalize to seconds
    updateCamera(dt)
    redrawVisibleTiles()

    // Update FPS every 0.5s
    fpsUpdateTimer += dt
    if (fpsUpdateTimer >= 0.5) {
      fpsUpdateTimer = 0
      fpsText.text = `FPS: ${Math.round(app.ticker.FPS)}`
    }
  })

  cleanup = () => {
    destroyCamera()
    app.destroy({ removeView: true })
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-full"
  />
</template>
