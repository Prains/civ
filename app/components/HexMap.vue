<script setup lang="ts">
import { Application, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js'
import type { HexMapData } from '~/utils/hex-map-data'
import type { ClientPlayerState, GameSettlement } from '../../shared/game-types'
import { createHexTextureAtlas, type HexTextureAtlas } from '~/utils/hex-texture-atlas'
import { createTilePool, type TilePool } from '~/utils/hex-tile-pool'
import { createShadowPool, type ShadowPool } from '~/utils/hex-shadow'
import { createFeaturePool, type FeaturePool } from '~/utils/hex-feature-pool'
import { createAnimationManager, type AnimationManager } from '~/utils/hex-animation-manager'
import { createParticleTextures, type ParticleTextures } from '~/utils/hex-particle-textures'
import { PARTICLE_CONFIGS } from '~/utils/hex-animation-config'
import { createFogRenderer, type FogRenderer } from '~/utils/hex-fog-renderer'
import { createSettlementRenderer, type SettlementRenderer } from '~/utils/hex-settlement-renderer'

const props = defineProps<{
  mapData: HexMapData
  playerState: ClientPlayerState | null
  currentPlayerId: string
}>()

const emit = defineEmits<{
  (e: 'select-settlement', settlement: GameSettlement): void
  (e: 'deselect'): void
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

  // Layer 1: shadow pool (below tiles)
  const shadowPool: ShadowPool = createShadowPool()
  worldContainer.addChild(shadowPool.container)

  // Layer 2: tile sprites from pool
  worldContainer.addChild(tilePool.tileContainer)

  // Layer 3: feature pool (above tiles)
  const featurePool: FeaturePool = createFeaturePool()
  worldContainer.addChild(featurePool.container)

  // Layer 4: fog of war (above features)
  const fogRenderer: FogRenderer = createFogRenderer()
  worldContainer.addChild(fogRenderer.container)

  // Layer 5: settlement renderer (above fog)
  const settlementRenderer: SettlementRenderer = createSettlementRenderer()
  worldContainer.addChild(settlementRenderer.container)

  // Animation manager and particle textures
  const animationManager: AnimationManager = createAnimationManager()
  const particleTextures: ParticleTextures = createParticleTextures()

  // Layer 6: particle container (above settlements)
  const particleContainer = new Container()
  worldContainer.addChild(particleContainer)

  // Particle sprite pool
  const particleSprites: Sprite[] = []
  const PARTICLE_POOL_SIZE = 200
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const s = new Sprite({ anchor: { x: 0.5, y: 0.5 }, visible: false })
    particleContainer.addChild(s)
    particleSprites.push(s)
  }

  // Layer 7: LOD fallback graphics (hidden by default)
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

  // --- Click handling for tile selection ---
  let clickStartX = 0
  let clickStartY = 0
  const CLICK_THRESHOLD = 5 // pixels — ignore drags

  const canvas = app.canvas as HTMLCanvasElement
  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    clickStartX = e.clientX
    clickStartY = e.clientY
  })
  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const dx = e.clientX - clickStartX
    const dy = e.clientY - clickStartY
    if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return // was a drag

    // Convert screen → world → hex
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const worldX = camera.x + (sx - app.screen.width / 2) / camera.zoom
    const worldY = camera.y + (sy - app.screen.height / 2) / camera.zoom
    const hex = pixelToHex(worldX, worldY)

    const ps = props.playerState
    if (!ps) return

    // Check for settlement at this hex
    const settlement = ps.visibleSettlements.find(s => s.q === hex.q && s.r === hex.r)
    if (settlement) {
      emit('select-settlement', settlement)
      return
    }

    emit('deselect')
  })

  let lastVisibleKey = ''
  let fpsUpdateTimer = 0
  let lastPlayerStateTick = -1
  let cameraCentered = false

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
    const viewChanged = visibleKey !== lastVisibleKey
    lastVisibleKey = visibleKey

    const useLod = camera.zoom < 0.25

    if (useLod) {
      // LOD mode: hide sprites, show colored rectangles
      tilePool.tileContainer.visible = false
      shadowPool.container.visible = false
      featurePool.container.visible = false
      fogRenderer.container.visible = false
      settlementRenderer.container.visible = false
      lodGraphics.visible = true

      if (viewChanged) {
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
      }
    } else {
      // Sprite mode: show tile pool, hide LOD
      tilePool.tileContainer.visible = true
      shadowPool.container.visible = true
      lodGraphics.visible = false

      if (viewChanged) {
        tilePool.update(range, props.mapData, textureAtlas, camera.zoom)
        shadowPool.update(range, props.mapData)
      }

      // Features visible at zoom >= 0.4
      if (camera.zoom >= 0.4) {
        featurePool.container.visible = true
        if (viewChanged) {
          featurePool.update(range, props.mapData)
        }
      } else {
        featurePool.container.visible = false
      }

      // Game state layers
      fogRenderer.container.visible = true
      settlementRenderer.container.visible = true

      // Update game state renderers when view changes or new tick arrives
      const ps = props.playerState
      if (ps) {
        // Center camera on player's first settlement on first tick
        if (!cameraCentered) {
          cameraCentered = true
          const target = ps.visibleSettlements[0]
          if (target) {
            const pos = hexToPixel(target.q, target.r)
            camera.x = pos.x
            camera.y = pos.y
            // Force full redraw after camera move
            lastVisibleKey = ''
            return
          }
        }

        const tickChanged = ps.tick !== lastPlayerStateTick
        if (viewChanged || tickChanged) {
          lastPlayerStateTick = ps.tick
          fogRenderer.update(ps.fogMap, props.mapData.width, props.mapData.height, range)
          settlementRenderer.update(ps.visibleSettlements, props.currentPlayerId)
        }
      }
    }
  }

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime / 60 // normalize to seconds
    updateCamera(dt)
    redrawVisibleTiles()

    // Count visible tiles per terrain for particle spawning
    const visibleTilesPerTerrain = new Map<number, number>()
    for (const [, entry] of tilePool.getActiveTiles()) {
      const t = getTerrain(props.mapData, entry.q, entry.r)
      visibleTilesPerTerrain.set(t, (visibleTilesPerTerrain.get(t) ?? 0) + 1)
    }

    // Update animation system
    animationManager.update({
      deltaMs: ticker.deltaMS,
      zoom: camera.zoom,
      activeTiles: tilePool.getActiveTiles(),
      activeWaterTiles: tilePool.getActiveWaterTiles(),
      activeFeatures: featurePool.getActiveFeatures(),
      getTerrainId: (q: number, r: number) => getTerrain(props.mapData, q, r),
      waterFrames: (terrainId: number) => textureAtlas.getWaterFrames(terrainId as 0 | 1),
      visibleTilesPerTerrain
    })

    // Sync particle sprites with particle system data
    const particles = animationManager.particles.getParticles()
    const halfW = app.screen.width / camera.zoom / 2
    const halfH = app.screen.height / camera.zoom / 2
    const texMap = {
      dot: particleTextures.dot,
      flake: particleTextures.flake,
      spark: particleTextures.spark
    } as const

    for (let i = 0; i < particleSprites.length; i++) {
      const sprite = particleSprites[i]!
      if (i < particles.length) {
        const p = particles[i]!
        sprite.visible = true
        // Use particle index as deterministic seed for initial position within viewport;
        // p.x/p.y are cumulative drift from that position
        sprite.x = camera.x + p.x - halfW + (halfW * 2) * ((i * 7919 % 1000) / 1000)
        sprite.y = camera.y + p.y - halfH + (halfH * 2) * ((i * 73856 % 1000) / 1000)
        sprite.alpha = p.alpha
        sprite.scale.set(p.scale)
        const config = PARTICLE_CONFIGS[p.terrainId]
        if (config) {
          sprite.tint = config.tint
          sprite.texture = texMap[config.texture]
        }
      } else {
        sprite.visible = false
      }
    }

    // Update FPS every 0.5s
    fpsUpdateTimer += dt
    if (fpsUpdateTimer >= 0.5) {
      fpsUpdateTimer = 0
      fpsText.text = `FPS: ${Math.round(app.ticker.FPS)}`
    }
  })

  cleanup = () => {
    destroyCamera()
    animationManager.particles.clear()
    particleTextures.destroy()
    fogRenderer.destroy()
    settlementRenderer.destroy()
    featurePool.destroy()
    shadowPool.destroy()
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
