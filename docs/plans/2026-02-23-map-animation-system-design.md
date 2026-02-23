# Map Animation System Design

**Date:** 2026-02-23
**Status:** Approved
**Style:** Minimalist / Indie - subtle, rhythmic animations

## Context

The hex map renderer has a solid foundation: sprite pooling, procedural textures, elevation lighting, shadows, and basic water frame cycling. The only animation is 4-frame water texture swap. Goal: make the map feel alive with a unified animation system that covers both ambient atmosphere and future gameplay transitions.

## Architecture

### Central AnimationManager

Single coordinator attached to PixiJS ticker, manages all subsystems:

```
HexMap.vue ticker
  └── AnimationManager.update(deltaTime, camera)
        ├── TweenEngine.update(dt)
        ├── AmbientSystem.update(dt, cam)
        ├── ParticleSystem.update(dt, cam)
        └── TransitionSystem.update(dt)
```

### Principles

- **LOD-aware**: each subsystem receives current zoom, disables heavy effects at far zoom
- **Pool-friendly**: works with existing sprite pools, no runtime allocations
- **Configurable**: biome configs define which effects on which tile
- **Shared easing functions**: linear, easeInOutSine, easeInOutQuad, easeOutBounce, easeOutElastic

### File Structure

```
app/utils/
  hex-animation-manager.ts     — coordinator
  hex-tween-engine.ts           — tween system
  hex-ambient-system.ts         — ambient animations (water, trees, grass)
  hex-particle-system.ts        — particles
  hex-transition-system.ts      — gameplay transitions
  hex-easing.ts                 — easing functions
  hex-animation-config.ts       — per-biome effect configs
```

Existing `hex-water-animator.ts` migrates into `AmbientSystem`.

## Tween Engine

Lightweight property interpolation for any PixiJS DisplayObject.

### API

```typescript
tween.to(sprite, { x: 200, y: 150, alpha: 1, rotation: 0.1 },
  { duration: 500, easing: 'easeInOutQuad', onComplete: () => {} })

tween.to(sprite, { y: -5 }, { duration: 800, easing: 'easeInOutSine' })
  .to(sprite, { y: 0 }, { duration: 800, easing: 'easeInOutSine' })
  .loop()

tween.cancel(sprite)
```

### Internals

- Array of active `TweenEntry` (target, props, start/end values, elapsed, duration, easing, onComplete)
- `update(dt)` iterates, interpolates, removes completed
- Pooled `TweenEntry` objects (no runtime allocations)
- Easing: linear, easeInOutSine, easeInOutQuad, easeOutBounce, easeOutElastic

### Use Cases

| What | Tween |
|------|-------|
| Unit moves along path | `x, y` with `easeInOutQuad` |
| Unit appears | `alpha: 0→1, scale: 0.8→1` with `easeOutBack` |
| Hex highlight | `tint` smooth transition |
| Fog-of-war | `alpha: 0→0.6` overlay |
| Camera pan to event | Camera `x, y, zoom` smooth |

## Ambient System

Replaces `hex-water-animator.ts`. Adds life to the world.

### Per-Biome Effects

| Biome | Effect | Implementation |
|-------|--------|----------------|
| Deep/Shallow water | Gentle sway + texture cycle | `scale.x` sine 0.98-1.02, improved frame cycling |
| Forest | Tree sway | `rotation`: sin(time + seed) * 0.03 rad |
| Grassland | Grass sway | `skew.x`: sin(time + seed) * 0.05 |
| Desert | Heat shimmer | `scale.y`: 1.0 + sin(time) * 0.003 (barely visible) |
| Snow | Static (stillness = cold) | No ambient, particles instead |
| Mountains | Static | Stability = massiveness |
| Beach | Gentle shimmer | `alpha` 0.95-1.0 in waves |

### Key Principles

- Each animation offset by `seed = hash(q, r)` to avoid synchronization
- Very small amplitudes (indie style - subtle, rhythmic)
- Disabled at zoom < 0.25 (LOD mode)
- Feature sway disabled at zoom < 0.4

## Particle System

Pooled particles for atmospheric biome-specific effects.

### Architecture

- **ParticleEmitter** - configurable, bound to visible area or point
- **Particle pool** - reusable Sprites with alpha, position, velocity, lifetime
- One shared Container for all particles (above features, below UI)
- Max ~200 active particles on screen

### Per-Biome Particles

| Biome | Particles | Behavior |
|-------|-----------|----------|
| Snow/Mountain | Snowflakes | Slow fall, horizontal drift, alpha fade |
| Desert | Dust/sand | Horizontal wind, small dots, alpha 0.3-0.5 |
| Forest | Fireflies | Slow random motion, alpha pulsation |
| Water | Glints | Appear/disappear in place, sin alpha pulse |
| Plains/Grassland | Pollen | Slow rise, gentle drift |

### Config Format

```typescript
interface ParticleConfig {
  texture: string           // 'dot' | 'flake' | 'spark'
  spawnRate: number         // particles/sec
  lifetime: [min, max]      // ms
  speed: [min, max]         // px/s
  direction: [minAngle, maxAngle]  // radians
  alpha: [start, end]
  scale: [start, end]
  tint?: number
}
```

### LOD

- zoom >= 0.6: full particles
- zoom 0.4-0.6: reduced spawnRate (50%)
- zoom < 0.4: particles disabled

## Transition System

For gameplay animations (units, events, fog-of-war). System is ready even before units exist.

### API

```typescript
transitions.movePath(unitSprite, [hex1, hex2, hex3], {
  speed: 200, easing: 'easeInOutQuad', onArrive: () => {}
})

transitions.revealHexes(hexCoords[], {
  stagger: 50, duration: 400, effect: 'fadeIn'
})

transitions.flashHex(q, r, {
  color: 0xff4444, duration: 300, pulses: 2
})
```

Uses TweenEngine internally. Adds coordination (stagger, path sequencing). Overlay sprites for flash/highlight from own pool.

## Integration

### HexMap.vue Changes

```typescript
// Before:
app.ticker.add(() => {
  waterAnimator.update(frameCount)
})

// After:
app.ticker.add((ticker) => {
  animationManager.update(ticker.deltaMS, camera)
})
```

### New Container Layers

```
worldContainer
  ├── shadowPool          (existing)
  ├── tilePool            (existing)
  ├── featurePool         (existing, + ambient rotation/skew)
  ├── particleContainer   (NEW)
  ├── overlayPool         (NEW - flash/highlight)
  └── lodGraphics         (existing)
```

### Migration

`hex-water-animator.ts` logic moves into `AmbientSystem`. Same behavior, unified management.

## Performance Budget

- Target: 30-60 FPS (balance mode)
- Max particles: ~200 on screen
- Ambient updates: only visible tiles, LOD-gated
- Tweens: pooled entries, no GC pressure
- All effects respect zoom-based LOD thresholds
