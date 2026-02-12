<script setup lang="ts">
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { HexMapData } from '~/utils/hex-map-data'
import { createHexTextureAtlas, type HexTextureAtlas } from '~/utils/hex-texture-atlas'
import { createTilePool, type TilePool } from '~/utils/hex-tile-pool'

const props = defineProps<{
  mapData: HexMapData
}>()

const containerRef = ref<HTMLDivElement>()

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

  // --- Texture atlas and tile pool ---
  const textureAtlas: HexTextureAtlas = createHexTextureAtlas()
  const tilePool: TilePool = createTilePool(2000)

  // --- World container with layer hierarchy ---
  const worldContainer = new Container({ isRenderGroup: true })
  app.stage.addChild(worldContainer)

  // Layer 1: shadow container (placeholder for Task 4)
  const shadowContainer = new Container()
  worldContainer.addChild(shadowContainer)

  // Layer 2: tile sprites from pool
  worldContainer.addChild(tilePool.tileContainer)

  // Layer 3: feature container (placeholder for Task 5)
  const featureContainer = new Container({ sortableChildren: true })
  worldContainer.addChild(featureContainer)

  // Layer 4: water overlay container (placeholder for Task 5)
  const waterOverlayContainer = new Container()
  worldContainer.addChild(waterOverlayContainer)

  // Layer 5: LOD fallback graphics (hidden by default)
  const lodGraphics = new Graphics()
  lodGraphics.visible = false
  worldContainer.addChild(lodGraphics)

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

    const useLod = camera.zoom < 0.25

    if (useLod) {
      // LOD mode: hide sprites, show colored rectangles
      tilePool.tileContainer.visible = false
      shadowContainer.visible = false
      featureContainer.visible = false
      waterOverlayContainer.visible = false
      lodGraphics.visible = true

      lodGraphics.clear()
      const rectW = HEX_SIZE * 1.5
      const rectH = HEX_SIZE * SQRT3

      for (let r = range.rMin; r <= range.rMax; r++) {
        for (let q = range.qMin; q <= range.qMax; q++) {
          const terrain = getTerrain(props.mapData, q, r)
          const px = HEX_SIZE * 1.5 * q
          const py = HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r)
          lodGraphics.rect(px - rectW / 2, py - rectH / 2, rectW, rectH)
          lodGraphics.fill({ color: TERRAIN_COLORS[terrain] })
        }
      }
    } else {
      // Sprite mode: show tile pool, hide LOD
      tilePool.tileContainer.visible = true
      shadowContainer.visible = true
      featureContainer.visible = true
      waterOverlayContainer.visible = true
      lodGraphics.visible = false

      tilePool.update(range, props.mapData, textureAtlas, camera.zoom)
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
    tilePool.destroy()
    textureAtlas.destroy()
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
