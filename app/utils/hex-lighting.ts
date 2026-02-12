import type { HexMapData } from './hex-map-data'
import { getElevation, getElevationSafe } from './hex-map-data'

const ELEVATION_SCALE = 8
const LAND_THRESHOLD = 97  // ~0.38 * 255

// Light direction: from upper-left (NW)
const LIGHT_NEIGHBORS: [number, number][] = [[-1, -1], [0, -1], [-1, 0]]

export function elevationYOffset(elevation: number): number {
  if (elevation < LAND_THRESHOLD) return 0
  return -((elevation - LAND_THRESHOLD) / (255 - LAND_THRESHOLD)) * ELEVATION_SCALE
}

export function calculateLightTint(map: HexMapData, q: number, r: number): number {
  const elev = getElevation(map, q, r)
  if (elev < LAND_THRESHOLD) return 0xffffff  // No shading for water

  // Average elevation difference toward light
  let lightDiff = 0
  let count = 0
  for (const [dq, dr] of LIGHT_NEIGHBORS) {
    const nElev = getElevationSafe(map, q + dq, r + dr)
    lightDiff += (elev - nElev) / 255
    count++
  }
  lightDiff /= count

  // Brightness: positive diff = faces light = brighter
  const brightness = Math.max(0.75, Math.min(1.2, 1.0 + lightDiff * 0.6))
  const channel = Math.min(255, Math.round(255 * brightness))
  return (channel << 16) | (channel << 8) | channel
}

export function shouldCastShadow(terrainId: number): boolean {
  return terrainId >= 7  // hills, mountain, snow
}
