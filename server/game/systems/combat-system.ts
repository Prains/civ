import type { GameState, GameUnit } from '../../../shared/game-types'

export interface CombatEvent {
  attackerId: string
  defenderId: string
  damage: number
  killed: boolean
}

/**
 * Terrain defense modifiers.
 * Terrain values: 0=water, 1=desert, 2=steppe, 3=forest, 4=plains, 5=mountains
 */
const TERRAIN_DEFENSE_MOD: Record<number, number> = {
  0: 1.0, // water
  1: 1.0, // desert
  2: 1.0, // steppe
  3: 1.2, // forest: +20% defense
  4: 1.0, // plains
  5: 1.3 // mountains: +30% defense
}

/**
 * Computes axial hex distance between two tiles.
 * For axial coordinates: distance = max(|dq|, |dr|, |dq + dr|)
 */
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const dq = q2 - q1
  const dr = r2 - r1
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
}

/**
 * Determines whether two units should engage in combat.
 *
 * Returns true if:
 * - Both units have strength > 0, AND
 * - Either (a) one unit is neutral (no diplomacy entry found for the pair),
 *   OR (b) the two owners are at war.
 */
export function shouldFight(unitA: GameUnit, unitB: GameUnit, state: GameState): boolean {
  // Units with 0 strength cannot participate in combat
  if (unitA.strength === 0 || unitB.strength === 0) {
    return false
  }

  // Same owner never fights
  if (unitA.ownerId === unitB.ownerId) {
    return false
  }

  // Check diplomacy: find the entry for these two owners
  const diplo = state.diplomacy.find(
    d =>
      (d.player1Id === unitA.ownerId && d.player2Id === unitB.ownerId)
      || (d.player1Id === unitB.ownerId && d.player2Id === unitA.ownerId)
  )

  // No diplomacy entry means one is neutral -> always fight
  if (!diplo) {
    return true
  }

  return diplo.status === 'war'
}

/**
 * Calculates the damage an attacker deals to a defender.
 *
 * Formula: baseStrength * terrainMod * healthMod * groupMod * randomFactor
 *
 * - baseStrength: attacker's strength value
 * - terrainMod: inverse of defender's terrain defense bonus (defender on forest = attacker deals less)
 * - healthMod: attacker's current HP / maxHP
 * - groupMod: 1.0 + (0.1 * number of attacker's allies within 2 tiles)
 * - randomFactor: value in [0.8, 1.2] range (injectable for testing)
 *
 * Returns at least 1 damage if attacker has any strength.
 */
export function calculateDamage(
  attacker: GameUnit,
  defender: GameUnit,
  state: GameState,
  randomFn: () => number = () => 0.8 + Math.random() * 0.4
): number {
  const baseStrength = attacker.strength

  // Terrain modifier: look up defender's tile
  const tileIndex = defender.r * state.mapWidth + defender.q
  const terrainValue = tileIndex >= 0 && tileIndex < state.terrain.length
    ? state.terrain[tileIndex]!
    : 4 // default to plains
  const terrainDefense = TERRAIN_DEFENSE_MOD[terrainValue] ?? 1.0
  const terrainMod = 1.0 / terrainDefense

  // Health modifier: attacker's current HP ratio
  const healthMod = attacker.hp / attacker.maxHp

  // Group modifier: count attacker's allies within 2 tiles
  const allUnits = getAllUnits(state)
  let allyCount = 0
  for (const unit of allUnits) {
    if (unit.id === attacker.id) continue
    if (unit.ownerId !== attacker.ownerId) continue
    if (hexDistance(attacker.q, attacker.r, unit.q, unit.r) <= 2) {
      allyCount++
    }
  }
  const groupMod = 1.0 + (0.1 * allyCount)

  // Random factor
  const randomFactor = randomFn()

  const rawDamage = baseStrength * terrainMod * healthMod * groupMod * randomFactor

  // Minimum 1 damage if attacker has any strength
  return Math.max(1, rawDamage)
}

/**
 * Returns an iterable of all game units (player-owned + neutral).
 */
function getAllUnits(state: GameState): GameUnit[] {
  const all: GameUnit[] = []
  for (const unit of state.units.values()) {
    all.push(unit)
  }
  for (const unit of state.neutralUnits.values()) {
    all.push(unit)
  }
  return all
}

/**
 * Processes one tick of combat. For every pair of adjacent enemy units
 * that should fight, resolves bidirectional combat and returns events.
 *
 * Dead units (HP <= 0) are removed from the state after all combats resolve.
 *
 * @param state - The mutable game state
 * @param randomFn - Optional deterministic random function for testing (returns value in [0.8, 1.2])
 */
export function tickCombat(
  state: GameState,
  randomFn: () => number = () => 0.8 + Math.random() * 0.4
): CombatEvent[] {
  const events: CombatEvent[] = []
  const processedPairs = new Set<string>()

  const allUnits = getAllUnits(state)

  for (const unit of allUnits) {
    for (const other of allUnits) {
      if (unit.id === other.id) continue
      if (unit.ownerId === other.ownerId) continue

      // Check adjacency (hex neighbors: distance <= 1)
      const dist = hexDistance(unit.q, unit.r, other.q, other.r)
      if (dist > 1) continue

      // Avoid processing same pair twice
      const pairKey = [unit.id, other.id].sort().join(':')
      if (processedPairs.has(pairKey)) continue
      processedPairs.add(pairKey)

      // Check if combat should happen
      if (!shouldFight(unit, other, state)) continue

      // Resolve combat both ways
      const attackDamage = calculateDamage(unit, other, state, randomFn)
      const defenseDamage = calculateDamage(other, unit, state, randomFn)

      other.hp -= attackDamage
      unit.hp -= defenseDamage

      events.push({
        attackerId: unit.id,
        defenderId: other.id,
        damage: attackDamage,
        killed: other.hp <= 0
      })
      events.push({
        attackerId: other.id,
        defenderId: unit.id,
        damage: defenseDamage,
        killed: unit.hp <= 0
      })
    }
  }

  // Remove dead units from player units
  for (const [id, unit] of state.units) {
    if (unit.hp <= 0) state.units.delete(id)
  }

  // Remove dead units from neutral units
  for (const [id, unit] of state.neutralUnits) {
    if (unit.hp <= 0) state.neutralUnits.delete(id)
  }

  return events
}
