# Realistic Map Generation

## Terrain Types (10)

Two Simplex noise layers: **elevation** and **moisture**. Biome determined by their combination.

| ID | Type | Color | Condition |
|---|---|---|---|
| 0 | `deep_water` | `#1e3a5f` | elevation < 0.30 |
| 1 | `shallow_water` | `#60a5fa` | elevation < 0.38 |
| 2 | `beach` | `#f5d08a` | elevation < 0.42 |
| 3 | `desert` | `#e8c86a` | elevation >= 0.42, moisture < 0.25 |
| 4 | `plains` | `#a8d86a` | elevation >= 0.42, moisture 0.25-0.50 |
| 5 | `grassland` | `#4ade80` | elevation >= 0.42, moisture 0.50-0.70 |
| 6 | `forest` | `#2d8a4e` | elevation >= 0.42, moisture >= 0.70 |
| 7 | `hills` | `#b8956a` | elevation >= 0.68, moisture < 0.50 |
| 8 | `mountain` | `#9ca3af` | elevation >= 0.80 |
| 9 | `snow` | `#e8edf3` | elevation >= 0.88 |

Elevation thresholds checked top-down (snow > mountain > hills > ...). Moisture only matters for mid-elevations. Ocean ~35%, land ~65%.

## Generation Algorithm

Library: `simplex-noise` (zero-dependency).

Two noise layers with fractal Brownian motion (octaves):

```
elevation = fbm(q, r, seed1)   // 4 octaves, frequency 0.005, persistence 0.5
moisture  = fbm(q, r, seed2)   // 3 octaves, frequency 0.008, persistence 0.5
```

## Map Types

Differ only in post-processing of elevation before biome lookup:

| Type | Logic |
|---|---|
| **Continents** | `elevation -= distance_to_center * 0.3` — edges sink, 2-4 land masses |
| **Pangaea** | `elevation -= distance_to_edge * 0.5` — strong gradient to edges, one large landmass |
| **Archipelago** | `elevation *= 0.7`, water threshold raised — many small islands |

`distance_to_center` — normalized distance from tile to map center (0..1).

## UI Integration

Host selects map type before starting game. `mapType` passed in `game.start({ lobbyId, mapType })` input. Default: `continents`. Not stored in Lobby model — only used at generation time.

## File Changes

**New:**
- `server/utils/map-generator.ts` — fbm noise, biome determination, three map types. Single export: `generateMap(width, height, mapType, seed?)`

**Modified:**
- `server/rpc/procedures/game.ts` — remove old `generateMap()`, add `mapType` to input, call new generator
- `app/utils/hex-map-data.ts` — extend `TerrainId` 0-9, update `TERRAIN_COLORS` (10 colors)
- Lobby UI — add `<USelect>` for map type (host only)

**New dependency:** `simplex-noise`

**Unchanged:** `HexMapData` interface, `HexMap.vue` rendering, camera, visible range, LOD, DB format.
