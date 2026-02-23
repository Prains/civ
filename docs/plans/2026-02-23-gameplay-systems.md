# Gameplay Systems Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the full gameplay loop — factions, resources, settlements, autonomous units, tech tree, council/laws, combat, fog of war, and victory conditions — on top of the existing multiplayer skeleton.

**Architecture:** Server-authoritative real-time game with tick-based simulation (~500ms ticks). All game logic runs on the server; clients receive filtered state via SSE. Game state stored in-memory during play (SQLite for persistence/save). Shared TypeScript type definitions between server and client.

**Tech Stack:** Nuxt 4, oRPC, Prisma/SQLite, PixiJS, SSE (EventPublisher), Vitest, Zod

**Design doc:** `docs/plans/2026-02-23-gameplay-systems-design.md`

---

## Phase 1: Game State Foundation

### Task 1: Shared game type definitions

Define all shared types used by both server and client. These are the data contracts for the entire game.

**Files:**
- Create: `shared/game-types.ts`

**Step 1: Write tests for type validation helpers**

```typescript
// test/unit/game-types.test.ts
import { describe, expect, it } from 'vitest'
import { isValidFactionId, isValidUnitType, isValidResourceType, FACTION_IDS, UNIT_TYPES, RESOURCE_TYPES } from '../../shared/game-types'

describe('game-types', () => {
  it('validates faction IDs', () => {
    expect(isValidFactionId('solar_empire')).toBe(true)
    expect(isValidFactionId('merchant_league')).toBe(true)
    expect(isValidFactionId('invalid')).toBe(false)
  })

  it('exports all 4 faction IDs', () => {
    expect(FACTION_IDS).toHaveLength(4)
  })

  it('exports all 5 resource types', () => {
    expect(RESOURCE_TYPES).toHaveLength(5)
  })

  it('validates unit types', () => {
    expect(isValidUnitType('scout')).toBe(true)
    expect(isValidUnitType('warrior')).toBe(true)
    expect(isValidUnitType('dragon')).toBe(false)
  })
})
```

Run: `bunx vitest test/unit/game-types.test.ts --run`
Expected: FAIL (module not found)

**Step 2: Implement shared types**

```typescript
// shared/game-types.ts

// --- Factions ---
export const FACTION_IDS = ['solar_empire', 'merchant_league', 'forest_keepers', 'seekers'] as const
export type FactionId = typeof FACTION_IDS[number]
export function isValidFactionId(id: string): id is FactionId {
  return (FACTION_IDS as readonly string[]).includes(id)
}

// --- Resources ---
export const RESOURCE_TYPES = ['food', 'production', 'gold', 'science', 'culture'] as const
export type ResourceType = typeof RESOURCE_TYPES[number]
export function isValidResourceType(r: string): r is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(r)
}
export type Resources = Record<ResourceType, number>

// --- Units ---
export const UNIT_TYPES = ['scout', 'gatherer', 'warrior', 'settler', 'builder'] as const
export type UnitType = typeof UNIT_TYPES[number]
export function isValidUnitType(t: string): t is UnitType {
  return (UNIT_TYPES as readonly string[]).includes(t)
}

// --- Settlement ---
export const SETTLEMENT_TIERS = ['outpost', 'settlement', 'city'] as const
export type SettlementTier = typeof SETTLEMENT_TIERS[number]

// --- Diplomacy ---
export const DIPLOMATIC_STATUSES = ['peace', 'tension', 'war'] as const
export type DiplomaticStatus = typeof DIPLOMATIC_STATUSES[number]

// --- Combat policies ---
export const COMBAT_POLICIES = ['aggressive', 'defensive', 'avoidance'] as const
export type CombatPolicy = typeof COMBAT_POLICIES[number]

// --- Player policies (sliders 0–100) ---
export interface PlayerPolicies {
  aggression: number     // 0 = full defense, 100 = full aggression
  expansion: number      // 0 = consolidation, 100 = expansion
  spending: number       // 0 = accumulate, 100 = spend freely
  combatPolicy: CombatPolicy
}

// --- Advisor types ---
export const ADVISOR_TYPES = ['general', 'treasurer', 'priest', 'scholar', 'tribune'] as const
export type AdvisorType = typeof ADVISOR_TYPES[number]

// --- Fog of war tile states ---
export const FOG_STATES = ['unexplored', 'explored', 'visible'] as const
export type FogState = typeof FOG_STATES[number]

// --- Hex coordinate ---
export interface HexCoord {
  q: number
  r: number
}

// --- Game speed ---
export const GAME_SPEEDS = [0.5, 1, 2, 3] as const
export type GameSpeed = typeof GAME_SPEEDS[number]

// --- Unit state (server-side, full) ---
export interface GameUnit {
  id: string
  type: UnitType
  ownerId: string
  q: number
  r: number
  hp: number
  maxHp: number
  hunger: number       // 0–100
  safety: number       // 0–100
  strength: number
  visionRange: number
  moveSpeed: number    // tiles per tick
  state: 'idle' | 'moving' | 'gathering' | 'building' | 'fighting' | 'returning'
  targetQ?: number
  targetR?: number
  carryingResource?: ResourceType
  carryingAmount?: number
}

// --- Settlement state ---
export interface GameSettlement {
  id: string
  ownerId: string
  name: string
  tier: SettlementTier
  q: number
  r: number
  buildings: BuildingType[]
  buildingSlots: number
  gatherRadius: number
  isCapital: boolean
  hp: number
  maxHp: number
  defense: number
}

// --- Buildings ---
export const BUILDING_TYPES = ['farm', 'lumber_mill', 'market', 'library', 'temple', 'barracks', 'walls'] as const
export type BuildingType = typeof BUILDING_TYPES[number]

// --- Tile improvement ---
export const IMPROVEMENT_TYPES = ['road', 'farm_improvement', 'mine'] as const
export type ImprovementType = typeof IMPROVEMENT_TYPES[number]

// --- Technology ---
export interface TechNode {
  id: string
  name: string
  epoch: number
  scienceCost: number
  requires: string[]       // tech IDs that must be researched first
  factionOnly?: FactionId  // if set, only this faction can research it
  effects: TechEffect[]
}

export interface TechEffect {
  type: 'unlock_building' | 'unlock_unit' | 'modifier' | 'unlock_improvement' | 'victory_progress'
  target?: string
  value?: number
}

// --- Law ---
export interface LawNode {
  id: string
  name: string
  branch: 'economy' | 'military' | 'society' | 'diplomacy' | 'faction_unique'
  cultureCost: number
  requires: string[]        // law IDs that must be passed first
  factionOnly?: FactionId
  effects: LawEffect[]
  targetPlayer?: boolean    // true if law targets a specific player (e.g., declare war)
}

export interface LawEffect {
  type: 'resource_modifier' | 'unit_modifier' | 'settlement_modifier' | 'diplomacy_change' | 'loyalty_change' | 'special'
  target?: string
  value?: number
  description: string
}

// --- Advisor ---
export interface Advisor {
  type: AdvisorType
  loyalty: number  // 0–100
}

// --- Player game state ---
export interface GamePlayer {
  userId: string
  factionId: FactionId
  resources: Resources
  resourceIncome: Resources   // per-tick income
  resourceUpkeep: Resources   // per-tick costs
  policies: PlayerPolicies
  advisors: Advisor[]
  researchedTechs: string[]
  currentResearch: string | null
  researchProgress: number    // accumulated science toward current tech
  passedLaws: string[]
  eliminated: boolean
  fogMap: Uint8Array          // per-tile fog state (0=unexplored, 1=explored, 2=visible)
}

// --- Diplomacy between two players ---
export interface DiplomacyState {
  player1Id: string
  player2Id: string
  status: DiplomaticStatus
}

// --- Full game state (server-side) ---
export interface GameState {
  gameId: string
  tick: number
  speed: GameSpeed
  paused: boolean
  mapWidth: number
  mapHeight: number
  terrain: Uint8Array
  elevation: Uint8Array
  improvements: Map<string, ImprovementType>  // "q,r" -> type
  players: Map<string, GamePlayer>
  units: Map<string, GameUnit>
  settlements: Map<string, GameSettlement>
  diplomacy: DiplomacyState[]
  neutralUnits: Map<string, GameUnit>          // animals, barbarians
  barbarianCamps: HexCoord[]
}

// --- Events sent to client via SSE ---
export type GameEvent =
  | { type: 'tick'; tick: number; playerState: ClientPlayerState }
  | { type: 'unitMoved'; unitId: string; fromQ: number; fromR: number; toQ: number; toR: number }
  | { type: 'combatResult'; attackerId: string; defenderId: string; damage: number; killed: boolean }
  | { type: 'settlementFounded'; settlement: GameSettlement }
  | { type: 'buildingCompleted'; settlementId: string; building: BuildingType }
  | { type: 'techResearched'; techId: string; playerId: string }
  | { type: 'lawPassed'; lawId: string; playerId: string }
  | { type: 'lawRejected'; lawId: string; playerId: string; votes: AdvisorVote[] }
  | { type: 'warDeclared'; attackerId: string; defenderId: string }
  | { type: 'peaceDeclared'; player1Id: string; player2Id: string }
  | { type: 'playerEliminated'; playerId: string }
  | { type: 'victory'; winnerId: string; victoryType: string }
  | { type: 'paused'; byPlayerId: string }
  | { type: 'resumed' }
  | { type: 'mapReady'; mapData: { width: number; height: number; terrain: number[]; elevation: number[] } }

export interface AdvisorVote {
  advisor: AdvisorType
  vote: 'yes' | 'no'
  reason: string
}

// --- Client-side view (filtered by fog) ---
export interface ClientPlayerState {
  tick: number
  resources: Resources
  resourceIncome: Resources
  resourceUpkeep: Resources
  policies: PlayerPolicies
  advisors: Advisor[]
  currentResearch: string | null
  researchProgress: number
  researchedTechs: string[]
  passedLaws: string[]
  visibleUnits: GameUnit[]         // own + visible enemy units
  visibleSettlements: GameSettlement[]
  fogMap: number[]                 // flattened Uint8Array
  diplomacy: DiplomacyState[]
}
```

Run: `bunx vitest test/unit/game-types.test.ts --run`
Expected: PASS

**Step 3: Commit**

```bash
git add shared/game-types.ts test/unit/game-types.test.ts
git commit -m "feat: add shared game type definitions"
```

---

### Task 2: Faction definitions data

Static data defining the 4 factions — modifiers, starting values, unique units/buildings.

**Files:**
- Create: `shared/faction-defs.ts`
- Test: `test/unit/faction-defs.test.ts`

**Step 1: Write tests**

```typescript
// test/unit/faction-defs.test.ts
import { describe, expect, it } from 'vitest'
import { FACTIONS, getFaction } from '../../shared/faction-defs'
import { FACTION_IDS } from '../../shared/game-types'

describe('faction-defs', () => {
  it('defines all 4 factions', () => {
    expect(Object.keys(FACTIONS)).toHaveLength(4)
    for (const id of FACTION_IDS) {
      expect(FACTIONS[id]).toBeDefined()
    }
  })

  it('each faction has required fields', () => {
    for (const faction of Object.values(FACTIONS)) {
      expect(faction.name).toBeTruthy()
      expect(faction.resourceModifiers).toBeDefined()
      expect(faction.aiModifiers).toBeDefined()
      expect(faction.uniqueUnitType).toBeTruthy()
      expect(faction.uniqueBuildingType).toBeTruthy()
      expect(faction.startingAdvisorLoyalty).toBeDefined()
    }
  })

  it('getFaction returns correct faction', () => {
    const solar = getFaction('solar_empire')
    expect(solar.name).toBe('Solar Empire')
    expect(solar.resourceModifiers.production).toBe(1.2)
  })

  it('Solar Empire has production bonus and science penalty', () => {
    const f = getFaction('solar_empire')
    expect(f.resourceModifiers.production).toBeGreaterThan(1)
    expect(f.resourceModifiers.science).toBeLessThan(1)
  })

  it('Merchant League has gold bonus and combat penalty', () => {
    const f = getFaction('merchant_league')
    expect(f.resourceModifiers.gold).toBeGreaterThan(1)
    expect(f.combatStrengthModifier).toBeLessThan(1)
  })
})
```

**Step 2: Implement faction definitions**

```typescript
// shared/faction-defs.ts
import type { FactionId, Resources, AdvisorType } from './game-types'

export interface FactionDef {
  id: FactionId
  name: string
  description: string
  resourceModifiers: Resources          // multipliers (1.0 = no change)
  combatStrengthModifier: number        // 1.0 = normal
  aiModifiers: {
    territoriality: number              // multiplier on default
    aggression: number
    greed: number
    curiosity: number
    safety: number
  }
  uniqueUnitType: string
  uniqueBuildingType: string
  startingAdvisorLoyalty: Record<AdvisorType, number>
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  solar_empire: {
    id: 'solar_empire',
    name: 'Solar Empire',
    description: 'Expansion and conquest. More territory = more power.',
    resourceModifiers: { food: 1, production: 1.2, gold: 1, science: 0.9, culture: 1 },
    combatStrengthModifier: 1,
    aiModifiers: { territoriality: 1.5, aggression: 1.3, greed: 1, curiosity: 1, safety: 1 },
    uniqueUnitType: 'legionnaire',
    uniqueBuildingType: 'fort',
    startingAdvisorLoyalty: { general: 70, treasurer: 50, priest: 40, scholar: 40, tribune: 50 }
  },
  merchant_league: {
    id: 'merchant_league',
    name: 'Merchant League',
    description: 'Gold solves everything. Trade and diplomacy.',
    resourceModifiers: { food: 1, production: 1, gold: 1.3, science: 1, culture: 1 },
    combatStrengthModifier: 0.85,
    aiModifiers: { territoriality: 0.8, aggression: 0.7, greed: 1.5, curiosity: 1, safety: 1.3 },
    uniqueUnitType: 'caravan',
    uniqueBuildingType: 'grand_market',
    startingAdvisorLoyalty: { general: 40, treasurer: 70, priest: 50, scholar: 50, tribune: 50 }
  },
  forest_keepers: {
    id: 'forest_keepers',
    name: 'Forest Keepers',
    description: 'Quality over quantity. Deep development, not wide.',
    resourceModifiers: { food: 1, production: 1, gold: 1, science: 1, culture: 1.2 },
    combatStrengthModifier: 1,
    aiModifiers: { territoriality: 0.6, aggression: 0.8, greed: 1, curiosity: 1, safety: 0.7 },
    uniqueUnitType: 'ranger',
    uniqueBuildingType: 'sacred_grove',
    startingAdvisorLoyalty: { general: 40, treasurer: 50, priest: 70, scholar: 50, tribune: 50 }
  },
  seekers: {
    id: 'seekers',
    name: 'The Seekers',
    description: 'Science and progress. Technological superiority.',
    resourceModifiers: { food: 1, production: 0.85, gold: 1, science: 1.3, culture: 1 },
    combatStrengthModifier: 1,
    aiModifiers: { territoriality: 0.8, aggression: 0.5, greed: 1, curiosity: 2.0, safety: 1 },
    uniqueUnitType: 'scholar_unit',
    uniqueBuildingType: 'academy',
    startingAdvisorLoyalty: { general: 40, treasurer: 50, priest: 40, scholar: 70, tribune: 50 }
  }
}

export function getFaction(id: FactionId): FactionDef {
  return FACTIONS[id]
}
```

**Step 3: Run tests, commit**

Run: `bunx vitest test/unit/faction-defs.test.ts --run`

```bash
git add shared/faction-defs.ts test/unit/faction-defs.test.ts
git commit -m "feat: add faction definitions with modifiers and starting values"
```

---

### Task 3: Technology tree data

Static data for the tech tree — common core (3 epochs) + faction unique branches.

**Files:**
- Create: `shared/tech-tree.ts`
- Test: `test/unit/tech-tree.test.ts`

**Step 1: Write tests**

```typescript
// test/unit/tech-tree.test.ts
import { describe, expect, it } from 'vitest'
import { TECH_TREE, getTech, getAvailableTechs, getEpochTechs } from '../../shared/tech-tree'

describe('tech-tree', () => {
  it('has 12 common techs (4 per epoch)', () => {
    const common = Object.values(TECH_TREE).filter(t => !t.factionOnly)
    expect(common).toHaveLength(12)
  })

  it('has 4 techs per faction branch', () => {
    for (const factionId of ['solar_empire', 'merchant_league', 'forest_keepers', 'seekers']) {
      const factionTechs = Object.values(TECH_TREE).filter(t => t.factionOnly === factionId)
      expect(factionTechs).toHaveLength(4)
    }
  })

  it('epoch 1 techs have no common prerequisites', () => {
    const epoch1 = getEpochTechs(1)
    for (const tech of epoch1) {
      expect(tech.requires).toHaveLength(0)
    }
  })

  it('getAvailableTechs returns epoch 1 techs when nothing researched', () => {
    const available = getAvailableTechs([], 'solar_empire')
    const ids = available.map(t => t.id)
    expect(ids).toContain('agriculture')
    expect(ids).toContain('mining')
    expect(ids).not.toContain('trade')  // epoch 2
  })

  it('getAvailableTechs excludes already researched', () => {
    const available = getAvailableTechs(['agriculture'], 'solar_empire')
    expect(available.find(t => t.id === 'agriculture')).toBeUndefined()
  })

  it('epoch 2 unlocks after 3 epoch-1 techs', () => {
    const researched = ['agriculture', 'mining', 'scouting']
    const available = getAvailableTechs(researched, 'solar_empire')
    const ids = available.map(t => t.id)
    expect(ids).toContain('trade')      // epoch 2
    expect(ids).toContain('military')   // epoch 2
  })

  it('faction techs not available to other factions', () => {
    const available = getAvailableTechs([], 'merchant_league')
    expect(available.find(t => t.id === 'phalanx_formation')).toBeUndefined()
  })
})
```

**Step 2: Implement tech tree**

Create `shared/tech-tree.ts` with all tech nodes. Each epoch-2 tech requires `_epoch_1_gate` (3 epoch-1 techs researched). Faction branches start available alongside epoch 1.

Key structure:
- `TECH_TREE: Record<string, TechNode>` — flat map of all techs
- `getTech(id)` — lookup
- `getAvailableTechs(researched[], factionId)` — returns techs the player can research next
- `getEpochTechs(epoch)` — returns all techs in an epoch

**Step 3: Run tests, commit**

```bash
git add shared/tech-tree.ts test/unit/tech-tree.test.ts
git commit -m "feat: add technology tree with 3 epochs and faction branches"
```

---

### Task 4: Law tree data

Static data for laws — common branches + faction unique laws.

**Files:**
- Create: `shared/law-tree.ts`
- Test: `test/unit/law-tree.test.ts`

**Step 1: Write tests**

```typescript
// test/unit/law-tree.test.ts
import { describe, expect, it } from 'vitest'
import { LAW_TREE, getAvailableLaws } from '../../shared/law-tree'

describe('law-tree', () => {
  it('has common laws in 4 branches', () => {
    const common = Object.values(LAW_TREE).filter(l => !l.factionOnly)
    const branches = new Set(common.map(l => l.branch))
    expect(branches.size).toBe(4) // economy, military, society, diplomacy
  })

  it('each faction has 3 unique laws', () => {
    for (const fid of ['solar_empire', 'merchant_league', 'forest_keepers', 'seekers']) {
      const laws = Object.values(LAW_TREE).filter(l => l.factionOnly === fid)
      expect(laws).toHaveLength(3)
    }
  })

  it('getAvailableLaws returns root laws when nothing passed', () => {
    const available = getAvailableLaws([], 'solar_empire')
    const ids = available.map(l => l.id)
    expect(ids).toContain('taxation')
    expect(ids).toContain('mobilization')
    expect(ids).not.toContain('free_trade')  // requires taxation
  })

  it('diplomacy laws (declare_war) are always available', () => {
    const available = getAvailableLaws([], 'solar_empire')
    expect(available.find(l => l.id === 'declare_war')).toBeDefined()
  })
})
```

**Step 2: Implement law tree**

Create `shared/law-tree.ts` with all law definitions mirroring the design doc.

**Step 3: Run tests, commit**

```bash
git add shared/law-tree.ts test/unit/law-tree.test.ts
git commit -m "feat: add law tree with common and faction-unique branches"
```

---

### Task 5: Building and unit cost definitions

Static data for building costs/effects, unit costs/stats, settlement tier definitions.

**Files:**
- Create: `shared/building-defs.ts`
- Create: `shared/unit-defs.ts`
- Create: `shared/settlement-defs.ts`
- Test: `test/unit/building-defs.test.ts`
- Test: `test/unit/unit-defs.test.ts`

**Step 1: Write tests**

Test that all building types have costs and effects, all unit types have stats, and settlement tiers are defined correctly.

**Step 2: Implement definitions**

Each file exports a `Record<Type, Definition>` with all static game data. Refer to design doc Section 3 (units), 5 (settlements/buildings) for exact values.

**Step 3: Run tests, commit**

```bash
git add shared/building-defs.ts shared/unit-defs.ts shared/settlement-defs.ts test/unit/building-defs.test.ts test/unit/unit-defs.test.ts
git commit -m "feat: add building, unit, and settlement definitions"
```

---

## Phase 2: Game Engine Core

### Task 6: Game state manager

The core server-side class that holds and manages the game state in memory.

**Files:**
- Create: `server/game/game-state.ts`
- Test: `test/unit/game-state.test.ts`

**Step 1: Write tests**

```typescript
// test/unit/game-state.test.ts
import { describe, expect, it } from 'vitest'
import { GameStateManager } from '../../server/game/game-state'

describe('GameStateManager', () => {
  it('initializes with map data and players', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4), // all plains
      elevation: new Uint8Array(400).fill(128),
      players: [
        { userId: 'p1', factionId: 'solar_empire' },
        { userId: 'p2', factionId: 'merchant_league' }
      ],
      speed: 1
    })

    expect(manager.state.tick).toBe(0)
    expect(manager.state.players.size).toBe(2)
    expect(manager.state.paused).toBe(false)
  })

  it('creates starting units and settlement for each player', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 50,
      mapHeight: 50,
      terrain: new Uint8Array(2500).fill(4),
      elevation: new Uint8Array(2500).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const p1Units = [...manager.state.units.values()].filter(u => u.ownerId === 'p1')
    expect(p1Units).toHaveLength(4) // 2 scouts + 1 gatherer + 1 builder

    const p1Settlements = [...manager.state.settlements.values()].filter(s => s.ownerId === 'p1')
    expect(p1Settlements).toHaveLength(1)
    expect(p1Settlements[0].isCapital).toBe(true)
  })

  it('initializes player resources', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4),
      elevation: new Uint8Array(400).fill(128),
      players: [{ userId: 'p1', factionId: 'solar_empire' }],
      speed: 1
    })

    const player = manager.state.players.get('p1')!
    expect(player.resources.food).toBeGreaterThan(0)
    expect(player.resources.gold).toBeGreaterThan(0)
    expect(player.advisors).toHaveLength(5)
  })

  it('getPlayerView filters by fog of war', () => {
    const manager = GameStateManager.create({
      gameId: 'test-game',
      mapWidth: 20,
      mapHeight: 20,
      terrain: new Uint8Array(400).fill(4),
      elevation: new Uint8Array(400).fill(128),
      players: [
        { userId: 'p1', factionId: 'solar_empire' },
        { userId: 'p2', factionId: 'merchant_league' }
      ],
      speed: 1
    })

    const p1View = manager.getPlayerView('p1')
    // Should see own units but not necessarily all of p2's units
    const ownUnits = p1View.visibleUnits.filter(u => u.ownerId === 'p1')
    expect(ownUnits.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Implement GameStateManager**

`GameStateManager` class with:
- `create(config)` — static factory. Places players on map, creates starting units/settlements, initializes fog.
- `state: GameState` — the full game state
- `getPlayerView(userId): ClientPlayerState` — returns fog-filtered view for a player
- `findSpawnPosition(existingPositions)` — finds valid land tile far from others

**Step 3: Run tests, commit**

```bash
git add server/game/game-state.ts test/unit/game-state.test.ts
git commit -m "feat: add GameStateManager with initialization and player view"
```

---

### Task 7: Resource tick system

Per-tick resource calculation: income from buildings, upkeep from units/buildings, faction modifiers, crisis effects.

**Files:**
- Create: `server/game/systems/resource-system.ts`
- Test: `test/unit/resource-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Base income from settlement buildings (farm → +3 food)
- Unit upkeep (warrior costs more food than scout)
- Faction modifier applied (Solar Empire +20% production)
- Net resources updated correctly
- Economic crisis: food < 0 → units lose speed
- Economic crisis: gold < 0 → can't buy units

**Step 2: Implement ResourceSystem**

```typescript
// server/game/systems/resource-system.ts
export function tickResources(state: GameState): void {
  for (const [playerId, player] of state.players) {
    if (player.eliminated) continue
    const faction = getFaction(player.factionId)

    // Calculate income from settlements/buildings
    const income = calculateIncome(playerId, state, faction)
    // Calculate upkeep from units and buildings
    const upkeep = calculateUpkeep(playerId, state)

    // Apply to player
    player.resourceIncome = income
    player.resourceUpkeep = upkeep
    for (const res of RESOURCE_TYPES) {
      player.resources[res] += (income[res] - upkeep[res])
    }

    // Apply crisis effects
    applyCrisisEffects(player, state)
  }
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/systems/resource-system.ts test/unit/resource-system.test.ts
git commit -m "feat: add per-tick resource system with income, upkeep, and crisis"
```

---

### Task 8: Fog of war system

Vision calculation based on unit positions and settlement radii.

**Files:**
- Create: `server/game/systems/fog-system.ts`
- Test: `test/unit/fog-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Unit at (5,5) with vision 2 reveals surrounding tiles
- Settlement at (10,10) with gather radius 3 grants permanent vision
- Tiles outside all vision ranges stay at previous state (explored stays explored, unexplored stays unexplored)
- Scout has vision 4, warrior has vision 2
- Forest Keepers ranger invisible in forest tiles

**Step 2: Implement FogSystem**

```typescript
// server/game/systems/fog-system.ts
export function tickFog(state: GameState): void {
  for (const [playerId, player] of state.players) {
    if (player.eliminated) continue
    // Reset all "visible" to "explored" (keep explored, keep unexplored)
    resetVisibility(player.fogMap, state.mapWidth, state.mapHeight)
    // Mark tiles visible from units
    for (const unit of state.units.values()) {
      if (unit.ownerId === playerId) {
        revealTiles(player.fogMap, unit.q, unit.r, unit.visionRange, state.mapWidth, state.mapHeight)
      }
    }
    // Mark tiles visible from settlements
    for (const settlement of state.settlements.values()) {
      if (settlement.ownerId === playerId) {
        revealTiles(player.fogMap, settlement.q, settlement.r, settlement.gatherRadius, state.mapWidth, state.mapHeight)
      }
    }
  }
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/systems/fog-system.ts test/unit/fog-system.test.ts
git commit -m "feat: add fog of war system with unit and settlement vision"
```

---

### Task 9: Unit AI — needs evaluation and decision making

The core needs-based AI system. Each tick, units evaluate their needs and choose an action.

**Files:**
- Create: `server/game/systems/unit-ai-system.ts`
- Test: `test/unit/unit-ai-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Unit with hunger > 80 returns to nearest settlement
- Unit with safety < 20 retreats away from enemies
- Scout with met needs follows curiosity (moves toward unexplored tiles)
- Gatherer with met needs seeks nearest resource tile
- Warrior with met needs patrols territory
- Faction modifier changes thresholds (Solar Empire warrior attacks sooner)
- Player policy shifts priorities (high aggression → warriors more aggressive)
- Settler seeks suitable settlement location

**Step 2: Implement UnitAISystem**

```typescript
// server/game/systems/unit-ai-system.ts
export function tickUnitAI(state: GameState): void {
  for (const unit of state.units.values()) {
    const player = state.players.get(unit.ownerId)!
    const faction = getFaction(player.factionId)

    // Update needs
    updateHunger(unit)
    updateSafety(unit, state)

    // Decide action based on needs priority
    const action = decideAction(unit, player, faction, state)
    applyAction(unit, action, state)
  }
}

function decideAction(unit: GameUnit, player: GamePlayer, faction: FactionDef, state: GameState): UnitAction {
  const hungerThreshold = 80
  const safetyThreshold = 20 * faction.aiModifiers.safety * (1 - player.policies.aggression / 200)

  if (unit.hunger > hungerThreshold) return { type: 'return_to_base' }
  if (unit.safety < safetyThreshold) return { type: 'retreat' }

  // Follow primary instinct based on unit type
  switch (unit.type) {
    case 'scout': return decideScoutAction(unit, faction, state)
    case 'gatherer': return decideGathererAction(unit, player, state)
    case 'warrior': return decideWarriorAction(unit, player, faction, state)
    case 'settler': return decideSettlerAction(unit, state)
    case 'builder': return decideBuilderAction(unit, player, state)
  }
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/systems/unit-ai-system.ts test/unit/unit-ai-system.test.ts
git commit -m "feat: add needs-based unit AI with faction and policy modifiers"
```

---

### Task 10: Unit movement and pathfinding

Simple hex pathfinding (BFS on hex grid) and per-tick movement.

**Files:**
- Create: `server/game/systems/movement-system.ts`
- Test: `test/unit/movement-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Unit moves one tile per tick toward target
- Unit avoids water/mountain tiles
- Road tiles give speed bonus (move 2 tiles per tick on road)
- Unit stops at target tile
- BFS finds shortest path on hex grid

**Step 2: Implement MovementSystem**

Hex BFS pathfinding using `getHexNeighbors` from `hex-map-data.ts`. Units move along path one step per tick (or more with roads/speed bonuses).

**Step 3: Run tests, commit**

```bash
git add server/game/systems/movement-system.ts test/unit/movement-system.test.ts
git commit -m "feat: add hex pathfinding and unit movement system"
```

---

### Task 11: Combat system

Auto-combat resolution when warring units are adjacent.

**Files:**
- Create: `server/game/systems/combat-system.ts`
- Test: `test/unit/combat-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Units at war and adjacent → combat triggers
- Units at peace and adjacent → no combat
- Combat against neutral (barbarian/animal) always triggers
- Damage formula: base strength × terrain mod × health mod × group mod × random
- Unit dies when HP reaches 0
- Terrain modifiers: forest +20% defense, mountains +30%
- Group bonus: allied units nearby increase damage

**Step 2: Implement CombatSystem**

```typescript
export function tickCombat(state: GameState): CombatEvent[] {
  const events: CombatEvent[] = []
  // Check all unit pairs for adjacency + war status
  // Resolve combat with damage formula
  // Remove dead units
  return events
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/systems/combat-system.ts test/unit/combat-system.test.ts
git commit -m "feat: add auto-combat system with terrain and group modifiers"
```

---

### Task 12: Council and law system

Advisor voting logic, loyalty updates, and law effects application.

**Files:**
- Create: `server/game/systems/council-system.ts`
- Test: `test/unit/council-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Propose law with high loyalty → passes (3+ yes votes)
- Propose law with low loyalty → fails
- General votes yes for military laws when army is strong
- Treasurer votes no during gold deficit
- Tribune votes no during famine
- Loyalty increases when domain prospers
- Loyalty decreases during domain crisis
- Passed law applies its effects to player state
- Culture cost deducted on proposal
- Cannot propose law if prerequisites not met

**Step 2: Implement CouncilSystem**

```typescript
export function proposeLaw(playerId: string, lawId: string, state: GameState, targetPlayerId?: string): LawProposalResult {
  const player = state.players.get(playerId)!
  const law = getLaw(lawId)

  // Validate prerequisites
  // Deduct culture cost
  // Each advisor votes based on domain conditions + loyalty
  // If 3+ yes → law passes, apply effects
  // Return result with individual votes
}

export function tickAdvisorLoyalty(state: GameState): void {
  // Update each advisor's loyalty based on domain conditions
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/systems/council-system.ts test/unit/council-system.test.ts
git commit -m "feat: add council voting and law system with advisor loyalty"
```

---

### Task 13: Technology research system

Per-tick research progress, tech completion, and effect application.

**Files:**
- Create: `server/game/systems/research-system.ts`
- Test: `test/unit/research-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Science income accumulates toward current research
- Tech completes when progress reaches cost
- Completed tech added to researchedTechs, currentResearch cleared
- Tech effects applied (unlock_building, modifier, etc.)
- Cannot research tech with unmet prerequisites
- Only one research at a time

**Step 2: Implement ResearchSystem**

```typescript
export function tickResearch(state: GameState): TechEvent[] {
  const events: TechEvent[] = []
  for (const [playerId, player] of state.players) {
    if (!player.currentResearch || player.eliminated) continue
    const tech = getTech(player.currentResearch)
    player.researchProgress += player.resourceIncome.science
    if (player.researchProgress >= tech.scienceCost) {
      completeTech(player, tech)
      events.push({ type: 'techResearched', techId: tech.id, playerId })
    }
  }
  return events
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/systems/research-system.ts test/unit/research-system.test.ts
git commit -m "feat: add technology research system with per-tick progress"
```

---

### Task 14: Settlement system

Settlement founding, growth (outpost → settlement → city), and building construction.

**Files:**
- Create: `server/game/systems/settlement-system.ts`
- Test: `test/unit/settlement-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Found settlement on valid land tile
- Cannot found on water/mountain/too close to existing
- Settlement grows to city at food threshold
- Building construction deducts production cost
- Building slots limit enforced
- Building effects (farm → +3 food/tick income)

**Step 2: Implement SettlementSystem**

**Step 3: Run tests, commit**

```bash
git add server/game/systems/settlement-system.ts test/unit/settlement-system.test.ts
git commit -m "feat: add settlement founding, growth, and building construction"
```

---

### Task 15: Victory condition checker

Check all 4 victory conditions each tick.

**Files:**
- Create: `server/game/systems/victory-system.ts`
- Test: `test/unit/victory-system.test.ts`

**Step 1: Write tests**

Test scenarios:
- Domination: player captures all enemy capitals → wins
- Prosperity: player reaches 10,000 gold → wins
- Influence: player fills culture meter → wins
- Enlightenment: player researches all techs → wins
- Elimination: player with no settlements is eliminated
- Last player standing → automatic victory

**Step 2: Implement VictorySystem**

**Step 3: Run tests, commit**

```bash
git add server/game/systems/victory-system.ts test/unit/victory-system.test.ts
git commit -m "feat: add victory condition checks for all 4 paths"
```

---

### Task 16: Game tick orchestrator

Master tick function that calls all systems in order, and the tick loop with pause/speed support.

**Files:**
- Create: `server/game/game-tick.ts`
- Test: `test/unit/game-tick.test.ts`

**Step 1: Write tests**

Test scenarios:
- Single tick calls all systems in correct order
- Paused game doesn't advance
- Speed multiplier changes tick interval
- Tick events collected and returned
- Tick number increments

**Step 2: Implement tick orchestrator**

```typescript
// server/game/game-tick.ts
export function executeTick(manager: GameStateManager): GameEvent[] {
  const state = manager.state
  if (state.paused) return []

  state.tick++
  const events: GameEvent[] = []

  // 1. Resource income/upkeep
  tickResources(state)

  // 2. Unit AI decisions
  tickUnitAI(state)

  // 3. Unit movement
  tickMovement(state)

  // 4. Combat resolution
  events.push(...tickCombat(state))

  // 5. Settlement growth
  tickSettlements(state)

  // 6. Research progress
  events.push(...tickResearch(state))

  // 7. Advisor loyalty updates
  tickAdvisorLoyalty(state)

  // 8. Fog of war
  tickFog(state)

  // 9. Victory check
  const victory = checkVictory(state)
  if (victory) events.push(victory)

  return events
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/game-tick.ts test/unit/game-tick.test.ts
git commit -m "feat: add game tick orchestrator calling all systems"
```

---

### Task 17: Game tick loop and active games registry

Server-side loop that runs ticks at intervals, manages active game instances.

**Files:**
- Create: `server/game/game-registry.ts`
- Test: `test/unit/game-registry.test.ts`

**Step 1: Write tests**

Test scenarios:
- Register new game → starts tick loop
- Tick loop fires at correct interval based on speed
- Pause stops tick loop
- Resume restarts tick loop
- Speed change updates interval
- Unregister game stops loop and cleans up

**Step 2: Implement GameRegistry**

```typescript
// server/game/game-registry.ts
const activeGames = new Map<string, { manager: GameStateManager; interval: ReturnType<typeof setInterval> }>()

export function startGame(manager: GameStateManager): void {
  const tickMs = 500 / manager.state.speed
  const interval = setInterval(() => {
    const events = executeTick(manager)
    broadcastTick(manager, events)
  }, tickMs)
  activeGames.set(manager.state.gameId, { manager, interval })
}

function broadcastTick(manager: GameStateManager, events: GameEvent[]): void {
  for (const [playerId] of manager.state.players) {
    const view = manager.getPlayerView(playerId)
    publisher.publish(`game:${manager.state.gameId}:${playerId}`, {
      type: 'tick',
      tick: manager.state.tick,
      playerState: view
    })
  }
  // Also publish discrete events
  for (const event of events) {
    publisher.publish(`game:${manager.state.gameId}`, event)
  }
}
```

**Step 3: Run tests, commit**

```bash
git add server/game/game-registry.ts test/unit/game-registry.test.ts
git commit -m "feat: add game registry with tick loop and broadcasting"
```

---

## Phase 3: Server RPC Procedures

### Task 18: Update Prisma schema for game players

Add `GamePlayer` model to persist faction choice per player per game. Update `Game` model with speed/status.

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Update schema**

```prisma
model Game {
  id        String       @id @default(cuid())
  lobbyId   String       @unique
  lobby     Lobby        @relation(fields: [lobbyId], references: [id])
  mapData   String       // JSON: terrain + elevation
  status    String       @default("playing")  // playing, paused, finished
  speed     Float        @default(1)
  winnerId  String?
  createdAt DateTime     @default(now())
  players   GamePlayer[]
}

model GamePlayer {
  id        String   @id @default(cuid())
  gameId    String
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  factionId String
  joinedAt  DateTime @default(now())

  @@unique([gameId, userId])
}
```

Also add `gamePlayers GamePlayer[]` to User model.

**Step 2: Generate and migrate**

```bash
bunx prisma migrate dev --name add-game-players
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add GamePlayer model for faction selection"
```

---

### Task 19: Update lobby for faction selection

Add faction selection to lobby. Players can choose a faction before game starts.

**Files:**
- Modify: `prisma/schema.prisma` — add `factionId` to `LobbyMember`
- Modify: `server/rpc/procedures/lobby.ts` — add `selectFaction` procedure
- Test: `test/unit/lobby-faction.test.ts`

**Step 1: Add factionId to LobbyMember**

```prisma
model LobbyMember {
  // ... existing fields
  factionId String?  // null until selected
}
```

**Step 2: Add selectFaction procedure**

```typescript
const selectFaction = authedProcedure
  .input(z.object({ factionId: z.enum(['solar_empire', 'merchant_league', 'forest_keepers', 'seekers']) }))
  .handler(async ({ input, context }) => {
    const membership = await prisma.lobbyMember.findFirst({
      where: { userId: context.user.id, lobby: { status: 'waiting' } }
    })
    if (!membership) throw new ORPCError('BAD_REQUEST', { message: 'Вы не в лобби' })
    await prisma.lobbyMember.update({
      where: { id: membership.id },
      data: { factionId: input.factionId }
    })
    publisher.publish(`lobby:${membership.lobbyId}`, {
      type: 'factionSelected',
      playerId: context.user.id,
      factionId: input.factionId
    })
    return { success: true }
  })
```

**Step 3: Migrate, run tests, commit**

```bash
bunx prisma migrate dev --name add-faction-to-lobby-member
git add prisma/ server/rpc/procedures/lobby.ts test/unit/lobby-faction.test.ts
git commit -m "feat: add faction selection in lobby"
```

---

### Task 20: Update game start to use game engine

Rewire `game.start` to initialize `GameStateManager` and register with `GameRegistry`.

**Files:**
- Modify: `server/rpc/procedures/game.ts`
- Modify: `server/rpc/publisher.ts` — add new event types

**Step 1: Update game.start handler**

```typescript
const start = authedProcedure
  .input(z.object({ lobbyId: z.string(), mapType: mapTypeSchema }))
  .handler(async ({ input, context }) => {
    // ... existing validation ...

    const members = await prisma.lobbyMember.findMany({
      where: { lobbyId: input.lobbyId }
    })

    // Validate all players selected a faction
    for (const m of members) {
      if (!m.factionId) throw new ORPCError('BAD_REQUEST', { message: 'Не все игроки выбрали фракцию' })
    }

    const mapData = generateMap(MAP_WIDTH, MAP_HEIGHT, input.mapType)

    const game = await prisma.game.create({
      data: {
        lobbyId: input.lobbyId,
        mapData: JSON.stringify(mapData),
        players: {
          create: members.map(m => ({
            userId: m.userId,
            factionId: m.factionId!
          }))
        }
      }
    })

    // Initialize game state manager
    const manager = GameStateManager.create({
      gameId: game.id,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      terrain: new Uint8Array(mapData.terrain),
      elevation: new Uint8Array(mapData.elevation),
      players: members.map(m => ({ userId: m.userId, factionId: m.factionId as FactionId })),
      speed: 1
    })

    // Register and start tick loop
    startGame(manager)

    // Update lobby status
    await prisma.lobby.update({
      where: { id: input.lobbyId },
      data: { status: 'playing' }
    })

    publisher.publish(`lobby:${input.lobbyId}`, { type: 'gameStarted', gameId: game.id })
    return { gameId: game.id }
  })
```

**Step 2: Update game.subscribe to send per-player tick state**

The subscribe handler should now yield per-tick player views from the game registry instead of just static map data.

**Step 3: Commit**

```bash
git add server/rpc/procedures/game.ts server/rpc/publisher.ts
git commit -m "feat: integrate game engine into game.start and subscribe"
```

---

### Task 21: Player action RPC procedures

New RPC endpoints for all player actions during gameplay.

**Files:**
- Create: `server/rpc/procedures/game-actions.ts`
- Modify: `server/rpc/router.ts`

**Procedures to create:**

```typescript
export const gameActionsRouter = {
  // --- Economy ---
  buyUnit: authedProcedure
    .input(z.object({ gameId: z.string(), unitType: z.enum([...UNIT_TYPES]), settlementId: z.string() }))
    .handler(/* deduct resources, spawn unit at settlement */),

  buildBuilding: authedProcedure
    .input(z.object({ gameId: z.string(), settlementId: z.string(), buildingType: z.enum([...BUILDING_TYPES]) }))
    .handler(/* validate slots, deduct cost, add building */),

  // --- Policies ---
  setPolicies: authedProcedure
    .input(z.object({ gameId: z.string(), policies: playerPoliciesSchema }))
    .handler(/* update player policies */),

  // --- Research ---
  startResearch: authedProcedure
    .input(z.object({ gameId: z.string(), techId: z.string() }))
    .handler(/* validate prerequisites, set currentResearch */),

  // --- Council ---
  proposeLaw: authedProcedure
    .input(z.object({ gameId: z.string(), lawId: z.string(), targetPlayerId: z.string().optional() }))
    .handler(/* validate, run council vote, apply if passed */),

  // --- Game control ---
  requestPause: authedProcedure
    .input(z.object({ gameId: z.string() }))
    .handler(/* pause game */),

  requestResume: authedProcedure
    .input(z.object({ gameId: z.string() }))
    .handler(/* resume game */),

  setSpeed: authedProcedure
    .input(z.object({ gameId: z.string(), speed: z.enum(['0.5', '1', '2', '3']) }))
    .handler(/* host only, update speed */)
}
```

**Commit:**

```bash
git add server/rpc/procedures/game-actions.ts server/rpc/router.ts
git commit -m "feat: add player action RPC procedures for gameplay"
```

---

## Phase 4: Client UI

### Task 22: Game HUD layout

Top-level game page layout with resource bar, minimap area, and controls.

**Files:**
- Modify: `app/pages/game/[id].vue` — add HUD overlay on top of HexMap
- Create: `app/components/game/GameHud.vue`
- Create: `app/components/game/ResourceBar.vue`

**ResourceBar** shows 5 resources with income/upkeep indicators. Uses Nuxt UI components.

**GameHud** is the top-level overlay containing ResourceBar, policy controls, pause/speed buttons.

**Commit:**

```bash
git add app/pages/game/[id].vue app/components/game/
git commit -m "feat: add game HUD with resource bar and controls"
```

---

### Task 23: Policy controls panel

UI for the 3 policy sliders (aggression, expansion, spending) + combat policy selector.

**Files:**
- Create: `app/components/game/PolicyPanel.vue`

**Uses:**
- `USlider` for each policy axis (0–100)
- `USelect` for combat policy
- Calls `rpcClient.gameActions.setPolicies()` on change (debounced)

**Commit:**

```bash
git add app/components/game/PolicyPanel.vue
git commit -m "feat: add policy controls panel with sliders"
```

---

### Task 24: Settlement and building UI

Click on settlement → show details panel with buildings, available build options.

**Files:**
- Create: `app/components/game/SettlementPanel.vue`
- Create: `app/components/game/BuildingList.vue`

**SettlementPanel** shows:
- Settlement name, tier, HP
- Current buildings in slots
- "Build" button for each available building (shows cost)
- "Buy Unit" buttons (shows cost, requires barracks for warriors)

**Commit:**

```bash
git add app/components/game/SettlementPanel.vue app/components/game/BuildingList.vue
git commit -m "feat: add settlement detail panel with building and unit purchase"
```

---

### Task 25: Technology tree UI

Visual tech tree showing researched, available, and locked technologies.

**Files:**
- Create: `app/components/game/TechTree.vue`

**TechTree** shows:
- 3 epoch rows for common techs
- Faction branch on the side
- Color coding: green (researched), blue (available), gray (locked)
- Click to start research
- Progress bar on current research

**Commit:**

```bash
git add app/components/game/TechTree.vue
git commit -m "feat: add technology tree UI"
```

---

### Task 26: Council and laws UI

Council panel showing advisors with loyalty bars, law tree, and proposal dialog.

**Files:**
- Create: `app/components/game/CouncilPanel.vue`
- Create: `app/components/game/LawTree.vue`
- Create: `app/components/game/AdvisorCard.vue`

**CouncilPanel** shows:
- 5 advisor cards with name, domain, loyalty bar (color-coded)
- "Propose Law" opens LawTree
- LawTree shows available laws organized by branch
- When proposing, shows predicted votes (based on current conditions) before confirming
- Result dialog shows how each advisor voted with reason

**Commit:**

```bash
git add app/components/game/CouncilPanel.vue app/components/game/LawTree.vue app/components/game/AdvisorCard.vue
git commit -m "feat: add council panel with advisor cards and law tree"
```

---

### Task 27: Diplomacy panel

View other players, diplomatic status, and propose war/peace through council.

**Files:**
- Create: `app/components/game/DiplomacyPanel.vue`

Shows:
- List of other players with faction, status (peace/tension/war)
- Actions route through council (propose war → opens council vote)

**Commit:**

```bash
git add app/components/game/DiplomacyPanel.vue
git commit -m "feat: add diplomacy panel with player status and war/peace proposals"
```

---

### Task 28: Unit rendering on hex map

Render units on the PixiJS hex map as sprites.

**Files:**
- Create: `app/utils/hex-unit-renderer.ts`
- Modify: `app/components/HexMap.vue` — integrate unit rendering

**UnitRenderer:**
- Sprite pool for unit icons (like tile pool)
- Different icons per unit type
- Color tint based on player/faction
- Smooth movement animation between tiles (using existing tween engine)
- Only renders units in `visibleUnits` from ClientPlayerState

**Commit:**

```bash
git add app/utils/hex-unit-renderer.ts app/components/HexMap.vue
git commit -m "feat: render units on hex map with faction colors and movement"
```

---

### Task 29: Settlement rendering on hex map

Render settlements as distinct sprites on the map.

**Files:**
- Create: `app/utils/hex-settlement-renderer.ts`
- Modify: `app/components/HexMap.vue`

**SettlementRenderer:**
- Different sprites for outpost/settlement/city
- Player color border
- HP bar if damaged
- Click handler → opens SettlementPanel

**Commit:**

```bash
git add app/utils/hex-settlement-renderer.ts app/components/HexMap.vue
git commit -m "feat: render settlements on hex map with tier indicators"
```

---

### Task 30: Fog of war rendering

Apply fog of war overlay to the hex map.

**Files:**
- Create: `app/utils/hex-fog-renderer.ts`
- Modify: `app/components/HexMap.vue`

**FogRenderer:**
- Unexplored tiles: fully black overlay
- Explored (no vision): semi-transparent dark overlay, show terrain only
- Visible: no overlay, show everything
- Updates each tick from `fogMap` in ClientPlayerState

**Commit:**

```bash
git add app/utils/hex-fog-renderer.ts app/components/HexMap.vue
git commit -m "feat: add fog of war rendering with 3 visibility states"
```

---

### Task 31: Faction selection in lobby

Update lobby page to include faction selection before game starts.

**Files:**
- Modify: `app/pages/lobbies/[id].vue`
- Create: `app/components/lobby/FactionSelector.vue`

**FactionSelector:**
- 4 faction cards with name, description, bonuses
- Currently selected highlighted
- Calls `rpcClient.lobby.selectFaction()` on click
- Shows other players' selections in real-time (via SSE)

**Commit:**

```bash
git add app/pages/lobbies/[id].vue app/components/lobby/FactionSelector.vue
git commit -m "feat: add faction selection UI in lobby"
```

---

### Task 32: Game composables

Vue composables for game state management on the client.

**Files:**
- Create: `app/composables/game-state.ts`

```typescript
export const useGameState = (gameId: string) => {
  const playerState = ref<ClientPlayerState | null>(null)
  const loading = ref(true)
  const error = ref('')
  const controller = new AbortController()

  // Subscribe to game events
  onMounted(async () => {
    const iterator = await rpcClient.game.subscribe({ gameId }, { signal: controller.signal })
    for await (const event of iterator) {
      if (event.type === 'tick') {
        playerState.value = event.playerState
        loading.value = false
      }
      // Handle other events (combat, tech, law, etc.)
    }
  })

  onBeforeUnmount(() => controller.abort())

  return { playerState, loading, error }
}

export const useBuyUnit = (gameId: string) => {
  return useMutation(orpc.gameActions.buyUnit.mutationOptions({}))
}

export const useBuildBuilding = (gameId: string) => {
  return useMutation(orpc.gameActions.buildBuilding.mutationOptions({}))
}

// ... etc for all game actions
```

**Commit:**

```bash
git add app/composables/game-state.ts
git commit -m "feat: add game state composables for client-side state management"
```

---

## Phase 5: Integration & Polish

### Task 33: Neutral factions — barbarians and animals

Spawn barbarian camps and animals during map generation, run their AI each tick.

**Files:**
- Modify: `server/game/game-state.ts` — spawn neutrals at game init
- Create: `server/game/systems/neutral-system.ts`
- Test: `test/unit/neutral-system.test.ts`

**NeutralSystem:**
- Animals: passive, attack only in response, guard resource tiles
- Barbarians: patrol around camp, raid nearby settlements
- New barbarian camps spawn on unclaimed territory periodically

**Commit:**

```bash
git add server/game/systems/neutral-system.ts test/unit/neutral-system.test.ts server/game/game-state.ts
git commit -m "feat: add neutral factions — barbarians and animals"
```

---

### Task 34: Tile improvements

Builder units construct improvements on tiles.

**Files:**
- Modify: `server/game/systems/unit-ai-system.ts` — builder decides what to improve
- Modify: `server/game/systems/movement-system.ts` — road speed bonus
- Create: `app/utils/hex-improvement-renderer.ts` — render roads/farms/mines on map

**Commit:**

```bash
git add server/game/systems/unit-ai-system.ts server/game/systems/movement-system.ts app/utils/hex-improvement-renderer.ts
git commit -m "feat: add tile improvements — roads, farms, mines"
```

---

### Task 35: Game notifications and event log

Toast notifications for important events + scrollable event log panel.

**Files:**
- Create: `app/components/game/EventLog.vue`
- Modify: `app/composables/game-state.ts` — add event handling with toasts

Events to notify:
- Tech researched
- Law passed/rejected (with advisor votes)
- War declared / peace declared
- Settlement captured
- Unit destroyed
- Victory approaching

**Commit:**

```bash
git add app/components/game/EventLog.vue app/composables/game-state.ts
git commit -m "feat: add game event log and toast notifications"
```

---

### Task 36: End-to-end integration test

Verify full game flow: lobby → faction select → start → ticks → actions → victory.

**Files:**
- Create: `test/unit/game-integration.test.ts`

**Test scenarios:**
1. Create game with 2 players → game state initialized correctly
2. Run 10 ticks → resources change, units move
3. Buy unit → unit appears, resources deducted
4. Build building → building added, production cost deducted
5. Propose law → council votes, law applied
6. Start research → progress accumulates over ticks

**Commit:**

```bash
git add test/unit/game-integration.test.ts
git commit -m "test: add end-to-end game integration test"
```

---

## Dependency Graph

```
Task 1 (types) → Task 2 (factions) → Task 5 (buildings/units/settlements)
Task 1 (types) → Task 3 (tech tree)
Task 1 (types) → Task 4 (law tree)
Task 1 (types) → Task 6 (game state) → Task 7 (resources)
                                      → Task 8 (fog)
                                      → Task 9 (unit AI) → Task 10 (movement)
                                      → Task 11 (combat)
                                      → Task 12 (council)
                                      → Task 13 (research)
                                      → Task 14 (settlements)
                                      → Task 15 (victory)
Task 7–15 → Task 16 (tick orchestrator) → Task 17 (registry)
Task 17 → Task 18 (schema) → Task 19 (lobby faction) → Task 20 (game start) → Task 21 (actions)
Task 21 → Task 22–32 (client UI) — these can be parallelized
Task 22–32 → Task 33–36 (integration & polish)
```

## Parallelization Opportunities

The following tasks can run in parallel:
- **Tasks 2, 3, 4, 5** (static data files — no dependencies between them, only need Task 1)
- **Tasks 7, 8, 9, 11, 12, 13, 14, 15** (game systems — only need Task 6, independent of each other)
- **Tasks 22–31** (client UI components — independent of each other, only need Task 21)
