export type EasingName
  = 'linear'
    | 'easeInOutSine'
    | 'easeInOutQuad'
    | 'easeOutBack'
    | 'easeOutBounce'
    | 'easeOutElastic'

type EasingFn = (t: number) => number

export const easings: Record<EasingName, EasingFn> = {
  linear: t => t,

  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,

  easeInOutQuad: t => t < 0.5
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
