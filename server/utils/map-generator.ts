import { createNoise2D } from 'simplex-noise'

export type MapType = 'continents' | 'pangaea' | 'archipelago'

export interface GeneratedMap {
  width: number
  height: number
  terrain: number[]
  elevation: number[]
}

// Terrain IDs (must match client-side hex-map-data.ts)
const DEEP_WATER = 0
const SHALLOW_WATER = 1
const BEACH = 2
const DESERT = 3
const PLAINS = 4
const GRASSLAND = 5
const FOREST = 6
const HILLS = 7
const MOUNTAIN = 8
const SNOW = 9

function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
}

function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  frequency: number,
  persistence: number
): number {
  let value = 0
  let amplitude = 1
  let totalAmplitude = 0
  let freq = frequency

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * freq, y * freq)
    totalAmplitude += amplitude
    amplitude *= persistence
    freq *= 2
  }

  // Normalize from [-1, 1] to [0, 1]
  return (value / totalAmplitude + 1) / 2
}

function distanceToCenter(q: number, r: number, width: number, height: number): number {
  const nx = q / (width - 1) * 2 - 1
  const ny = r / (height - 1) * 2 - 1
  return Math.sqrt(nx * nx + ny * ny) / Math.SQRT2 // 0..1
}

function determineBiome(elevation: number, moisture: number): number {
  if (elevation >= 0.88) return SNOW
  if (elevation >= 0.80) return MOUNTAIN
  if (elevation >= 0.68) {
    return moisture < 0.50 ? HILLS : FOREST
  }
  if (elevation >= 0.42) {
    if (moisture < 0.25) return DESERT
    if (moisture < 0.50) return PLAINS
    if (moisture < 0.70) return GRASSLAND
    return FOREST
  }
  if (elevation >= 0.38) return BEACH
  if (elevation >= 0.30) return SHALLOW_WATER
  return DEEP_WATER
}

export function generateMap(
  width: number,
  height: number,
  mapType: MapType = 'continents',
  seed?: number
): GeneratedMap {
  const actualSeed = seed ?? (Date.now() ^ (Math.random() * 0x7fffffff))
  const rng = seededRandom(actualSeed)

  const elevNoise = createNoise2D(rng)
  const moistNoise = createNoise2D(rng)

  const terrain = new Array<number>(width * height)
  const elevation = new Array<number>(width * height)

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      let elev = fbm(elevNoise, q, r, 4, 0.005, 0.5)
      const moisture = fbm(moistNoise, q, r, 3, 0.008, 0.5)

      const dist = distanceToCenter(q, r, width, height)

      if (mapType === 'continents') {
        elev -= dist * 0.3
      } else if (mapType === 'pangaea') {
        elev -= dist * 0.5
      } else if (mapType === 'archipelago') {
        elev *= 0.7
      }

      // Clamp to [0, 1]
      elev = Math.max(0, Math.min(1, elev))

      terrain[r * width + q] = determineBiome(elev, moisture)
      elevation[r * width + q] = Math.round(elev * 255)
    }
  }

  return { width, height, terrain, elevation }
}
