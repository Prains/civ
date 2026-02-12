import type { Application, Container } from 'pixi.js'
import type { HexMapData } from '~/utils/hex-map-data'

const PAN_SPEED = 500
const ZOOM_MIN = 0.15
const ZOOM_MAX = 2.0
const ZOOM_SENSITIVITY = 0.001
const EDGE_SCROLL_ZONE = 40

export interface Camera {
  x: number
  y: number
  zoom: number
}

export function useHexCamera(
  app: Application,
  worldContainer: Container,
  mapData: HexMapData
) {
  const camera = reactive<Camera>({ x: 0, y: 0, zoom: 1.0 })

  const mapPixelWidth = HEX_SIZE * 1.5 * (mapData.width - 1) + HEX_SIZE * 2
  const mapPixelHeight = HEX_SIZE * (SQRT3 / 2 * (mapData.width - 1) + SQRT3 * (mapData.height - 1)) + HEX_SIZE * 2

  // Center camera on map initially
  camera.x = mapPixelWidth / 2
  camera.y = mapPixelHeight / 2

  // --- Key tracking ---
  const keys = new Set<string>()

  function onKeyDown(e: KeyboardEvent) {
    keys.add(e.key.toLowerCase())
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase())
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // --- Drag state ---
  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let cameraDragStartX = 0
  let cameraDragStartY = 0

  const canvas = app.canvas as HTMLCanvasElement

  function onPointerDown(e: PointerEvent) {
    isDragging = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    cameraDragStartX = camera.x
    cameraDragStartY = camera.y
    canvas.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    mouseScreenX = e.clientX
    mouseScreenY = e.clientY

    if (!isDragging) return
    const dx = (e.clientX - dragStartX) / camera.zoom
    const dy = (e.clientY - dragStartY) / camera.zoom
    camera.x = cameraDragStartX - dx
    camera.y = cameraDragStartY - dy
    clampCamera()
  }

  function onPointerUp() {
    isDragging = false
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)

  // --- Zoom ---
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY
    zoomAt(e.clientX, e.clientY, zoomDelta)
  }

  function zoomAt(screenX: number, screenY: number, delta: number) {
    const oldZoom = camera.zoom
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.zoom * (1 + delta)))

    // Zoom toward cursor position
    const rect = canvas.getBoundingClientRect()
    const sx = screenX - rect.left
    const sy = screenY - rect.top

    const worldBeforeX = camera.x + (sx - app.screen.width / 2) / oldZoom
    const worldBeforeY = camera.y + (sy - app.screen.height / 2) / oldZoom
    const worldAfterX = camera.x + (sx - app.screen.width / 2) / newZoom
    const worldAfterY = camera.y + (sy - app.screen.height / 2) / newZoom

    camera.x += worldBeforeX - worldAfterX
    camera.y += worldBeforeY - worldAfterY
    camera.zoom = newZoom
    clampCamera()
  }

  canvas.addEventListener('wheel', onWheel, { passive: false })

  // --- Edge scroll tracking ---
  let mouseScreenX = 0
  let mouseScreenY = 0

  // --- Camera clamp ---
  function clampCamera() {
    const margin = 100
    camera.x = Math.max(-margin, Math.min(mapPixelWidth + margin, camera.x))
    camera.y = Math.max(-margin, Math.min(mapPixelHeight + margin, camera.y))
  }

  // --- Apply transform ---
  function applyCameraTransform() {
    worldContainer.x = app.screen.width / 2 - camera.x * camera.zoom
    worldContainer.y = app.screen.height / 2 - camera.y * camera.zoom
    worldContainer.scale.set(camera.zoom)
  }

  // --- Tick update ---
  function update(deltaTime: number) {
    // WASD movement
    const speed = (PAN_SPEED / camera.zoom) * deltaTime

    if (keys.has('w') || keys.has('ц')) camera.y -= speed
    if (keys.has('s') || keys.has('ы')) camera.y += speed
    if (keys.has('a') || keys.has('ф')) camera.x -= speed
    if (keys.has('d') || keys.has('в')) camera.x += speed

    // Edge scrolling (only if not dragging)
    if (!isDragging) {
      const rect = canvas.getBoundingClientRect()
      const localX = mouseScreenX - rect.left
      const localY = mouseScreenY - rect.top

      if (localX >= 0 && localX <= rect.width && localY >= 0 && localY <= rect.height) {
        const edgeSpeed = speed * 0.7
        if (localX < EDGE_SCROLL_ZONE) camera.x -= edgeSpeed
        if (localX > rect.width - EDGE_SCROLL_ZONE) camera.x += edgeSpeed
        if (localY < EDGE_SCROLL_ZONE) camera.y -= edgeSpeed
        if (localY > rect.height - EDGE_SCROLL_ZONE) camera.y += edgeSpeed
      }
    }

    clampCamera()
    applyCameraTransform()
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
  }

  // Apply initial transform
  applyCameraTransform()

  return { camera, update, destroy }
}
