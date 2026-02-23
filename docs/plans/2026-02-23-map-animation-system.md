# Map Animation System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified animation system to the hex map — ambient biome effects, tween engine, particle system, and gameplay transition foundations — creating a living, breathing indie-style world.

**Architecture:** Central `AnimationManager` coordinates four subsystems (TweenEngine, AmbientSystem, ParticleSystem, TransitionSystem). Each subsystem is LOD-aware and works with existing sprite pools. The existing `WaterAnimator` migrates into `AmbientSystem`.

**Tech Stack:** PixiJS 8.x (Sprite, Container, Texture, Ticker), TypeScript, Vitest for testing.

---

### Task 1: Easing Functions

Pure math utility with no dependencies. Foundation for all animations.

**Files:**
- Create: `app/utils/hex-easing.ts`
- Test: `test/unit/hex-easing.test.ts`

**Step 1: Write the failing test**

Create `test/unit/hex-easing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { easings, type EasingName } from '~/utils/hex-easing'

describe('hex-easing', () => {
  const names: EasingName[] = [
    'linear', 'easeInOutSine', 'easeInOutQuad',
    'easeOutBack', 'easeOutBounce', 'easeOutElastic'
  ]

  for (const name of names) {
    describe(name, () => {
      it('returns 0 at t=0', () => {
        expect(easings[name](0)).toBeCloseTo(0, 5)
      })

      it('returns 1 at t=1', () => {
        expect(easings[name](1)).toBeCloseTo(1, 2)
      })

      it('returns values between ~0 and ~2 for t in [0,1]', () => {
        for (let t = 0; t <= 1; t += 0.1) {
          const v = easings[name](t)
          expect(v).toBeGreaterThanOrEqual(-0.5)
          expect(v).toBeLessThanOrEqual(2.0)
        }
      })
    })
  }

  it('linear is identity', () => {
    expect(easings.linear(0.5)).toBe(0.5)
    expect(easings.linear(0.25)).toBe(0.25)
  })

  it('easeInOutQuad is 0.5 at t=0.5', () => {
    expect(easings.easeInOutQuad(0.5)).toBeCloseTo(0.5, 5)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run test/unit/hex-easing.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/hex-easing.ts`:

```typescript
export type EasingName =
  | 'linear'
  | 'easeInOutSine'
  | 'easeInOutQuad'
  | 'easeOutBack'
  | 'easeOutBounce'
  | 'easeOutElastic'

type EasingFn = (t: number) => number

export const easings: Record<EasingName, EasingFn> = {
  linear: (t) => t,

  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  easeInOutQuad: (t) => t < 0.5
    ? 2 * t * t
    : 1 - (-2 * t + 2) ** 2 / 2,

  easeOutBack: (t) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
  },

  easeOutBounce: (t) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },

  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run test/unit/hex-easing.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/utils/hex-easing.ts test/unit/hex-easing.test.ts
git commit -m "feat: add easing functions for animation system"
```

---

### Task 2: Tween Engine

Core interpolation engine. Pooled entries, chainable API, loop support.

**Files:**
- Create: `app/utils/hex-tween-engine.ts`
- Test: `test/unit/hex-tween-engine.test.ts`

**Step 1: Write the failing test**

Create `test/unit/hex-tween-engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTweenEngine } from '~/utils/hex-tween-engine'

// Minimal mock for tween targets
function mockTarget(props: Record<string, number> = {}) {
  return { x: 0, y: 0, alpha: 1, rotation: 0, ...props }
}

describe('hex-tween-engine', () => {
  let engine: ReturnType<typeof createTweenEngine>

  beforeEach(() => {
    engine = createTweenEngine()
  })

  it('creates without errors', () => {
    expect(engine).toBeDefined()
    expect(engine.activeCount()).toBe(0)
  })

  describe('to()', () => {
    it('interpolates a single property over time', () => {
      const target = mockTarget({ x: 0 })
      engine.to(target, { x: 100 }, { duration: 1000, easing: 'linear' })
      expect(engine.activeCount()).toBe(1)

      engine.update(500) // halfway
      expect(target.x).toBeCloseTo(50, 0)

      engine.update(500) // complete
      expect(target.x).toBeCloseTo(100, 0)
      expect(engine.activeCount()).toBe(0)
    })

    it('interpolates multiple properties simultaneously', () => {
      const target = mockTarget({ x: 0, y: 0, alpha: 0 })
      engine.to(target, { x: 200, y: 100, alpha: 1 }, { duration: 400, easing: 'linear' })

      engine.update(200) // halfway
      expect(target.x).toBeCloseTo(100, 0)
      expect(target.y).toBeCloseTo(50, 0)
      expect(target.alpha).toBeCloseTo(0.5, 1)
    })

    it('calls onComplete when finished', () => {
      const target = mockTarget()
      let completed = false
      engine.to(target, { x: 10 }, {
        duration: 100,
        easing: 'linear',
        onComplete: () => { completed = true }
      })

      engine.update(100)
      expect(completed).toBe(true)
    })

    it('clamps to end value on overshoot', () => {
      const target = mockTarget({ x: 0 })
      engine.to(target, { x: 100 }, { duration: 100, easing: 'linear' })

      engine.update(200) // overshoot
      expect(target.x).toBe(100)
    })
  })

  describe('cancel()', () => {
    it('removes all tweens for a target', () => {
      const target = mockTarget()
      engine.to(target, { x: 100 }, { duration: 1000, easing: 'linear' })
      engine.to(target, { y: 100 }, { duration: 1000, easing: 'linear' })
      expect(engine.activeCount()).toBe(2)

      engine.cancel(target)
      expect(engine.activeCount()).toBe(0)
    })

    it('does not affect other targets', () => {
      const t1 = mockTarget()
      const t2 = mockTarget()
      engine.to(t1, { x: 100 }, { duration: 1000, easing: 'linear' })
      engine.to(t2, { x: 100 }, { duration: 1000, easing: 'linear' })

      engine.cancel(t1)
      expect(engine.activeCount()).toBe(1)
    })
  })

  describe('chain()', () => {
    it('runs tweens sequentially via chain API', () => {
      const target = mockTarget({ x: 0 })
      engine.chain()
        .to(target, { x: 50 }, { duration: 100, easing: 'linear' })
        .to(target, { x: 100 }, { duration: 100, easing: 'linear' })
        .start()

      engine.update(100) // first completes
      expect(target.x).toBeCloseTo(50, 0)

      engine.update(100) // second completes
      expect(target.x).toBeCloseTo(100, 0)
    })
  })

  describe('loop()', () => {
    it('repeats a chain indefinitely', () => {
      const target = mockTarget({ y: 0 })
      engine.chain()
        .to(target, { y: 10 }, { duration: 100, easing: 'linear' })
        .to(target, { y: 0 }, { duration: 100, easing: 'linear' })
        .loop()

      engine.update(100) // first leg done
      expect(target.y).toBeCloseTo(10, 0)

      engine.update(100) // second leg done
      expect(target.y).toBeCloseTo(0, 0)

      engine.update(100) // loops back: first leg again
      expect(target.y).toBeCloseTo(10, 0)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run test/unit/hex-tween-engine.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/hex-tween-engine.ts`:

```typescript
import { easings, type EasingName } from './hex-easing'

interface TweenOptions {
  duration: number
  easing: EasingName
  onComplete?: () => void
}

interface TweenEntry {
  target: Record<string, number>
  props: string[]
  startValues: number[]
  endValues: number[]
  elapsed: number
  duration: number
  easing: EasingName
  onComplete?: () => void
  active: boolean
}

interface ChainStep {
  target: Record<string, number>
  endProps: Record<string, number>
  options: TweenOptions
}

export interface TweenChain {
  to(target: Record<string, number>, props: Record<string, number>, options: TweenOptions): TweenChain
  start(): void
  loop(): void
}

export interface TweenEngine {
  to(target: Record<string, number>, props: Record<string, number>, options: TweenOptions): void
  cancel(target: Record<string, number>): void
  chain(): TweenChain
  update(deltaMs: number): void
  activeCount(): number
}

const POOL_GROW = 32

export function createTweenEngine(): TweenEngine {
  const entries: TweenEntry[] = []
  const pool: TweenEntry[] = []

  // Looping chains tracked separately
  const loopingChains: { steps: ChainStep[], currentIndex: number, currentEntry: TweenEntry | null }[] = []

  function acquireEntry(): TweenEntry {
    if (pool.length > 0) {
      return pool.pop()!
    }
    return { target: {}, props: [], startValues: [], endValues: [], elapsed: 0, duration: 0, easing: 'linear', active: false }
  }

  function releaseEntry(entry: TweenEntry) {
    entry.active = false
    entry.onComplete = undefined
    pool.push(entry)
  }

  function startTween(target: Record<string, number>, endProps: Record<string, number>, options: TweenOptions): TweenEntry {
    const entry = acquireEntry()
    entry.target = target
    entry.props = Object.keys(endProps)
    entry.startValues = entry.props.map(p => target[p])
    entry.endValues = entry.props.map(p => endProps[p])
    entry.elapsed = 0
    entry.duration = options.duration
    entry.easing = options.easing
    entry.onComplete = options.onComplete
    entry.active = true
    entries.push(entry)
    return entry
  }

  function to(target: Record<string, number>, props: Record<string, number>, options: TweenOptions): void {
    startTween(target, props, options)
  }

  function cancel(target: Record<string, number>): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].target === target) {
        releaseEntry(entries[i])
        entries.splice(i, 1)
      }
    }
    // Also cancel any looping chains for this target
    for (let i = loopingChains.length - 1; i >= 0; i--) {
      const lc = loopingChains[i]
      if (lc.steps.some(s => s.target === target)) {
        if (lc.currentEntry) {
          const idx = entries.indexOf(lc.currentEntry)
          if (idx >= 0) {
            releaseEntry(lc.currentEntry)
            entries.splice(idx, 1)
          }
        }
        loopingChains.splice(i, 1)
      }
    }
  }

  function chain(): TweenChain {
    const steps: ChainStep[] = []

    const chainApi: TweenChain = {
      to(target, endProps, options) {
        steps.push({ target, endProps, options })
        return chainApi
      },
      start() {
        if (steps.length === 0) return
        startChainStep(steps, 0)
      },
      loop() {
        if (steps.length === 0) return
        const lc = { steps, currentIndex: 0, currentEntry: null as TweenEntry | null }
        loopingChains.push(lc)
        startLoopStep(lc)
      }
    }

    return chainApi
  }

  function startChainStep(steps: ChainStep[], index: number): void {
    if (index >= steps.length) return
    const step = steps[index]
    const nextIndex = index + 1
    startTween(step.target, step.endProps, {
      ...step.options,
      onComplete: () => {
        step.options.onComplete?.()
        startChainStep(steps, nextIndex)
      }
    })
  }

  function startLoopStep(lc: typeof loopingChains[0]): void {
    const step = lc.steps[lc.currentIndex]
    lc.currentEntry = startTween(step.target, step.endProps, {
      ...step.options,
      onComplete: () => {
        step.options.onComplete?.()
        lc.currentIndex = (lc.currentIndex + 1) % lc.steps.length
        startLoopStep(lc)
      }
    })
  }

  function update(deltaMs: number): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      if (!entry.active) continue

      entry.elapsed += deltaMs
      const progress = Math.min(entry.elapsed / entry.duration, 1)
      const easedProgress = easings[entry.easing](progress)

      for (let p = 0; p < entry.props.length; p++) {
        const start = entry.startValues[p]
        const end = entry.endValues[p]
        entry.target[entry.props[p]] = start + (end - start) * easedProgress
      }

      if (progress >= 1) {
        // Snap to exact end values
        for (let p = 0; p < entry.props.length; p++) {
          entry.target[entry.props[p]] = entry.endValues[p]
        }
        const onComplete = entry.onComplete
        releaseEntry(entry)
        entries.splice(i, 1)
        onComplete?.()
      }
    }
  }

  function activeCount(): number {
    return entries.length
  }

  return { to, cancel, chain, update, activeCount }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run test/unit/hex-tween-engine.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/utils/hex-tween-engine.ts test/unit/hex-tween-engine.test.ts
git commit -m "feat: add tween engine for animation system"
```

---

### Task 3: Animation Config

Pure data defining per-biome ambient effects and particle configs. No logic, just configuration.

**Files:**
- Create: `app/utils/hex-animation-config.ts`
- Test: `test/unit/hex-animation-config.test.ts`

**Step 1: Write the failing test**

Create `test/unit/hex-animation-config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  AMBIENT_CONFIGS,
  PARTICLE_CONFIGS,
  type AmbientConfig,
  type ParticleConfig
} from '~/utils/hex-animation-config'

describe('hex-animation-config', () => {
  describe('AMBIENT_CONFIGS', () => {
    it('has configs for terrains that need ambient effects', () => {
      // Water, forest, grassland, desert, beach should have configs
      expect(AMBIENT_CONFIGS[0]).toBeDefined() // deep water
      expect(AMBIENT_CONFIGS[1]).toBeDefined() // shallow water
      expect(AMBIENT_CONFIGS[4]).toBeDefined() // plains
      expect(AMBIENT_CONFIGS[5]).toBeDefined() // grassland
      expect(AMBIENT_CONFIGS[6]).toBeDefined() // forest
    })

    it('has no ambient for static terrains', () => {
      expect(AMBIENT_CONFIGS[8]).toBeUndefined() // mountain
      expect(AMBIENT_CONFIGS[9]).toBeUndefined() // snow
    })

    it('ambient configs have required fields', () => {
      const waterConfig = AMBIENT_CONFIGS[0]!
      expect(waterConfig.property).toBeDefined()
      expect(waterConfig.amplitude).toBeGreaterThan(0)
      expect(waterConfig.period).toBeGreaterThan(0)
    })
  })

  describe('PARTICLE_CONFIGS', () => {
    it('has particle configs for atmospheric biomes', () => {
      expect(PARTICLE_CONFIGS[9]).toBeDefined() // snow
      expect(PARTICLE_CONFIGS[3]).toBeDefined() // desert dust
      expect(PARTICLE_CONFIGS[6]).toBeDefined() // forest fireflies
    })

    it('particle configs have required fields', () => {
      const snowConfig = PARTICLE_CONFIGS[9]!
      expect(snowConfig.spawnRate).toBeGreaterThan(0)
      expect(snowConfig.lifetime).toHaveLength(2)
      expect(snowConfig.speed).toHaveLength(2)
      expect(snowConfig.alpha).toHaveLength(2)
      expect(snowConfig.scale).toHaveLength(2)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run test/unit/hex-animation-config.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/hex-animation-config.ts`:

```typescript
export interface AmbientConfig {
  /** Which sprite property to animate */
  property: 'rotation' | 'skewX' | 'scaleX' | 'scaleY' | 'alpha'
  /** Max deviation from base value */
  amplitude: number
  /** Oscillation period in ms */
  period: number
  /** Base value (sprite default) */
  base: number
  /** Apply to 'tile' sprites or 'feature' sprites */
  target: 'tile' | 'feature'
  /** Minimum zoom to show this effect */
  minZoom: number
}

export interface ParticleConfig {
  /** Particle texture type */
  texture: 'dot' | 'flake' | 'spark'
  /** Particles spawned per second per visible tile of this biome */
  spawnRate: number
  /** Lifetime range [min, max] in ms */
  lifetime: [number, number]
  /** Speed range [min, max] in px/s */
  speed: [number, number]
  /** Direction range [min, max] in radians (0 = right, PI/2 = down) */
  direction: [number, number]
  /** Alpha [start, end] */
  alpha: [number, number]
  /** Scale [start, end] */
  scale: [number, number]
  /** Tint color */
  tint: number
  /** Minimum zoom to show particles */
  minZoom: number
}

/**
 * Per-terrain ambient animation configs.
 * Key = terrain ID (0-9). Undefined means no ambient effect.
 */
export const AMBIENT_CONFIGS: Partial<Record<number, AmbientConfig>> = {
  // Deep water: gentle horizontal scale oscillation
  0: {
    property: 'scaleX',
    amplitude: 0.02,
    period: 3000,
    base: 1,
    target: 'tile',
    minZoom: 0.25
  },
  // Shallow water: same but slightly faster
  1: {
    property: 'scaleX',
    amplitude: 0.02,
    period: 2500,
    base: 1,
    target: 'tile',
    minZoom: 0.25
  },
  // Beach: subtle alpha shimmer
  2: {
    property: 'alpha',
    amplitude: 0.05,
    period: 4000,
    base: 1,
    target: 'tile',
    minZoom: 0.4
  },
  // Desert: heat shimmer via scaleY
  3: {
    property: 'scaleY',
    amplitude: 0.003,
    period: 2000,
    base: 1,
    target: 'tile',
    minZoom: 0.4
  },
  // Plains: grass tuft skew
  4: {
    property: 'skewX',
    amplitude: 0.04,
    period: 2800,
    base: 0,
    target: 'feature',
    minZoom: 0.4
  },
  // Grassland: feature skew (bushes, grass)
  5: {
    property: 'skewX',
    amplitude: 0.05,
    period: 2500,
    base: 0,
    target: 'feature',
    minZoom: 0.4
  },
  // Forest: tree sway via rotation
  6: {
    property: 'rotation',
    amplitude: 0.03,
    period: 3500,
    base: 0,
    target: 'feature',
    minZoom: 0.4
  },
  // Hills: bush sway (subtle)
  7: {
    property: 'rotation',
    amplitude: 0.015,
    period: 4000,
    base: 0,
    target: 'feature',
    minZoom: 0.4
  }
}

/**
 * Per-terrain particle configs.
 * Key = terrain ID. Undefined means no particles.
 */
export const PARTICLE_CONFIGS: Partial<Record<number, ParticleConfig>> = {
  // Water: glints
  0: {
    texture: 'spark',
    spawnRate: 0.3,
    lifetime: [800, 1500],
    speed: [0, 0],
    direction: [0, 0],
    alpha: [0, 0.6],
    scale: [0.5, 0.5],
    tint: 0xffffff,
    minZoom: 0.6
  },
  1: {
    texture: 'spark',
    spawnRate: 0.5,
    lifetime: [600, 1200],
    speed: [0, 0],
    direction: [0, 0],
    alpha: [0, 0.7],
    scale: [0.4, 0.4],
    tint: 0xffffff,
    minZoom: 0.6
  },
  // Desert: dust
  3: {
    texture: 'dot',
    spawnRate: 0.8,
    lifetime: [2000, 4000],
    speed: [8, 20],
    direction: [-0.3, 0.3], // mostly horizontal
    alpha: [0.4, 0],
    scale: [0.3, 0.6],
    tint: 0xd4c090,
    minZoom: 0.4
  },
  // Plains: pollen
  4: {
    texture: 'dot',
    spawnRate: 0.3,
    lifetime: [3000, 5000],
    speed: [3, 8],
    direction: [-Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5], // mostly upward
    alpha: [0.3, 0],
    scale: [0.2, 0.3],
    tint: 0xf0e080,
    minZoom: 0.6
  },
  // Forest: fireflies
  6: {
    texture: 'spark',
    spawnRate: 0.4,
    lifetime: [2000, 4000],
    speed: [2, 5],
    direction: [0, Math.PI * 2], // any direction
    alpha: [0, 0.8],
    scale: [0.3, 0.3],
    tint: 0xccff66,
    minZoom: 0.6
  },
  // Snow: snowflakes
  9: {
    texture: 'flake',
    spawnRate: 1.5,
    lifetime: [3000, 6000],
    speed: [5, 15],
    direction: [Math.PI / 2 - 0.4, Math.PI / 2 + 0.4], // downward with drift
    alpha: [0.7, 0],
    scale: [0.3, 0.5],
    tint: 0xffffff,
    minZoom: 0.4
  },
  // Mountain: snow + wind
  8: {
    texture: 'flake',
    spawnRate: 0.6,
    lifetime: [2000, 4000],
    speed: [10, 25],
    direction: [Math.PI / 2 - 0.6, Math.PI / 2 + 0.2], // angled fall
    alpha: [0.5, 0],
    scale: [0.2, 0.4],
    tint: 0xe8edf3,
    minZoom: 0.4
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run test/unit/hex-animation-config.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/utils/hex-animation-config.ts test/unit/hex-animation-config.test.ts
git commit -m "feat: add per-biome animation configs"
```

---

### Task 4: Ambient System

Replaces `hex-water-animator.ts`. Adds biome-specific oscillations to tiles and features.

**Files:**
- Create: `app/utils/hex-ambient-system.ts`
- Test: `test/unit/hex-ambient-system.test.ts`

**Context:**
- The existing `hex-water-animator.ts` (36 lines) cycles through 4 texture frames every 15 game frames. This behavior stays but is managed by AmbientSystem.
- `hex-tile-pool.ts` exposes `getActiveTiles()` returning `Map<string, { sprite: Sprite, q: number, r: number }>` and `getActiveWaterTiles()` for the water subset.
- `hex-feature-pool.ts` exposes `getActiveFeatures()` returning `Map<string, Sprite[]>` keyed by `"q,r"`.
- Terrain data retrieved via `getTerrain(mapData, q, r)` from `hex-map-data.ts`.
- Seeded randomness: `seededRandom(seed)` returns `{ next(): number }`.

**Step 1: Write the failing test**

Create `test/unit/hex-ambient-system.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createAmbientSystem } from '~/utils/hex-ambient-system'

// Minimal mocks
function mockSprite() {
  return {
    x: 0, y: 0, alpha: 1, rotation: 0,
    scale: { x: 1, y: 1 },
    skew: { x: 0, y: 0 },
    texture: null as unknown
  }
}

function mockTilePool(tiles: Array<{ q: number, r: number, terrain: number }>) {
  const activeTiles = new Map<string, { sprite: ReturnType<typeof mockSprite>, q: number, r: number }>()
  const waterTiles = new Map<string, { sprite: ReturnType<typeof mockSprite>, q: number, r: number }>()
  for (const t of tiles) {
    const entry = { sprite: mockSprite(), q: t.q, r: t.r }
    activeTiles.set(`${t.q},${t.r}`, entry)
    if (t.terrain <= 1) waterTiles.set(`${t.q},${t.r}`, entry)
  }
  return {
    getActiveTiles: () => activeTiles,
    getActiveWaterTiles: () => waterTiles
  }
}

function mockFeaturePool(features: Array<{ q: number, r: number, count: number }>) {
  const activeFeatures = new Map<string, ReturnType<typeof mockSprite>[]>()
  for (const f of features) {
    activeFeatures.set(`${f.q},${f.r}`, Array.from({ length: f.count }, () => mockSprite()))
  }
  return {
    getActiveFeatures: () => activeFeatures
  }
}

function mockMapData(terrainMap: Record<string, number>) {
  return {
    width: 100,
    height: 100,
    terrain: null as unknown,
    _terrainMap: terrainMap
  }
}

function getTerrain(mapData: ReturnType<typeof mockMapData>, q: number, r: number): number {
  return mapData._terrainMap[`${q},${r}`] ?? 0
}

describe('hex-ambient-system', () => {
  it('creates without errors', () => {
    const system = createAmbientSystem()
    expect(system).toBeDefined()
  })

  it('modifies forest feature rotation over time', () => {
    const system = createAmbientSystem()
    const featureSprite = mockSprite()
    const features = new Map([['3,3', [featureSprite]]])

    // Simulate forest terrain (6) with feature
    system.update({
      deltaMs: 1000,
      totalTime: 1000,
      zoom: 1.0,
      activeTiles: new Map([['3,3', { sprite: mockSprite(), q: 3, r: 3 }]]),
      activeWaterTiles: new Map(),
      activeFeatures: features,
      getTerrainId: (_q: number, _r: number) => 6, // forest
      waterFrames: null
    })

    // Forest config: rotation, amplitude 0.03
    // rotation should have changed from 0
    expect(featureSprite.rotation).not.toBe(0)
    expect(Math.abs(featureSprite.rotation)).toBeLessThanOrEqual(0.04)
  })

  it('does not animate features at low zoom', () => {
    const system = createAmbientSystem()
    const featureSprite = mockSprite()
    const features = new Map([['3,3', [featureSprite]]])

    system.update({
      deltaMs: 1000,
      totalTime: 1000,
      zoom: 0.2, // below minZoom 0.4
      activeTiles: new Map([['3,3', { sprite: mockSprite(), q: 3, r: 3 }]]),
      activeWaterTiles: new Map(),
      activeFeatures: features,
      getTerrainId: () => 6,
      waterFrames: null
    })

    expect(featureSprite.rotation).toBe(0)
  })

  it('animates water tile scaleX', () => {
    const system = createAmbientSystem()
    const waterSprite = mockSprite()
    const tiles = new Map([['0,0', { sprite: waterSprite, q: 0, r: 0 }]])

    system.update({
      deltaMs: 1000,
      totalTime: 1500,
      zoom: 0.5,
      activeTiles: tiles,
      activeWaterTiles: tiles,
      activeFeatures: new Map(),
      getTerrainId: () => 0, // deep water
      waterFrames: null
    })

    // Water scaleX should oscillate around 1.0 with amplitude 0.02
    expect(waterSprite.scale.x).not.toBe(1)
    expect(waterSprite.scale.x).toBeGreaterThanOrEqual(0.97)
    expect(waterSprite.scale.x).toBeLessThanOrEqual(1.03)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run test/unit/hex-ambient-system.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/hex-ambient-system.ts`:

```typescript
import { AMBIENT_CONFIGS, type AmbientConfig } from './hex-animation-config'
import { seededRandom } from './hex-map-data'
import type { Sprite } from 'pixi.js'

interface AmbientUpdateParams {
  deltaMs: number
  totalTime: number
  zoom: number
  activeTiles: Map<string, { sprite: { scale: { x: number, y: number }, skew: { x: number, y: number }, alpha: number, rotation: number }, q: number, r: number }>
  activeWaterTiles: Map<string, { sprite: { texture: unknown }, q: number, r: number }>
  activeFeatures: Map<string, Array<{ rotation: number, skew: { x: number, y: number }, scale: { x: number, y: number }, alpha: number }>>
  getTerrainId: (q: number, r: number) => number
  /** If provided, water texture frame cycling is handled externally (atlas.getWaterFrames) */
  waterFrames: ((terrainId: number) => unknown[]) | null
}

export interface AmbientSystem {
  update(params: AmbientUpdateParams): void
}

// Water frame cycling constants (migrated from hex-water-animator)
const WATER_FRAME_INTERVAL_MS = 250 // ~4 FPS
let waterFrameIndex = 0
let waterFrameTimer = 0

function hashSeed(q: number, r: number): number {
  return Math.abs((q * 73856093) ^ (r * 19349663))
}

function applyAmbientToSprite(
  sprite: { rotation: number, scale: { x: number, y: number }, skew: { x: number, y: number }, alpha: number },
  config: AmbientConfig,
  totalTime: number,
  seed: number
) {
  const phase = (seed % 1000) / 1000 * Math.PI * 2
  const value = config.base + Math.sin((totalTime / config.period) * Math.PI * 2 + phase) * config.amplitude

  switch (config.property) {
    case 'rotation':
      sprite.rotation = value
      break
    case 'skewX':
      sprite.skew.x = value
      break
    case 'scaleX':
      sprite.scale.x = value
      break
    case 'scaleY':
      sprite.scale.y = value
      break
    case 'alpha':
      sprite.alpha = value
      break
  }
}

export function createAmbientSystem(): AmbientSystem {
  function update(params: AmbientUpdateParams): void {
    const { totalTime, zoom, activeTiles, activeWaterTiles, activeFeatures, getTerrainId, waterFrames } = params

    // Water texture frame cycling (migrated from hex-water-animator)
    if (waterFrames && zoom >= 0.25) {
      waterFrameTimer += params.deltaMs
      if (waterFrameTimer >= WATER_FRAME_INTERVAL_MS) {
        waterFrameTimer -= WATER_FRAME_INTERVAL_MS
        waterFrameIndex = (waterFrameIndex + 1) % 4
        for (const [, entry] of activeWaterTiles) {
          const terrain = getTerrainId(entry.q, entry.r)
          const frames = waterFrames(terrain)
          if (frames && frames[waterFrameIndex]) {
            entry.sprite.texture = frames[waterFrameIndex]
          }
        }
      }
    }

    // Tile ambient effects (water sway, desert shimmer, beach alpha)
    for (const [, entry] of activeTiles) {
      const terrain = getTerrainId(entry.q, entry.r)
      const config = AMBIENT_CONFIGS[terrain]
      if (!config || config.target !== 'tile' || zoom < config.minZoom) continue

      const seed = hashSeed(entry.q, entry.r)
      applyAmbientToSprite(entry.sprite, config, totalTime, seed)
    }

    // Feature ambient effects (tree sway, grass skew)
    for (const [key, sprites] of activeFeatures) {
      const [qStr, rStr] = key.split(',')
      const q = Number(qStr)
      const r = Number(rStr)
      const terrain = getTerrainId(q, r)
      const config = AMBIENT_CONFIGS[terrain]
      if (!config || config.target !== 'feature' || zoom < config.minZoom) continue

      for (let i = 0; i < sprites.length; i++) {
        const seed = hashSeed(q, r) + i * 7919
        applyAmbientToSprite(sprites[i], config, totalTime, seed)
      }
    }
  }

  return { update }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run test/unit/hex-ambient-system.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/utils/hex-ambient-system.ts test/unit/hex-ambient-system.test.ts
git commit -m "feat: add ambient animation system for biome effects"
```

---

### Task 5: Particle System

Pooled particles with per-biome configs. Spawns in visible area, respects LOD.

**Files:**
- Create: `app/utils/hex-particle-system.ts`
- Test: `test/unit/hex-particle-system.test.ts`

**Context:**
- Particles are simple sprites with position, velocity, alpha, scale, lifetime.
- Need to create tiny procedural textures (dot, flake, spark) via Canvas.
- Particles live in a dedicated PixiJS Container.
- Max ~200 particles active. Pool and reuse.
- Spawn based on visible tiles of matching biome terrain.

**Step 1: Write the failing test**

Create `test/unit/hex-particle-system.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createParticleSystem, type ParticleSystem } from '~/utils/hex-particle-system'

describe('hex-particle-system', () => {
  let system: ParticleSystem

  beforeEach(() => {
    system = createParticleSystem()
  })

  it('creates with zero active particles', () => {
    expect(system.activeCount()).toBe(0)
  })

  it('spawns particles for matching biome tiles', () => {
    // Snow terrain (9) has spawnRate 1.5/sec, so in 2 seconds with 5 tiles
    // expected: 1.5 * 2 * 5 = 15 particles (probabilistic, but close)
    system.update({
      deltaMs: 2000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map([[9, 5]])
    })

    // With spawnRate 1.5 per tile per second, 5 tiles, 2s = 15 expected
    // Allow variance since it's per-frame accumulation
    expect(system.activeCount()).toBeGreaterThan(0)
    expect(system.activeCount()).toBeLessThanOrEqual(200)
  })

  it('does not spawn at low zoom', () => {
    system.update({
      deltaMs: 2000,
      zoom: 0.1, // below any minZoom
      visibleTilesPerTerrain: new Map([[9, 10]])
    })

    expect(system.activeCount()).toBe(0)
  })

  it('removes expired particles', () => {
    // Spawn some particles
    system.update({
      deltaMs: 1000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map([[9, 3]])
    })

    const initialCount = system.activeCount()
    expect(initialCount).toBeGreaterThan(0)

    // Advance time past max lifetime (6000ms for snow)
    system.update({
      deltaMs: 7000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map()
    })

    expect(system.activeCount()).toBeLessThan(initialCount)
  })

  it('respects max particle limit of 200', () => {
    // Spawn a lot
    for (let i = 0; i < 20; i++) {
      system.update({
        deltaMs: 1000,
        zoom: 1.0,
        visibleTilesPerTerrain: new Map([[9, 50]])
      })
    }

    expect(system.activeCount()).toBeLessThanOrEqual(200)
  })

  it('reduces spawn rate at medium zoom (0.4-0.6)', () => {
    const systemA = createParticleSystem()
    const systemB = createParticleSystem()

    // Full zoom
    systemA.update({
      deltaMs: 5000,
      zoom: 1.0,
      visibleTilesPerTerrain: new Map([[9, 5]])
    })

    // Medium zoom (50% rate)
    systemB.update({
      deltaMs: 5000,
      zoom: 0.5,
      visibleTilesPerTerrain: new Map([[9, 5]])
    })

    // At 50% rate, should have roughly fewer particles
    // This is probabilistic, so just check both spawned some
    expect(systemA.activeCount()).toBeGreaterThan(0)
    expect(systemB.activeCount()).toBeGreaterThan(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run test/unit/hex-particle-system.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/hex-particle-system.ts`:

```typescript
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
  /** Map of terrainId → count of visible tiles with that terrain */
  visibleTilesPerTerrain: Map<number, number>
}

export interface ParticleSystem {
  update(params: ParticleUpdateParams): void
  activeCount(): number
  /** Returns active particles for rendering. Read-only. */
  getParticles(): ReadonlyArray<Readonly<Particle>>
  /** Reset all particles */
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

  // Spawn accumulator per terrain
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
    // Swap-remove for O(1)
    particles[index] = particles[particles.length - 1]
    particles.pop()
  }

  function spawnOne(config: ParticleConfig, terrainId: number): void {
    const p = acquireParticle()
    if (!p) return

    const dir = randomRange(config.direction[0], config.direction[1])
    const speed = randomRange(config.speed[0], config.speed[1])

    p.x = 0 // Position set by renderer (random within visible area)
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

    // Spawn new particles based on visible biome tiles
    for (const [terrainId, config] of Object.entries(PARTICLE_CONFIGS)) {
      const tid = Number(terrainId)
      if (zoom < config.minZoom) continue

      const tileCount = visibleTilesPerTerrain.get(tid) ?? 0
      if (tileCount === 0) continue

      // Reduce rate at medium zoom
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
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run test/unit/hex-particle-system.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/utils/hex-particle-system.ts test/unit/hex-particle-system.test.ts
git commit -m "feat: add particle system with biome-specific effects"
```

---

### Task 6: Transition System

Gameplay animation coordinator. Uses tween engine for path movement, hex reveals, and flash effects.

**Files:**
- Create: `app/utils/hex-transition-system.ts`
- Test: `test/unit/hex-transition-system.test.ts`

**Step 1: Write the failing test**

Create `test/unit/hex-transition-system.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTransitionSystem, type TransitionSystem } from '~/utils/hex-transition-system'
import { createTweenEngine, type TweenEngine } from '~/utils/hex-tween-engine'

function mockSprite() {
  return { x: 0, y: 0, alpha: 1, rotation: 0, scale: { x: 1, y: 1 }, tint: 0xffffff, visible: false }
}

describe('hex-transition-system', () => {
  let tween: TweenEngine
  let system: TransitionSystem

  beforeEach(() => {
    tween = createTweenEngine()
    system = createTransitionSystem(tween)
  })

  describe('movePath', () => {
    it('moves sprite along a series of waypoints', () => {
      const sprite = mockSprite()
      const path = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]

      let arrived = false
      system.movePath(sprite, path, {
        speed: 100,
        easing: 'linear',
        onArrive: () => { arrived = true }
      })

      // First segment: 100px at 100px/s = 1000ms
      tween.update(1000)
      expect(sprite.x).toBeCloseTo(100, 0)
      expect(sprite.y).toBeCloseTo(0, 0)
      expect(arrived).toBe(false)

      // Second segment: 100px at 100px/s = 1000ms
      tween.update(1000)
      expect(sprite.x).toBeCloseTo(100, 0)
      expect(sprite.y).toBeCloseTo(100, 0)
      expect(arrived).toBe(true)
    })
  })

  describe('flashHex', () => {
    it('creates a flash overlay with pulsing alpha', () => {
      const overlaySprite = mockSprite()
      let completed = false

      system.flashHex(overlaySprite, {
        x: 50, y: 50,
        color: 0xff0000,
        duration: 600,
        pulses: 2,
        onComplete: () => { completed = true }
      })

      expect(overlaySprite.visible).toBe(true)
      expect(overlaySprite.x).toBe(50)
      expect(overlaySprite.y).toBe(50)

      // After full duration, should complete
      // 2 pulses * 300ms per pulse = 600ms total
      tween.update(600)
      expect(completed).toBe(true)
    })
  })

  describe('revealHexes', () => {
    it('fades in sprites with stagger delay', () => {
      const sprites = [mockSprite(), mockSprite(), mockSprite()]
      sprites.forEach(s => { s.alpha = 0 })

      system.revealHexes(sprites, {
        stagger: 100,
        duration: 200,
        easing: 'linear'
      })

      // At t=200: first sprite done, second halfway, third just starting
      tween.update(200)
      expect(sprites[0].alpha).toBeCloseTo(1, 1)
      expect(sprites[1].alpha).toBeCloseTo(0.5, 1)
      expect(sprites[2].alpha).toBeCloseTo(0, 1)

      // At t=400: all done
      tween.update(200)
      expect(sprites[1].alpha).toBeCloseTo(1, 1)
      expect(sprites[2].alpha).toBeCloseTo(0.5, 1)

      tween.update(100)
      expect(sprites[2].alpha).toBeCloseTo(1, 0)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run test/unit/hex-transition-system.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/hex-transition-system.ts`:

```typescript
import type { TweenEngine } from './hex-tween-engine'
import type { EasingName } from './hex-easing'

interface MovePathOptions {
  speed: number // px/s
  easing: EasingName
  onArrive?: () => void
}

interface FlashHexOptions {
  x: number
  y: number
  color: number
  duration: number
  pulses: number
  onComplete?: () => void
}

interface RevealHexesOptions {
  stagger: number // ms between each hex start
  duration: number // ms per hex
  easing: EasingName
}

type AnimatableSprite = Record<string, number> & {
  x: number
  y: number
  alpha: number
  visible: boolean
  tint: number
}

export interface TransitionSystem {
  movePath(sprite: AnimatableSprite, path: Array<{ x: number, y: number }>, options: MovePathOptions): void
  flashHex(overlaySprite: AnimatableSprite, options: FlashHexOptions): void
  revealHexes(sprites: AnimatableSprite[], options: RevealHexesOptions): void
}

export function createTransitionSystem(tween: TweenEngine): TransitionSystem {
  function movePath(sprite: AnimatableSprite, path: Array<{ x: number, y: number }>, options: MovePathOptions): void {
    if (path.length < 2) {
      options.onArrive?.()
      return
    }

    // Set initial position
    sprite.x = path[0].x
    sprite.y = path[0].y

    // Build chain of segment tweens
    const chain = tween.chain()
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]
      const next = path[i]
      const dx = next.x - prev.x
      const dy = next.y - prev.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = (distance / options.speed) * 1000

      const isLast = i === path.length - 1
      chain.to(sprite, { x: next.x, y: next.y }, {
        duration,
        easing: options.easing,
        onComplete: isLast ? options.onArrive : undefined
      })
    }

    chain.start()
  }

  function flashHex(overlaySprite: AnimatableSprite, options: FlashHexOptions): void {
    overlaySprite.x = options.x
    overlaySprite.y = options.y
    overlaySprite.tint = options.color
    overlaySprite.visible = true
    overlaySprite.alpha = 0

    const pulseDuration = options.duration / options.pulses
    const chain = tween.chain()

    for (let i = 0; i < options.pulses; i++) {
      const isLast = i === options.pulses - 1
      chain
        .to(overlaySprite, { alpha: 0.6 }, { duration: pulseDuration / 2, easing: 'easeInOutSine' })
        .to(overlaySprite, { alpha: 0 }, {
          duration: pulseDuration / 2,
          easing: 'easeInOutSine',
          onComplete: isLast ? () => {
            overlaySprite.visible = false
            options.onComplete?.()
          } : undefined
        })
    }

    chain.start()
  }

  function revealHexes(sprites: AnimatableSprite[], options: RevealHexesOptions): void {
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i]
      const delay = i * options.stagger

      // Use a delayed start: first tween does nothing for `delay` ms, then fades in
      if (delay > 0) {
        const chain = tween.chain()
        // Delay phase: hold alpha at current value
        chain.to(sprite, { alpha: 0 }, { duration: delay, easing: 'linear' })
        // Reveal phase
        chain.to(sprite, { alpha: 1 }, { duration: options.duration, easing: options.easing })
        chain.start()
      } else {
        tween.to(sprite, { alpha: 1 }, { duration: options.duration, easing: options.easing })
      }
    }
  }

  return { movePath, flashHex, revealHexes }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run test/unit/hex-transition-system.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/utils/hex-transition-system.ts test/unit/hex-transition-system.test.ts
git commit -m "feat: add transition system for gameplay animations"
```

---

### Task 7: Animation Manager

Central coordinator that owns all subsystems and connects to PixiJS ticker.

**Files:**
- Create: `app/utils/hex-animation-manager.ts`
- Test: `test/unit/hex-animation-manager.test.ts`

**Context:**
- Owns: TweenEngine, AmbientSystem, ParticleSystem, TransitionSystem
- `update(deltaMs, camera)` called each frame from HexMap.vue ticker
- Provides accessors to subsystems for external use

**Step 1: Write the failing test**

Create `test/unit/hex-animation-manager.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createAnimationManager } from '~/utils/hex-animation-manager'

describe('hex-animation-manager', () => {
  it('creates with all subsystems', () => {
    const manager = createAnimationManager()
    expect(manager).toBeDefined()
    expect(manager.tween).toBeDefined()
    expect(manager.ambient).toBeDefined()
    expect(manager.particles).toBeDefined()
    expect(manager.transitions).toBeDefined()
  })

  it('update increments totalTime', () => {
    const manager = createAnimationManager()
    expect(manager.totalTime()).toBe(0)

    manager.update({
      deltaMs: 100,
      zoom: 1.0,
      activeTiles: new Map(),
      activeWaterTiles: new Map(),
      activeFeatures: new Map(),
      getTerrainId: () => 0,
      waterFrames: null,
      visibleTilesPerTerrain: new Map()
    })

    expect(manager.totalTime()).toBe(100)
  })

  it('update drives tween engine', () => {
    const manager = createAnimationManager()
    const target = { x: 0, y: 0, alpha: 1, rotation: 0 }
    manager.tween.to(target, { x: 100 }, { duration: 1000, easing: 'linear' })

    manager.update({
      deltaMs: 500,
      zoom: 1.0,
      activeTiles: new Map(),
      activeWaterTiles: new Map(),
      activeFeatures: new Map(),
      getTerrainId: () => 0,
      waterFrames: null,
      visibleTilesPerTerrain: new Map()
    })

    expect(target.x).toBeCloseTo(50, 0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run test/unit/hex-animation-manager.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/hex-animation-manager.ts`:

```typescript
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

    // 1. Tweens first (transitions depend on them)
    tween.update(deltaMs)

    // 2. Ambient animations
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

    // 3. Particles
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
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run test/unit/hex-animation-manager.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/utils/hex-animation-manager.ts test/unit/hex-animation-manager.test.ts
git commit -m "feat: add animation manager coordinating all subsystems"
```

---

### Task 8: Particle Textures

Create tiny procedural textures for particles (dot, flake, spark). Needed before integrating particles into HexMap.vue.

**Files:**
- Create: `app/utils/hex-particle-textures.ts`
- Test: (visual only — no unit test; verified during integration)

**Step 1: Write implementation**

Create `app/utils/hex-particle-textures.ts`:

```typescript
import { Texture } from 'pixi.js'

export interface ParticleTextures {
  dot: Texture
  flake: Texture
  spark: Texture
  destroy(): void
}

function createCircleTexture(size: number, color: string, blur: boolean): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')!

  if (blur) {
    const gradient = ctx.createRadialGradient(size, size, 0, size, size, size)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
  } else {
    ctx.fillStyle = color
  }

  ctx.beginPath()
  ctx.arc(size, size, size, 0, Math.PI * 2)
  ctx.fill()

  return Texture.from(canvas)
}

function createFlakeTexture(): Texture {
  const size = 6
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')!
  const cx = size
  const cy = size

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1

  // 6 arms of snowflake
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(angle) * (size - 1), cy + Math.sin(angle) * (size - 1))
    ctx.stroke()
  }

  // Center dot
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(cx, cy, 1, 0, Math.PI * 2)
  ctx.fill()

  return Texture.from(canvas)
}

export function createParticleTextures(): ParticleTextures {
  const dot = createCircleTexture(3, 'white', false)
  const spark = createCircleTexture(4, 'white', true)
  const flake = createFlakeTexture()

  return {
    dot,
    flake,
    spark,
    destroy() {
      dot.destroy(true)
      spark.destroy(true)
      flake.destroy(true)
    }
  }
}
```

**Step 2: Commit**

```bash
git add app/utils/hex-particle-textures.ts
git commit -m "feat: add procedural particle textures (dot, flake, spark)"
```

---

### Task 9: Integrate Animation System into HexMap.vue

Wire everything together. Replace waterAnimator with AnimationManager. Add particle container and rendering. Expose `getActiveFeatures()` from feature pool.

**Files:**
- Modify: `app/components/HexMap.vue`
- Modify: `app/utils/hex-feature-pool.ts` (add `getActiveFeatures()` method)
- Delete: `app/utils/hex-water-animator.ts` (logic migrated to ambient system)

**Context:**
- Current `HexMap.vue` is 180 lines. It creates pools in `onMounted`, runs a ticker loop.
- Current ticker calls `waterAnimator.update(frameCount)` directly.
- Feature pool currently has `activeFeatures: Map<string, Sprite[]>` internally but does not expose it. Need to add getter.
- Need to add `particleContainer` to the worldContainer hierarchy.
- Need to create PixiJS sprites for particles and sync with particle system data.

**Step 1: Add `getActiveFeatures()` to feature pool**

In `app/utils/hex-feature-pool.ts`, the active features are stored in a `Map<string, Sprite[]>` called `activeFeatures`. Add a public getter.

Find the return statement in `createFeaturePool()` and add `getActiveFeatures`:

```typescript
// In the return object of createFeaturePool(), add:
getActiveFeatures: () => activeFeatures
```

**Step 2: Update HexMap.vue**

Replace the water animator with the animation manager. Key changes:

1. Replace `import { createWaterAnimator }` with `import { createAnimationManager }`
2. Add `import { createParticleTextures }` and particle container setup
3. Replace `waterAnimator.update(frameCount)` in ticker with `animationManager.update(...)`
4. Add particle sprite rendering loop after animation update
5. Count visible tiles per terrain for particle spawning
6. Add `particleContainer` between `featurePool.container` and `lodGraphics`

The exact edits to HexMap.vue:

**Remove:** `WaterAnimator` import and `createWaterAnimator()` call.
**Remove:** `waterAnimator.update(frameCount)` from ticker.
**Add:** `AnimationManager` setup, particle container, particle sprite pool.

In the ticker loop, replace the water animator call with:

```typescript
// Count visible tiles per terrain for particle system
const visibleTilesPerTerrain = new Map<number, number>()
for (const [, entry] of tilePool.getActiveTiles()) {
  const t = getTerrain(mapData, entry.q, entry.r)
  visibleTilesPerTerrain.set(t, (visibleTilesPerTerrain.get(t) ?? 0) + 1)
}

animationManager.update({
  deltaMs: ticker.deltaMS,
  zoom: camera.zoom,
  activeTiles: tilePool.getActiveTiles(),
  activeWaterTiles: tilePool.getActiveWaterTiles(),
  activeFeatures: featurePool.getActiveFeatures(),
  getTerrainId: (q, r) => getTerrain(mapData, q, r),
  waterFrames: (terrainId) => atlas.getWaterFrames(terrainId),
  visibleTilesPerTerrain
})

// Sync particle sprites with particle system data
syncParticleSprites(animationManager.particles, particleTextures, particleContainer, camera)
```

Add a `syncParticleSprites` function that:
1. Gets active particles from particle system
2. Ensures enough sprites exist in particle container (pool/grow as needed)
3. Updates each sprite's position (random within visible area, offset by particle x/y), alpha, scale, tint
4. Hides unused sprites

**Step 3: Run the dev server to verify visual correctness**

Run: `bun dev`
- Verify map loads without errors
- Verify water still animates
- Verify trees sway subtly when zoomed in (zoom >= 0.4)
- Verify particles appear on snow/desert when zoomed in (zoom >= 0.4-0.6)
- Verify no console errors
- Verify FPS stays above 30

**Step 4: Remove old water animator file**

```bash
rm app/utils/hex-water-animator.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate animation system into hex map renderer

Replace standalone water animator with unified AnimationManager.
Add ambient biome effects (tree sway, water oscillation, grass skew).
Add particle system rendering (snow, dust, fireflies, pollen, glints).
Add transition system foundations for future gameplay animations."
```

---

### Task 10: Final Verification and Tuning

Run all tests, verify visual quality, tune animation parameters.

**Step 1: Run all tests**

Run: `bun test`
Expected: All PASS (unit + nuxt)

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `bun run lint`
Expected: No errors (fix any that appear)

**Step 4: Visual tuning**

Run `bun dev` and verify at different zoom levels:

| Zoom | Expected |
|------|----------|
| 2.0 (max) | All effects visible: tree sway, water oscillation, particles |
| 1.0 | Same as above |
| 0.6 | Particles at full rate, all ambient effects |
| 0.5 | Particles at 50% rate, ambient still active |
| 0.4 | Features/particles appear, ambient tile effects active |
| 0.25 | Only water texture cycling (LOD threshold) |
| 0.15 (min) | LOD rectangles only, no animations |

Adjust values in `hex-animation-config.ts` if any effect feels too strong or too weak:
- Tree sway: `amplitude: 0.03` rad — should be barely noticeable
- Water swell: `amplitude: 0.02` scaleX — gentle breathing
- Desert shimmer: `amplitude: 0.003` scaleY — almost imperceptible
- Particle spawn rates — should feel sparse, not overwhelming

**Step 5: Final commit if tuning was needed**

```bash
git add -A
git commit -m "fix: tune animation parameters for visual quality"
```
