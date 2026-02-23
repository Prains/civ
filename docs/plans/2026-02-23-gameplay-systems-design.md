# Gameplay Systems Design

## Overview

Real-time with pause, multiplayer civilization game with autonomous needs-based units, 4 factions, hybrid economy, and multiple victory conditions.

Core philosophy: **"Ecosystem"** approach — units are semi-autonomous agents with needs and instincts. The player acts as a strategist, buying units, setting policies, and building infrastructure. Units decide how to act based on their needs, faction traits, and player policies.

---

## 1. Game Loop & Tick System

**Server-side tick** every ~500ms:

```
Tick → Update resources → Evaluate unit needs → Move units → Resolve combat → Update fog → Check victory → Broadcast state
```

- **Pause**: any player can request, host can accept/decline. Ticks stop, UI remains interactive (policies, map viewing).
- **Speed**: host controls speed: x0.5 / x1 / x2 / x3 (changes tick interval).
- **Authority**: all game logic runs on the server. Clients receive state via SSE and render. Prevents cheating, ensures sync.

---

## 2. Resource System

5 resources:

| Resource | Sources | Purpose |
|----------|---------|---------|
| **Food** | Farms, meadows, fishing | Unit upkeep. No food → units starve (lose motivation, work worse) |
| **Production** | Forests, hills, mines | Building construction, unit purchasing |
| **Gold** | Trade, markets | Universal resource. Can convert to others via market. Building upkeep |
| **Science** | Libraries, scholars | Technology research |
| **Culture** | Temples, monuments | Border expansion, policy unlocks, cultural victory |

**Acquisition:**
- Buildings in settlements produce base income per tick (farm = +2 food/tick)
- Gatherer units autonomously collect resources from tiles around settlements and return to base
- Tile biome determines resource type (forest → production, meadow → food, hills → production, etc.)
- **Upkeep**: units and buildings cost food/gold per tick. Over-producing units → bankruptcy

**Economic crisis:**
- Food < 0: units become slower, fight worse, may "desert" (disappear)
- Gold < 0: buildings degrade, cannot buy units

---

## 3. Unit System & Needs-Based AI

### Unit Types

Base types available to all factions (with faction modifiers):

| Unit | Role | Key Need |
|------|------|----------|
| **Scout** | Explores map, reveals fog | Curiosity (explore the unknown) |
| **Gatherer** | Collects resources, brings to base | Greed (seek resources) |
| **Warrior** | Defense and attack | Aggression / Territoriality |
| **Settler** | Founds new settlements | Expansion (find good spots) |
| **Builder** | Builds tile improvements (roads, farms, mines) | Creation (improve territory) |

### Needs System

Each unit has needs (0–100):

- **Hunger** — grows over time. Unit seeks food / returns to base
- **Safety** — drops when enemies nearby. Unit retreats or groups up
- **Primary instinct** — depends on unit type (curiosity for scout, greed for gatherer, etc.)

**Each tick**, unit evaluates needs and picks highest-priority action:

```
if hunger > 80 → return to base for food
if safety < 20 → retreat / find allies
else → follow primary instinct (scout / gather / patrol)
```

**Faction** modifies thresholds and weights:
- Aggressive faction: lower safety threshold (fight even when dangerous), stronger aggression
- Trade faction: boosted greed, units gather more efficiently but weaker in combat

**Player policies** — additional modifiers on top of faction traits:
- **Aggression ↔ Defense** — shifts thresholds for all military units
- **Expansion ↔ Consolidation** — affects scouts and settlers
- **Accumulation ↔ Spending** — affects gatherers and traders

This creates **emergent behavior**: same units behave differently depending on faction, policies, and current map situation.

---

## 4. Factions

### 1. Solar Empire

- **Philosophy**: Expansion and conquest. "More territory = more power"
- **Unique unit**: Legionnaire — warrior with grouping bonus (stronger near allies)
- **Unique building**: Fort — outpost with military bonus and zone of control
- **AI modifiers**: Territoriality x1.5, Aggression x1.3
- **Bonus**: +20% production, -10% science
- **Unique tech branch**: Tactics and fortification

### 2. Merchant League

- **Philosophy**: Gold solves everything. Trade and diplomacy
- **Unique unit**: Caravan — creates trade routes between settlements (own and others), generating gold
- **Unique building**: Grand Market — converts resources more efficiently
- **AI modifiers**: Greed x1.5, Safety x1.3 (units more cautious, avoid fights)
- **Bonus**: +30% gold, -15% combat strength
- **Unique tech branch**: Economy and trade

### 3. Forest Keepers

- **Philosophy**: Quality > quantity. Deep development, not wide
- **Unique unit**: Ranger — scout-warrior, invisible in forests, strong in defense
- **Unique building**: Sacred Grove — boosts all units in radius, produces culture
- **AI modifiers**: Safety x0.7 (braver defending own territory), low territoriality
- **Bonus**: +20% culture, +15% defense on own territory, -20% expansion speed
- **Unique tech branch**: Culture and nature

### 4. The Seekers

- **Philosophy**: Science and progress. Technological superiority
- **Unique unit**: Scholar — non-combat unit, accelerates research, can build "labs" on map
- **Unique building**: Academy — powerful science building, boosts research of all settlements
- **AI modifiers**: Curiosity x2.0 (scouts explore aggressively), Aggression x0.5
- **Bonus**: +30% science, -15% production
- **Unique tech branch**: Advanced technology and wonders

**Note:** Multiple players can pick the same faction. No restriction.

---

## 5. Settlements & Buildings

### Settlement Types

| Type | Cost | Building Slots | Gather Radius | Notes |
|------|------|---------------|--------------|-------|
| **Outpost** | 50 production | 2 | 2 tiles | Quick to place. Grants vision |
| **Settlement** | 150 production | 4 | 3 tiles | Can grow into city |
| **City** | Upgrade from settlement (300 production) | 8 | 4 tiles | Full building set, unit spawning |

**Founding:** Settler unit finds suitable tile (not water, not mountains, not within 5 tiles of another settlement) and founds. Settler AI picks optimal location based on surrounding resources.

**Growth:** Outpost → Settlement → City at population/resource thresholds. Growth is automatic but requires food.

### Buildings

Built in settlement slots:

| Building | Cost | Effect |
|----------|------|--------|
| Farm | 30 prod | +3 food/tick |
| Lumber Mill | 40 prod | +3 production/tick |
| Market | 60 prod | +2 gold/tick, resource conversion |
| Library | 80 prod | +2 science/tick |
| Temple | 70 prod | +2 culture/tick |
| Barracks | 100 prod | Unlocks warrior purchasing |
| Walls | 120 prod | +50% settlement defense |

### Tile Improvements

Builder unit creates improvements on tiles within settlement radius:
- **Road** — units move faster
- **Farm** (on meadow) — increases food yield
- **Mine** (on hills) — increases production yield

---

## 6. Technology Tree

### Structure

Common core (all factions) + unique branch per faction.

### Common Core — 3 Epochs

**Epoch 1: Foundations** (starting)
- Agriculture → unlocks farms
- Mining → unlocks mines
- Scouting → +1 scout vision range
- Construction → unlocks walls, faster outpost building

**Epoch 2: Development** (requires 3 from Epoch 1)
- Trade → unlocks trade routes and markets
- Military → unlocks improved warriors
- Architecture → faster settlement→city upgrade, +2 slots
- Writing → unlocks libraries and temples

**Epoch 3: Flourishing** (requires 3 from Epoch 2)
- Economics → markets more efficient, gold x1.5
- Tactics → warriors group smarter, coordination bonus
- Engineering → unlocks wonders of the world
- Philosophy → culture x1.5, unlocks cultural victory path

### Faction-Unique Branches

**Solar Empire:**
Phalanx Formation → Siege Weapons → Fortress Assault → Total War (bonus when capturing cities)

**Merchant League:**
Mint → Banking → Trade Guilds → Economic Dominance (economic victory condition)

**Forest Keepers:**
Forest Wisdom → Camouflage → Sacred Groves → Great Awakening (cultural victory condition)

**The Seekers:**
Experiments → Alchemy → Great Inventions → Enlightenment (scientific victory condition)

Research costs science points and takes time (number of ticks). Only one technology researched at a time.

---

## 7. Combat & Diplomacy

### Diplomacy

Combat is tied to diplomatic status between players:

| Status | Effect |
|--------|--------|
| **Peace** (default) | Units don't attack each other, can pass through territory |
| **Tension** | Units don't attack, but cannot enter opponent's territory |
| **War** | Auto-combat enabled, units attack enemies per policies |

**Declaring war** is an explicit player action. Transition: Peace → Tension → War (each step is a player action with cooldown between them to allow preparation).

### Auto-Combat

When military units of warring players occupy adjacent tiles, combat resolves automatically:

```
Damage = BaseStrength × TerrainMod × HealthMod × GroupMod × Random(0.8–1.2)
```

- **BaseStrength** — depends on unit type and researched technologies
- **TerrainMod** — forest +20% defense, mountains +30%, open plains neutral
- **HealthMod** — hungry/wounded units are weaker
- **GroupMod** — allied units nearby give coordination bonus

### Combat Policies (set by player)

- **Aggressive** — units attack enemies in vision range, pursue
- **Defensive** — units fight only on own territory, don't pursue
- **Avoidance** — units evade combat, flee when enemy detected

### Neutral Factions

- **Animals** — passive, attack only in response. Guard resource tiles
- **Barbarians** — aggressive camps, spawn on unclaimed territory, raid settlements. Destroying camp gives resource bonus

---

## 8. Fog of War

- Each unit has **vision radius** (2–4 tiles depending on type)
- **Unexplored tiles** — fully black, terrain not visible
- **Explored but no vision** — terrain and buildings visible, but not units (dimmed)
- **In line of sight** — fully visible: terrain, buildings, units, resources

Mechanics:
- Scouts have increased vision (4 tiles vs 2 for standard units)
- Settlements grant permanent vision in their radius
- Forest Keepers: rangers are invisible in forests to enemies (except other scouts)
- Server filters state per player — clients only receive visible data

---

## 9. Victory Conditions

4 paths to victory, each aligned with a faction (but available to all):

### 1. Domination (Military)
Capture every opponent's capital (first city). Don't need to destroy all settlements — just capitals.
Natural path for Solar Empire.

### 2. Prosperity (Economic)
Accumulate a target amount of gold (e.g., 10,000) OR control 60% of trade routes on the map.
Natural path for Merchant League.

### 3. Influence (Cultural)
Reach a culture threshold by filling the "Great Culture" meter. Requires building wonders and sacred groves.
Natural path for Forest Keepers.

### 4. Enlightenment (Scientific)
Research all technologies including the final faction tech. First to complete the full tree wins.
Natural path for The Seekers.

**Additional rules:**
- Losing all settlements → player is **eliminated**
- Last player standing → automatic victory
- No time limit — game plays until someone wins

---

## 10. Game Start & Multiplayer

**Starting a game:**
1. Players in lobby choose factions (duplicates allowed — no restriction)
2. Host configures: map type, size, game speed
3. Host clicks "Start"
4. Server generates map, places each player at a **random land tile** (not mountains, minimum 15 tiles apart)
5. Each player starts with: 1 settlement (auto-founded) + 2 scouts + 1 gatherer + 1 builder

**Synchronization:**
- Server is single source of truth. Each tick sends updates via SSE
- Client receives **only what it can see** (fog of war filtered server-side)
- Player actions (buy unit, change policy, build, declare war) — RPC calls to server
- Pause — any player can request, host can accept/decline

**Neutral spawning:**
- Barbarian camps generated at map creation in zones far from players
- Animals (wolves, bears) spawn around forests and mountains
- New barbarian camps appear on unclaimed territory as game progresses
