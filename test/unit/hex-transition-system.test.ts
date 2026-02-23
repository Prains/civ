import { describe, it, expect, beforeEach } from 'vitest'
import { createTransitionSystem, type TransitionSystem } from '../../app/utils/hex-transition-system'
import { createTweenEngine, type TweenEngine } from '../../app/utils/hex-tween-engine'

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
      tween.update(600)
      expect(completed).toBe(true)
    })
  })

  describe('revealHexes', () => {
    it('fades in sprites with stagger delay', () => {
      const sprites = [mockSprite(), mockSprite(), mockSprite()]
      sprites.forEach((s) => {
        s.alpha = 0
      })

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
