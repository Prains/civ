import { PARTICLE_CONFIGS, type ParticleConfig } from './hex-animation-config'

const MAX_PARTICLES = 200

interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  alphaStart: number
  alphaEnd: number
  scale: number
  scaleStart: number
  scaleEnd: number
  elapsed: number
  lifetime: number
  terrainId: number
}

interface ParticleUpdateParams {
  deltaMs: number
  zoom: number
  visibleTilesPerTerrain: Map<number, number>
}

export interface ParticleSystem {
  update(params: ParticleUpdateParams): void
  activeCount(): number
  getParticles(): ReadonlyArray<Readonly<Particle>>
  clear(): void
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function createParticleSystem(): ParticleSystem {
  const particles: Particle[] = []
  const pool: Particle[] = []

  // Pre-allocate pool
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      alpha: 0, alphaStart: 0, alphaEnd: 0,
      scale: 1, scaleStart: 1, scaleEnd: 1,
      elapsed: 0, lifetime: 0, terrainId: 0
    })
  }

  const spawnAccumulators = new Map<number, number>()

  function acquireParticle(): Particle | null {
    if (particles.length >= MAX_PARTICLES) return null
    const p = pool.pop()
    if (!p) return null
    p.active = true
    particles.push(p)
    return p
  }

  function releaseParticle(index: number): void {
    const p = particles[index]
    p.active = false
    pool.push(p)
    particles[index] = particles[particles.length - 1]
    particles.pop()
  }

  function spawnOne(config: ParticleConfig, terrainId: number): void {
    const p = acquireParticle()
    if (!p) return

    const dir = randomRange(config.direction[0], config.direction[1])
    const speed = randomRange(config.speed[0], config.speed[1])

    p.x = 0
    p.y = 0
    p.vx = Math.cos(dir) * speed
    p.vy = Math.sin(dir) * speed
    p.alphaStart = config.alpha[0]
    p.alphaEnd = config.alpha[1]
    p.alpha = config.alpha[0]
    p.scaleStart = config.scale[0]
    p.scaleEnd = config.scale[1]
    p.scale = config.scale[0]
    p.elapsed = 0
    p.lifetime = randomRange(config.lifetime[0], config.lifetime[1])
    p.terrainId = terrainId
  }

  function update(params: ParticleUpdateParams): void {
    const { deltaMs, zoom, visibleTilesPerTerrain } = params
    const dtSec = deltaMs / 1000

    // Update existing particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.elapsed += deltaMs
      if (p.elapsed >= p.lifetime) {
        releaseParticle(i)
        continue
      }

      const progress = p.elapsed / p.lifetime
      p.x += p.vx * dtSec
      p.y += p.vy * dtSec
      p.alpha = lerp(p.alphaStart, p.alphaEnd, progress)
      p.scale = lerp(p.scaleStart, p.scaleEnd, progress)
    }

    // Spawn new particles
    for (const [terrainIdStr, config] of Object.entries(PARTICLE_CONFIGS)) {
      const tid = Number(terrainIdStr)
      if (!config || zoom < config.minZoom) continue

      const tileCount = visibleTilesPerTerrain.get(tid) ?? 0
      if (tileCount === 0) continue

      let rateMultiplier = 1
      if (zoom < 0.6) rateMultiplier = 0.5

      const acc = (spawnAccumulators.get(tid) ?? 0) + config.spawnRate * tileCount * rateMultiplier * dtSec
      const toSpawn = Math.floor(acc)
      spawnAccumulators.set(tid, acc - toSpawn)

      for (let i = 0; i < toSpawn; i++) {
        spawnOne(config, tid)
      }
    }
  }

  function activeCount(): number {
    return particles.length
  }

  function getParticles(): ReadonlyArray<Readonly<Particle>> {
    return particles
  }

  function clear(): void {
    while (particles.length > 0) {
      releaseParticle(particles.length - 1)
    }
    spawnAccumulators.clear()
  }

  return { update, activeCount, getParticles, clear }
}
