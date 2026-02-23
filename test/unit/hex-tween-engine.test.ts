import { describe, it, expect, beforeEach } from 'vitest'
import { createTweenEngine } from '../../app/utils/hex-tween-engine'

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
