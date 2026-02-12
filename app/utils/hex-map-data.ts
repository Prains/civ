export type TerrainId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const HEX_SIZE = 30
export const SQRT3 = Math.sqrt(3)

export const TERRAIN_COLORS: readonly number[] = [
  0x1e3a5f, // deep_water
  0x60a5fa, // shallow_water
  0xf5d08a, // beach
  0xe8c86a, // desert
  0xa8d86a, // plains
  0x4ade80, // grassland
  0x2d8a4e, // forest
  0xb8956a, // hills
  0x9ca3af, // mountain
  0xe8edf3 // snow
]

export interface HexMapData {
  width: number
  height: number
  terrain: Uint8Array
  elevation: Uint8Array
}

export function buildMapData(
  terrainArray: number[],
  elevationArray: number[],
  width: number,
  height: number
): HexMapData {
  return {
    width,
    height,
    terrain: new Uint8Array(terrainArray),
    elevation: new Uint8Array(elevationArray)
  }
}

export function getTerrain(map: HexMapData, q: number, r: number): TerrainId {
  return map.terrain[r * map.width + q] as TerrainId
}

export function getElevation(map: HexMapData, q: number, r: number): number {
  return map.elevation[r * map.width + q]!
}

export function getElevationSafe(map: HexMapData, q: number, r: number): number {
  if (q < 0 || q >= map.width || r < 0 || r >= map.height) return 0
  return map.elevation[r * map.width + q]!
}

export function hexToPixel(q: number, r: number): { x: number, y: number } {
  return {
    x: HEX_SIZE * 1.5 * q,
    y: HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r)
  }
}

// Flat-top hex neighbors (offset coordinates for flat-top hex grid)
export function getHexNeighbors(q: number, r: number): Array<[number, number]> {
  return [
    [q + 1, r], [q - 1, r],
    [q, r + 1], [q, r - 1],
    [q + 1, r - 1], [q - 1, r + 1]
  ]
}

export function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
}

export interface VisibleRange {
  qMin: number
  qMax: number
  rMin: number
  rMax: number
}

export function getVisibleRange(
  cameraX: number,
  cameraY: number,
  screenWidth: number,
  screenHeight: number,
  zoom: number,
  mapWidth: number,
  mapHeight: number
): VisibleRange {
  const halfW = (screenWidth / zoom) / 2
  const halfH = (screenHeight / zoom) / 2

  const worldLeft = cameraX - halfW
  const worldRight = cameraX + halfW
  const worldTop = cameraY - halfH
  const worldBottom = cameraY + halfH

  const qMin = Math.max(0, Math.floor(worldLeft / (HEX_SIZE * 1.5)) - 1)
  const qMax = Math.min(mapWidth - 1, Math.ceil(worldRight / (HEX_SIZE * 1.5)) + 1)
  // y = HEX_SIZE * (SQRT3/2 * q + SQRT3 * r)  →  r = (y/HEX_SIZE - SQRT3/2 * q) / SQRT3
  // For rMin use qMax (larger q → smaller r for same y)
  // For rMax use qMin (smaller q → larger r for same y)
  const rMin = Math.max(0, Math.floor((worldTop / HEX_SIZE - SQRT3 / 2 * qMax) / SQRT3) - 1)
  const rMax = Math.min(mapHeight - 1, Math.ceil((worldBottom / HEX_SIZE - SQRT3 / 2 * qMin) / SQRT3) + 1)

  return { qMin, qMax, rMin, rMax }
}
