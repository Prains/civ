import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { hexToPixel, HEX_SIZE } from '~/utils/hex-map-data'
import type { GameUnit, UnitType } from '../../shared/game-types'

// Unit type -> color and shape (simple geometric representations)
const UNIT_VISUALS: Record<UnitType, { color: number, symbol: string }> = {
  scout: { color: 0x60a5fa, symbol: 'S' },
  gatherer: { color: 0x4ade80, symbol: 'G' },
  warrior: { color: 0xef4444, symbol: 'W' },
  settler: { color: 0xf59e0b, symbol: 'E' },
  builder: { color: 0x8b5cf6, symbol: 'B' }
}

// Player colors for faction tinting
const PLAYER_COLORS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xec4899] as const

export interface UnitSprite {
  container: Container
  unitId: string
  q: number
  r: number
}

export interface UnitRenderer {
  container: Container
  update(units: GameUnit[], currentPlayerId: string): void
  destroy(): void
}

function createUnitGraphic(unit: GameUnit): Container {
  const c = new Container()
  const visual = UNIT_VISUALS[unit.type]

  // Circle background
  const g = new Graphics()
  g.circle(0, 0, HEX_SIZE * 0.35)
  g.fill({ color: visual.color, alpha: 0.9 })
  g.stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
  c.addChild(g)

  // Unit type letter
  const text = new Text({
    text: visual.symbol,
    style: new TextStyle({
      fontSize: HEX_SIZE * 0.4,
      fontWeight: 'bold',
      fill: 0xffffff
    })
  })
  text.anchor.set(0.5)
  c.addChild(text)

  // HP bar below
  const hpBar = new Graphics()
  const hpRatio = unit.hp / unit.maxHp
  const barWidth = HEX_SIZE * 0.6
  hpBar.rect(-barWidth / 2, HEX_SIZE * 0.4, barWidth, 3)
  hpBar.fill({ color: 0x374151 })
  hpBar.rect(-barWidth / 2, HEX_SIZE * 0.4, barWidth * hpRatio, 3)
  hpBar.fill({ color: hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.25 ? 0xf59e0b : 0xef4444 })
  c.addChild(hpBar)

  return c
}

export function createUnitRenderer(): UnitRenderer {
  const container = new Container({ sortableChildren: true })
  const activeUnits = new Map<string, UnitSprite>()
  const pool: Container[] = []

  function update(units: GameUnit[], currentPlayerId: string) {
    // Track which units are still present
    const presentIds = new Set(units.map(u => u.id))

    // Remove units that are gone
    for (const [id, sprite] of activeUnits) {
      if (!presentIds.has(id)) {
        sprite.container.visible = false
        pool.push(sprite.container)
        activeUnits.delete(id)
      }
    }

    // Add/update units
    for (const unit of units) {
      const pos = hexToPixel(unit.q, unit.r)
      let entry = activeUnits.get(unit.id)

      if (!entry) {
        // Create new sprite
        const graphic = createUnitGraphic(unit)
        container.addChild(graphic)
        entry = { container: graphic, unitId: unit.id, q: unit.q, r: unit.r }
        activeUnits.set(unit.id, entry)
      }

      // Update position
      entry.container.x = pos.x
      entry.container.y = pos.y
      entry.container.visible = true
      entry.q = unit.q
      entry.r = unit.r

      // Dim for enemy units
      entry.container.alpha = unit.ownerId === currentPlayerId ? 1.0 : 0.85
    }
  }

  function destroy() {
    for (const entry of activeUnits.values()) {
      entry.container.destroy()
    }
    for (const c of pool) {
      c.destroy()
    }
    container.destroy()
  }

  return { container, update, destroy }
}

export { UNIT_VISUALS, PLAYER_COLORS }
