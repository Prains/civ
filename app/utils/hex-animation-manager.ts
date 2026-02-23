import { createTweenEngine, type TweenEngine } from './hex-tween-engine'
import { createAmbientSystem, type AmbientSystem } from './hex-ambient-system'
import { createParticleSystem, type ParticleSystem } from './hex-particle-system'
import { createTransitionSystem, type TransitionSystem } from './hex-transition-system'

interface AnimationUpdateParams {
  deltaMs: number
  zoom: number
  activeTiles: Map<string, { sprite: { scale: { x: number, y: number }, skew: { x: number, y: number }, alpha: number, rotation: number }, q: number, r: number }>
  activeWaterTiles: Map<string, { sprite: { texture: unknown }, q: number, r: number }>
  activeFeatures: Map<string, Array<{ rotation: number, skew: { x: number, y: number }, scale: { x: number, y: number }, alpha: number }>>
  getTerrainId: (q: number, r: number) => number
  waterFrames: ((terrainId: number) => unknown[]) | null
  visibleTilesPerTerrain: Map<number, number>
}

export interface AnimationManager {
  readonly tween: TweenEngine
  readonly ambient: AmbientSystem
  readonly particles: ParticleSystem
  readonly transitions: TransitionSystem
  update(params: AnimationUpdateParams): void
  totalTime(): number
}

export function createAnimationManager(): AnimationManager {
  const tween = createTweenEngine()
  const ambient = createAmbientSystem()
  const particles = createParticleSystem()
  const transitions = createTransitionSystem(tween)

  let _totalTime = 0

  function update(params: AnimationUpdateParams): void {
    const { deltaMs, zoom } = params
    _totalTime += deltaMs

    // Tween update also drives transition system animations (via decorator hook)
    tween.update(deltaMs)

    // Ambient animations (water frame cycling, tile/feature oscillations)
    ambient.update({
      deltaMs,
      totalTime: _totalTime,
      zoom,
      activeTiles: params.activeTiles,
      activeWaterTiles: params.activeWaterTiles,
      activeFeatures: params.activeFeatures,
      getTerrainId: params.getTerrainId,
      waterFrames: params.waterFrames
    })

    // Particle spawning and physics
    particles.update({
      deltaMs,
      zoom,
      visibleTilesPerTerrain: params.visibleTilesPerTerrain
    })
  }

  return {
    tween,
    ambient,
    particles,
    transitions,
    update,
    totalTime: () => _totalTime
  }
}
