import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { hexToPixel, HEX_SIZE } from '~/utils/hex-map-data'
import type { GameSettlement, SettlementTier } from '../../shared/game-types'

const TIER_VISUALS: Record<SettlementTier, { size: number, color: number, symbol: string }> = {
  outpost: { size: 0.3, color: 0x94a3b8, symbol: '\u25B2' },
  settlement: { size: 0.45, color: 0xfbbf24, symbol: '\u25A0' },
  city: { size: 0.55, color: 0xf59e0b, symbol: '\u2605' }
}

const OWN_BORDER_COLOR = 0x22c55e
const ENEMY_BORDER_COLOR = 0xef4444
const CAPITAL_COLOR = 0xfbbf24
const HP_BAR_BG = 0x374151
const HP_BAR_FILL = 0x22c55e
const HP_BAR_LOW = 0xef4444
const HP_BAR_WIDTH = HEX_SIZE * 0.8
const HP_BAR_HEIGHT = 3

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

function drawSettlementShape(g: Graphics, tier: SettlementTier, isOwn: boolean): void {
  const visual = TIER_VISUALS[tier]
  const radius = HEX_SIZE * visual.size
  const borderColor = isOwn ? OWN_BORDER_COLOR : ENEMY_BORDER_COLOR

  // Draw border/outline
  g.setStrokeStyle({ width: 2, color: borderColor })

  if (tier === 'outpost') {
    // Triangle
    g.beginPath()
    g.moveTo(0, -radius)
    g.lineTo(-radius * 0.866, radius * 0.5)
    g.lineTo(radius * 0.866, radius * 0.5)
    g.closePath()
    g.fill({ color: visual.color })
    g.stroke()
  } else if (tier === 'settlement') {
    // Square
    const half = radius * 0.75
    g.rect(-half, -half, half * 2, half * 2)
    g.fill({ color: visual.color })
    g.stroke()
  } else {
    // Star (5-pointed) for city
    drawStar(g, 0, 0, 5, radius, radius * 0.5, visual.color, borderColor)
  }
}

function drawStar(
  g: Graphics,
  cx: number,
  cy: number,
  points: number,
  outerR: number,
  innerR: number,
  fillColor: number,
  strokeColor: number
): void {
  g.setStrokeStyle({ width: 2, color: strokeColor })
  g.beginPath()

  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / 2 * -1) + (Math.PI / points) * i
    const r = i % 2 === 0 ? outerR : innerR
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r

    if (i === 0) {
      g.moveTo(x, y)
    } else {
      g.lineTo(x, y)
    }
  }

  g.closePath()
  g.fill({ color: fillColor })
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

function drawHpBar(g: Graphics, hp: number, maxHp: number): void {
  const ratio = hp / maxHp
  const fillColor = ratio > 0.5 ? HP_BAR_FILL : HP_BAR_LOW
  const barX = -HP_BAR_WIDTH / 2
  const barY = 0

  // Background
  g.rect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT)
  g.fill({ color: HP_BAR_BG })

  // Fill
  if (ratio > 0) {
    g.rect(barX, barY, HP_BAR_WIDTH * ratio, HP_BAR_HEIGHT)
    g.fill({ color: fillColor })
  }
}

function buildSettlementContainer(
  settlement: GameSettlement,
  currentPlayerId: string
): Container {
  const wrapper = new Container()
  const isOwn = settlement.ownerId === currentPlayerId
  const visual = TIER_VISUALS[settlement.tier]
  const radius = HEX_SIZE * visual.size

  // Settlement shape
  const shapeGraphics = new Graphics()
  drawSettlementShape(shapeGraphics, settlement.tier, isOwn)
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

  // HP bar below shape (only if damaged)
  if (settlement.hp < settlement.maxHp) {
    const hpGraphics = new Graphics()
    drawHpBar(hpGraphics, settlement.hp, settlement.maxHp)
    hpGraphics.position.set(0, radius + 4)
    wrapper.addChild(hpGraphics)
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
