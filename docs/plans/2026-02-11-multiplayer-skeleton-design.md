# Multiplayer Skeleton — Design

## Goal

Minimal multiplayer online game skeleton: lobby system + hexagonal map rendered with PixiJS, real-time sync via oRPC event iterators.

## Decisions

- **Player identity:** Enter name → get sessionToken (no auth)
- **After game start:** All players see the same hex map. No actions/gameplay.
- **Map generation:** Server generates 10x10 random hex grid (grass/water/mountain)
- **PixiJS wrapper:** vue3-pixi + vue3-pixi-nuxt module
- **Real-time:** oRPC EventPublisher with dynamic channels + event iterators (SSE)

## Data Model

```prisma
model Player {
  id           String   @id @default(cuid())
  name         String
  sessionToken String   @unique @default(cuid())
  lobbyId      String?
  lobby        Lobby?   @relation(fields: [lobbyId], references: [id])
  createdAt    DateTime @default(now())
}

model Lobby {
  id        String   @id @default(cuid())
  hostId    String
  status    String   @default("waiting") // waiting | playing
  createdAt DateTime @default(now())
  players   Player[]
  game      Game?
}

model Game {
  id        String   @id @default(cuid())
  lobbyId   String   @unique
  lobby     Lobby    @relation(fields: [lobbyId], references: [id])
  mapData   String   // JSON: { tiles: [{q, r, type}] }
  createdAt DateTime @default(now())
}
```

## oRPC Router

```
server/rpc/
  router.ts           — root router
  publisher.ts        — EventPublisher singleton
  procedures/
    player.ts         — join(name) → {player, sessionToken}
    lobby.ts          — create, join, leave, list, subscribe
    game.ts           — start, subscribe

server/api/rpc/[...].ts — Nuxt catch-all → RPCHandler
```

### EventPublisher

One publisher with dynamic channels:
- `lobby:{id}` → playerJoined, playerLeft, gameStarted
- `game:{id}` → mapReady

### Procedures

| Procedure | Type | Description |
|-----------|------|-------------|
| player.join | mutation | Create Player, return sessionToken |
| lobby.list | query | List lobbies with status=waiting |
| lobby.create | mutation | Create lobby, caller becomes host |
| lobby.join | mutation | Set player.lobbyId, publish to lobby:{id} |
| lobby.leave | mutation | Clear player.lobbyId, publish to lobby:{id} |
| lobby.subscribe | subscription | Event iterator on lobby:{id} |
| game.start | mutation | Generate map, save Game, publish gameStarted |
| game.subscribe | subscription | Event iterator on game:{id}, yields mapReady with mapData |

## Frontend

### Pages

```
app/pages/
  index.vue           — enter name
  lobbies/
    index.vue         — lobby list
    [id].vue          — lobby room
  game/
    [id].vue          — PixiJS hex map
```

### User Flow

1. `/` — Enter name → sessionToken saved to cookie
2. `/lobbies` — See lobby list, create new lobby
3. `/lobbies/:id` — See players (real-time), host sees "Start" button
4. Game started event → navigateTo(`/game/:id`)
5. `/game/:id` — Subscribe game events → receive mapData → render hex map

### Components

- `HexMap.vue` — vue3-pixi Application + hex rendering
- `LobbyPlayerList.vue` — player list in lobby

### State

- sessionToken in cookie (useCookie)
- oRPC client as Nuxt plugin, sends token in header
- Server extracts Player from token header

## Hex Map

- 10x10 grid, axial coordinates (q, r), flat-top hexagons
- 3 terrain types: grass (0x4ade80), water (0x60a5fa), mountain (0x9ca3af)
- Server generates on game.start, sends to all via game.subscribe
- Client renders with `graphics.regularPoly(x, y, size, 6)`
- Position formulas: `x = size * 3/2 * q`, `y = size * (sqrt(3)/2 * q + sqrt(3) * r)`
