import type { TweenEngine } from './hex-tween-engine'
import { easings, type EasingName } from './hex-easing'

interface MovePathOptions {
  speed: number
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
  stagger: number
  duration: number
  easing: EasingName
}

type AnimatableSprite = {
  x: number
  y: number
  alpha: number
  visible: boolean
  tint: number
} & Record<string, unknown>

interface InternalAnimation {
  update(deltaMs: number): boolean // returns true when complete
}

export interface TransitionSystem {
  movePath(sprite: AnimatableSprite, path: Array<{ x: number, y: number }>, options: MovePathOptions): void
  flashHex(overlaySprite: AnimatableSprite, options: FlashHexOptions): void
  revealHexes(sprites: AnimatableSprite[], options: RevealHexesOptions): void
}

export function createTransitionSystem(tween: TweenEngine): TransitionSystem {
  const animations: InternalAnimation[] = []

  const originalUpdate = tween.update.bind(tween)
  tween.update = (deltaMs: number) => {
    for (let i = animations.length - 1; i >= 0; i--) {
      const done = animations[i]!.update(deltaMs)
      if (done) {
        animations.splice(i, 1)
      }
    }
    originalUpdate(deltaMs)
  }

  function movePath(
    sprite: AnimatableSprite,
    path: Array<{ x: number, y: number }>,
    options: MovePathOptions
  ): void {
    if (path.length < 2) {
      options.onArrive?.()
      return
    }

    sprite.x = path[0]!.x
    sprite.y = path[0]!.y

    const segments: Array<{ startX: number, startY: number, endX: number, endY: number, duration: number }> = []
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]!
      const next = path[i]!
      const dx = next.x - prev.x
      const dy = next.y - prev.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = (distance / options.speed) * 1000
      segments.push({
        startX: prev.x,
        startY: prev.y,
        endX: next.x,
        endY: next.y,
        duration
      })
    }

    let currentSegment = 0
    let segmentElapsed = 0
    const easingFn = easings[options.easing]

    animations.push({
      update(deltaMs: number): boolean {
        segmentElapsed += deltaMs

        while (currentSegment < segments.length) {
          const seg = segments[currentSegment]!

          if (segmentElapsed >= seg.duration) {
            sprite.x = seg.endX
            sprite.y = seg.endY
            segmentElapsed -= seg.duration
            currentSegment++

            if (currentSegment >= segments.length) {
              options.onArrive?.()
              return true
            }
          } else {
            const progress = segmentElapsed / seg.duration
            const eased = easingFn(progress)
            sprite.x = seg.startX + (seg.endX - seg.startX) * eased
            sprite.y = seg.startY + (seg.endY - seg.startY) * eased
            return false
          }
        }

        return true
      }
    })
  }

  function flashHex(overlaySprite: AnimatableSprite, options: FlashHexOptions): void {
    overlaySprite.x = options.x
    overlaySprite.y = options.y
    overlaySprite.tint = options.color
    overlaySprite.visible = true
    overlaySprite.alpha = 0

    const totalDuration = options.duration
    let elapsed = 0
    const pulseDuration = totalDuration / options.pulses
    const easingFn = easings.easeInOutSine

    animations.push({
      update(deltaMs: number): boolean {
        elapsed += deltaMs

        if (elapsed >= totalDuration) {
          overlaySprite.alpha = 0
          overlaySprite.visible = false
          options.onComplete?.()
          return true
        }

        const pulseTime = elapsed % pulseDuration
        const halfPulse = pulseDuration / 2

        if (pulseTime < halfPulse) {
          const progress = pulseTime / halfPulse
          overlaySprite.alpha = 0.6 * easingFn(progress)
        } else {
          const progress = (pulseTime - halfPulse) / halfPulse
          overlaySprite.alpha = 0.6 * (1 - easingFn(progress))
        }

        return false
      }
    })
  }

  function revealHexes(sprites: AnimatableSprite[], options: RevealHexesOptions): void {
    const easingFn = easings[options.easing]
    const step = Math.max(options.stagger, options.duration)

    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i]!
      const delay = i === 0 ? 0 : options.stagger + (i - 1) * step
      let elapsed = 0

      animations.push({
        update(deltaMs: number): boolean {
          elapsed += deltaMs
          const revealTime = elapsed - delay

          if (revealTime <= 0) {
            sprite.alpha = 0
            return false
          }

          const progress = Math.min(revealTime / options.duration, 1)
          sprite.alpha = easingFn(progress)

          return progress >= 1
        }
      })
    }
  }

  return { movePath, flashHex, revealHexes }
}
