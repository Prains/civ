import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { hexToPixel, HEX_SIZE } from '~/utils/hex-map-data'
import type { GameSettlement } from '../../shared/game-types'

const OWN_BORDER_COLOR = 0x22c55e
const ENEMY_BORDER_COLOR = 0xef4444
const SETTLEMENT_COLOR = 0xfbbf24
const CAPITAL_COLOR = 0xfbbf24
const SETTLEMENT_SIZE = 0.35

export interface SettlementSprite {
  container: Container
  settlementId: string
  q: number
  r: number
}

export interface SettlementRenderer {
  container: Container
  update(settlements: GameSettlement[], currentPlayerId: string): void
  destroy(): void
}

function drawSettlementShape(g: Graphics, isOwn: boolean): void {
  const radius = HEX_SIZE * SETTLEMENT_SIZE
  const borderColor = isOwn ? OWN_BORDER_COLOR : ENEMY_BORDER_COLOR

  g.setStrokeStyle({ width: 2, color: borderColor })

  // Simple circle for all settlements
  g.circle(0, 0, radius)
  g.fill({ color: SETTLEMENT_COLOR })
  g.stroke()
}

function createNameLabel(name: string): Text {
  const style = new TextStyle({
    fontSize: 9,
    fontFamily: 'Arial',
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 2 },
    align: 'center'
  })
  const text = new Text({ text: name, style })
  text.anchor.set(0.5, 1)
  return text
}

function createCapitalIndicator(): Text {
  const style = new TextStyle({
    fontSize: 10,
    fontFamily: 'Arial',
    fill: CAPITAL_COLOR,
    stroke: { color: 0x000000, width: 2 }
  })
  const text = new Text({ text: '\u265A', style })
  text.anchor.set(0.5, 1)
  return text
}

function buildSettlementContainer(
  settlement: GameSettlement,
  currentPlayerId: string
): Container {
  const wrapper = new Container()
  const isOwn = settlement.ownerId === currentPlayerId
  const radius = HEX_SIZE * SETTLEMENT_SIZE

  // Settlement shape
  const shapeGraphics = new Graphics()
  drawSettlementShape(shapeGraphics, isOwn)
  wrapper.addChild(shapeGraphics)

  // Name label above
  const nameLabel = createNameLabel(settlement.name)
  const labelOffsetY = -(radius + 4)
  nameLabel.position.set(0, settlement.isCapital ? labelOffsetY - 12 : labelOffsetY)
  wrapper.addChild(nameLabel)

  // Capital indicator (crown) between name and shape
  if (settlement.isCapital) {
    const crown = createCapitalIndicator()
    crown.position.set(0, labelOffsetY)
    wrapper.addChild(crown)
  }

  // Position on hex grid
  const pos = hexToPixel(settlement.q, settlement.r)
  wrapper.position.set(pos.x, pos.y)
  wrapper.zIndex = settlement.r * 1000 + 800

  return wrapper
}

export function createSettlementRenderer(): SettlementRenderer {
  const container = new Container({ sortableChildren: true })
  const activeSprites = new Map<string, SettlementSprite>()

  function update(settlements: GameSettlement[], currentPlayerId: string): void {
    const incomingIds = new Set<string>()

    for (const settlement of settlements) {
      incomingIds.add(settlement.id)

      const existing = activeSprites.get(settlement.id)

      if (existing && existing.q === settlement.q && existing.r === settlement.r) {
        // Same position — rebuild in place to reflect any state changes
        container.removeChild(existing.container)
        existing.container.destroy({ children: true })
      } else if (existing) {
        // Position changed — remove old
        container.removeChild(existing.container)
        existing.container.destroy({ children: true })
        activeSprites.delete(settlement.id)
      }

      const wrapper = buildSettlementContainer(settlement, currentPlayerId)
      container.addChild(wrapper)
      activeSprites.set(settlement.id, {
        container: wrapper,
        settlementId: settlement.id,
        q: settlement.q,
        r: settlement.r
      })
    }

    // Remove settlements no longer present
    for (const [id, sprite] of activeSprites) {
      if (!incomingIds.has(id)) {
        container.removeChild(sprite.container)
        sprite.container.destroy({ children: true })
        activeSprites.delete(id)
      }
    }
  }

  function destroy(): void {
    activeSprites.clear()
    container.destroy({ children: true })
  }

  return {
    container,
    update,
    destroy
  }
}
