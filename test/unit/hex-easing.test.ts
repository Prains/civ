import { describe, it, expect } from 'vitest'
import { easings, type EasingName } from '../../app/utils/hex-easing'

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
