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

interface LoopingChain {
  steps: ChainStep[]
  currentIndex: number
  currentEntry: TweenEntry | null
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

export function createTweenEngine(): TweenEngine {
  const entries: TweenEntry[] = []
  const pool: TweenEntry[] = []
  const loopingChains: LoopingChain[] = []

  function acquireEntry(): TweenEntry {
    if (pool.length > 0) {
      return pool.pop()!
    }
    return {
      target: {},
      props: [],
      startValues: [],
      endValues: [],
      elapsed: 0,
      duration: 0,
      easing: 'linear',
      active: false
    }
  }

  function releaseEntry(entry: TweenEntry): void {
    entry.active = false
    entry.onComplete = undefined
    pool.push(entry)
  }

  function startTween(
    target: Record<string, number>,
    endProps: Record<string, number>,
    options: TweenOptions
  ): TweenEntry {
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

  function to(
    target: Record<string, number>,
    props: Record<string, number>,
    options: TweenOptions
  ): void {
    startTween(target, props, options)
  }

  function cancel(target: Record<string, number>): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].target === target) {
        releaseEntry(entries[i])
        entries.splice(i, 1)
      }
    }
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

  function startChainStep(steps: ChainStep[], index: number): void {
    if (index >= steps.length) return
    const step = steps[index]
    startTween(step.target, step.endProps, {
      ...step.options,
      onComplete: () => {
        step.options.onComplete?.()
        startChainStep(steps, index + 1)
      }
    })
  }

  function startLoopStep(lc: LoopingChain): void {
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
        const lc: LoopingChain = {
          steps,
          currentIndex: 0,
          currentEntry: null
        }
        loopingChains.push(lc)
        startLoopStep(lc)
      }
    }
    return chainApi
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
        // Clamp to exact end values
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
