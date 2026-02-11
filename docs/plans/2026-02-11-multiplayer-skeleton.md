# Multiplayer Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use agent-team-driven-development to execute this plan.

**Goal:** Build a minimal multiplayer lobby + hexagonal map skeleton using oRPC event iterators and PixiJS.

**Architecture:** Nuxt 4 full-stack. oRPC handles all client-server communication including real-time subscriptions via EventPublisher + event iterators (SSE). PixiJS renders the hex map through vue3-pixi declarative components. Prisma/SQLite for persistence.

**Tech Stack:** Nuxt 4, oRPC (`@orpc/server`, `@orpc/client`), Prisma 7 (SQLite), PixiJS 8, vue3-pixi, vue3-pixi-nuxt, Nuxt UI (all frontend components), Zod, TypeScript

**Frontend note:** All UI components (buttons, inputs, cards, layout) use Nuxt UI (`@nuxt/ui`). Primary color: green. Neutral: slate. No custom CSS beyond what Nuxt UI provides.

---

## Wave Analysis

### Specialists

| Role | Expertise | Tasks |
| --- | --- | --- |
| backend-engineer | oRPC, Prisma, Nuxt server routes, TypeScript, Zod | Tasks 1, 2, 3, 4 |
| vue-engineer | Vue 3, Nuxt UI components, vue3-pixi, TypeScript | Tasks 5, 6 |

### Waves

**Wave 1: Project Setup** — foundation for everything
- Task 1 (backend-engineer) — Install deps, update Prisma schema, run migration, update nuxt.config

**Wave 2: oRPC Infrastructure** — needs Wave 1 (deps installed, DB ready)
- Task 2 (backend-engineer) — EventPublisher, typed base, router with stubs, Nuxt handler, client plugin

**Wave 3: Server Procedures** — needs Wave 2 (oRPC infra ready)
- Task 3 (backend-engineer) — Player join + all Lobby procedures
- Task 4 (backend-engineer) — Game start/subscribe + map generation utility

  *Parallel-safe because:* Task 3 modifies `server/rpc/procedures/player.ts` + `server/rpc/procedures/lobby.ts`. Task 4 modifies `server/rpc/procedures/game.ts` + creates `server/rpc/utils/map.ts` and `test/unit/map.test.ts`. Zero file overlap. Both read `publisher.ts` and `base.ts` without modifying them.

  *Depends on Wave 2:* `server/rpc/base.ts` (typed procedure builder), `server/rpc/publisher.ts` (EventPublisher instance), `server/rpc/router.ts` (imports procedure files)

**Wave 4: Frontend Pages** — needs all of Wave 3 (all procedures functional)
- Task 5 (vue-engineer) — Entry page + Lobby list + Lobby room (Nuxt UI components)
- Task 6 (vue-engineer) — Game page + HexMap component (vue3-pixi)

  *Parallel-safe because:* Task 5 touches `app/pages/index.vue`, `app/pages/lobbies/index.vue`, `app/pages/lobbies/[id].vue`, `app/components/LobbyPlayerList.vue`, `app/app.vue`. Task 6 touches `app/pages/game/[id].vue`, `app/components/HexMap.vue`. Zero file overlap.

  *Depends on Wave 3:* Both Tasks 3 and 4 must be complete. Task 5 calls `game.start` (Task 4) from the lobby room. Task 6 calls `game.subscribe` (Task 4). Both call player/lobby procedures (Task 3).

### Dependency Graph

```text
Task 1 ──→ Task 2 ──→ Task 3 ──┬→ Task 5
                   ──→ Task 4 ──┤
                                └→ Task 6
```

> Note: Both Task 5 and Task 6 depend on BOTH Tasks 3 and 4. Wave 4 starts only after all of Wave 3 is complete.

---

## Tasks

### Task 1: Project Setup

**Specialist:** backend-engineer
**Depends on:** None
**Produces:** Installed packages, updated `nuxt.config.ts` with vue3-pixi-nuxt module, Prisma schema with Player/Lobby/Game models, applied migration, updated `lib/prisma.ts`

**Files:**
- Modify: `package.json` (via `bun add`)
- Modify: `nuxt.config.ts`
- Modify: `prisma/schema.prisma`
- Modify: `lib/prisma.ts`

**Step 1: Install dependencies**

Run:
```bash
bun add @orpc/server @orpc/client pixi.js vue3-pixi vue3-pixi-nuxt zod
```
Expected: packages added to `package.json` dependencies

**Step 2: Update nuxt.config.ts**

Add `'vue3-pixi-nuxt'` to modules array and remove the prerender route rule:

```typescript
// nuxt.config.ts
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/hints',
    '@nuxt/test-utils',
    '@nuxt/scripts',
    '@nuxt/image',
    '@compodium/nuxt',
    '@formkit/auto-animate',
    '@pinia/colada-nuxt',
    '@pinia/nuxt',
    '@prisma/nuxt',
    '@vueuse/nuxt',
    'vue3-pixi-nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
```

**Step 3: Update Prisma schema**

Replace the contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

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
  status    String   @default("waiting")
  createdAt DateTime @default(now())
  players   Player[]
  game      Game?
}

model Game {
  id        String   @id @default(cuid())
  lobbyId   String   @unique
  lobby     Lobby    @relation(fields: [lobbyId], references: [id])
  mapData   String
  createdAt DateTime @default(now())
}
```

**Step 4: Update lib/prisma.ts import**

The generated Prisma client lives at `app/generated/prisma`. Update the import:

```typescript
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
```

> Note: Keep `@prisma/client` import as-is. The `@prisma/nuxt` module configures the client alias. If the import fails after migration, change to `import { PrismaClient } from '../app/generated/prisma/client'`.

**Step 5: Run migration**

Run:
```bash
bunx prisma migrate dev --name multiplayer-skeleton
```

> **Warning:** This migration drops the existing `User` and `Post` tables. Prisma will prompt for confirmation since it's a destructive change. Confirm with "y" — the old models are not used.

Expected: Migration applied, generated client updated in `app/generated/prisma/`

**Step 6: Verify build**

Run:
```bash
bun run typecheck
```
Expected: No type errors (or only pre-existing ones unrelated to our changes)

**Step 7: Commit**

```bash
git add nuxt.config.ts prisma/schema.prisma lib/prisma.ts package.json bun.lock prisma/migrations/
git commit -m "feat: add multiplayer deps, prisma schema (Player, Lobby, Game)"
```

---

### Task 2: oRPC Infrastructure

**Specialist:** backend-engineer
**Depends on:** Task 1 (oRPC packages installed, Prisma schema applied)
**Produces:** `server/rpc/base.ts` (typed procedure builder), `server/rpc/publisher.ts` (EventPublisher singleton), `server/rpc/router.ts` (combined router + `Router` type export), `server/routes/rpc/[...].ts` (Nuxt handler), `app/plugins/orpc.client.ts` (typed client), stub procedure files at `server/rpc/procedures/{player,lobby,game}.ts`

**Files:**
- Create: `server/rpc/base.ts`
- Create: `server/rpc/publisher.ts`
- Create: `server/rpc/procedures/player.ts` (stub)
- Create: `server/rpc/procedures/lobby.ts` (stub)
- Create: `server/rpc/procedures/game.ts` (stub)
- Create: `server/rpc/router.ts`
- Create: `server/routes/rpc/[...].ts`
- Create: `app/plugins/orpc.client.ts`

**Step 1: Create base typed procedure builder**

```typescript
// server/rpc/base.ts
import { os } from '@orpc/server'

export interface Context {
  sessionToken?: string
}

export const pub = os.$context<Context>()
```

**Step 2: Create EventPublisher singleton**

```typescript
// server/rpc/publisher.ts
import { EventPublisher } from '@orpc/server'

export type LobbyEvent =
  | { type: 'playerJoined'; player: { id: string; name: string } }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'gameStarted'; gameId: string }

export type GameEvent =
  | { type: 'mapReady'; mapData: { tiles: Array<{ q: number; r: number; type: string }> } }

export const publisher = new EventPublisher<Record<string, LobbyEvent | GameEvent>>()
```

**Step 3: Create stub procedure files**

```typescript
// server/rpc/procedures/player.ts
export const playerRouter = {}
```

```typescript
// server/rpc/procedures/lobby.ts
export const lobbyRouter = {}
```

```typescript
// server/rpc/procedures/game.ts
export const gameRouter = {}
```

**Step 4: Create combined router**

```typescript
// server/rpc/router.ts
import { playerRouter } from './procedures/player'
import { lobbyRouter } from './procedures/lobby'
import { gameRouter } from './procedures/game'

export const router = {
  player: playerRouter,
  lobby: lobbyRouter,
  game: gameRouter
}

export type Router = typeof router
```

**Step 5: Create Nuxt server handler**

```typescript
// server/routes/rpc/[...].ts
import { RPCHandler } from '@orpc/server/fetch'
import { router } from '../../rpc/router'
import type { Context } from '../../rpc/base'

const handler = new RPCHandler(router)

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)
  const sessionToken = getHeader(event, 'x-session-token') || undefined

  const { response } = await handler.handle(request, {
    prefix: '/rpc',
    context: { sessionToken } satisfies Context
  })

  if (response) return response

  setResponseStatus(event, 404, 'Not Found')
  return 'Not found'
})
```

**Step 6: Create client plugin (client-only)**

```typescript
// app/plugins/orpc.client.ts
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { Router } from '../../server/rpc/router'

export default defineNuxtPlugin(() => {
  const token = useCookie('session-token')

  const link = new RPCLink({
    url: `${window.location.origin}/rpc`,
    headers: () => ({
      ...(token.value ? { 'x-session-token': token.value } : {})
    })
  })

  const client: RouterClient<Router> = createORPCClient(link)

  return {
    provide: { orpc: client }
  }
})
```

**Step 7: Verify — start dev server**

Run:
```bash
bun dev
```
Expected: Server starts without errors. Visiting `http://localhost:3000/rpc` returns "Not found" (correct — no matching procedure).

**Step 8: Commit**

```bash
git add server/rpc/ server/routes/rpc/ app/plugins/orpc.client.ts
git commit -m "feat: add oRPC infrastructure (publisher, router, handler, client plugin)"
```

---

### Task 3: Player + Lobby Procedures

**Specialist:** backend-engineer
**Depends on:** Task 2 (for `server/rpc/base.ts`, `server/rpc/publisher.ts`, stub files to fill in)
**Produces:** Functional `player.join`, `lobby.create`, `lobby.join`, `lobby.leave`, `lobby.list`, `lobby.subscribe` procedures. Helper `getPlayer()` at `server/rpc/utils/auth.ts`.

**Files:**
- Create: `server/rpc/utils/auth.ts`
- Modify: `server/rpc/procedures/player.ts` (replace stub)
- Modify: `server/rpc/procedures/lobby.ts` (replace stub)

**Step 1: Create auth helper**

```typescript
// server/rpc/utils/auth.ts
import prisma from '../../../lib/prisma'

export async function getPlayer(sessionToken: string | undefined) {
  if (!sessionToken) throw new Error('Not authenticated')
  const player = await prisma.player.findUnique({
    where: { sessionToken }
  })
  if (!player) throw new Error('Player not found')
  return player
}
```

**Step 2: Implement player procedures**

Replace the contents of `server/rpc/procedures/player.ts`:

```typescript
// server/rpc/procedures/player.ts
import { z } from 'zod'
import prisma from '../../../lib/prisma'
import { pub } from '../base'

export const playerRouter = {
  join: pub
    .input(z.object({ name: z.string().min(1).max(32) }))
    .handler(async ({ input }) => {
      const player = await prisma.player.create({
        data: { name: input.name }
      })
      return {
        id: player.id,
        name: player.name,
        sessionToken: player.sessionToken
      }
    })
}
```

**Step 3: Implement lobby procedures**

Replace the contents of `server/rpc/procedures/lobby.ts`:

```typescript
// server/rpc/procedures/lobby.ts
import { z } from 'zod'
import prisma from '../../../lib/prisma'
import { pub } from '../base'
import { publisher } from '../publisher'
import { getPlayer } from '../utils/auth'

export const lobbyRouter = {
  list: pub
    .handler(async () => {
      return prisma.lobby.findMany({
        where: { status: 'waiting' },
        include: {
          players: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    }),

  create: pub
    .handler(async ({ context }) => {
      const player = await getPlayer(context.sessionToken)

      const lobby = await prisma.lobby.create({
        data: { hostId: player.id }
      })

      await prisma.player.update({
        where: { id: player.id },
        data: { lobbyId: lobby.id }
      })

      return { id: lobby.id, hostId: lobby.hostId }
    }),

  join: pub
    .input(z.object({ lobbyId: z.string() }))
    .handler(async ({ input, context }) => {
      const player = await getPlayer(context.sessionToken)

      await prisma.player.update({
        where: { id: player.id },
        data: { lobbyId: input.lobbyId }
      })

      publisher.publish(`lobby:${input.lobbyId}`, {
        type: 'playerJoined',
        player: { id: player.id, name: player.name }
      })

      return { success: true }
    }),

  leave: pub
    .input(z.object({ lobbyId: z.string() }))
    .handler(async ({ input, context }) => {
      const player = await getPlayer(context.sessionToken)

      await prisma.player.update({
        where: { id: player.id },
        data: { lobbyId: null }
      })

      publisher.publish(`lobby:${input.lobbyId}`, {
        type: 'playerLeft',
        playerId: player.id
      })

      return { success: true }
    }),

  subscribe: pub
    .input(z.object({ lobbyId: z.string() }))
    .handler(async function* ({ input, signal }) {
      for await (const event of publisher.subscribe(`lobby:${input.lobbyId}`, { signal })) {
        yield event
      }
    })
}
```

**Step 4: Verify — start dev server and test player.join**

Run:
```bash
bun dev
```

Open `http://localhost:3000` in a browser. Open DevTools Console and run:
```javascript
fetch('/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'player.join', input: { name: 'TestPlayer' } }) }).then(r => r.json()).then(console.log)
```
Expected: Response containing `id`, `name`, and `sessionToken` fields. If the exact wire format differs, verify by checking the Network tab — the key is that the dev server starts and oRPC accepts requests without errors.

**Step 5: Commit**

```bash
git add server/rpc/utils/auth.ts server/rpc/procedures/player.ts server/rpc/procedures/lobby.ts
git commit -m "feat: implement player.join and lobby procedures (create, join, leave, list, subscribe)"
```

---

### Task 4: Game Procedures + Map Generation

**Specialist:** backend-engineer
**Depends on:** Task 2 (for `server/rpc/base.ts`, `server/rpc/publisher.ts`, stub game file)
**Produces:** Functional `game.start` and `game.subscribe` procedures. Map generation utility at `server/rpc/utils/map.ts`. Unit test at `test/unit/map.test.ts`.

**Files:**
- Create: `server/rpc/utils/map.ts`
- Create: `test/unit/map.test.ts`
- Modify: `server/rpc/procedures/game.ts` (replace stub)

**Step 1: Write the failing test for map generation**

```typescript
// test/unit/map.test.ts
import { describe, it, expect } from 'vitest'
import { generateMap, type Tile, type TileType } from '../../server/rpc/utils/map'

describe('generateMap', () => {
  it('generates correct number of tiles', () => {
    const tiles = generateMap(10, 10)
    expect(tiles).toHaveLength(100)
  })

  it('generates tiles with valid types', () => {
    const validTypes: TileType[] = ['grass', 'water', 'mountain']
    const tiles = generateMap(5, 5)
    for (const tile of tiles) {
      expect(validTypes).toContain(tile.type)
    }
  })

  it('generates tiles with correct axial coordinates', () => {
    const tiles = generateMap(3, 4)
    expect(tiles).toHaveLength(12)
    expect(tiles[0]).toMatchObject({ q: 0, r: 0 })
    expect(tiles[11]).toMatchObject({ q: 2, r: 3 })
  })
})
```

**Step 2: Run test to verify it fails**

Run:
```bash
bun test:unit test/unit/map.test.ts
```
Expected: FAIL — module `../../server/rpc/utils/map` not found

**Step 3: Implement map generation utility**

```typescript
// server/rpc/utils/map.ts
export type TileType = 'grass' | 'water' | 'mountain'

export interface Tile {
  q: number
  r: number
  type: TileType
}

const TILE_TYPES: TileType[] = ['grass', 'water', 'mountain']

export function generateMap(width: number, height: number): Tile[] {
  const tiles: Tile[] = []
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      tiles.push({
        q,
        r,
        type: TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)]
      })
    }
  }
  return tiles
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
bun test:unit test/unit/map.test.ts
```
Expected: PASS — all 3 tests green

**Step 5: Implement game procedures**

Replace the contents of `server/rpc/procedures/game.ts`:

```typescript
// server/rpc/procedures/game.ts
import { z } from 'zod'
import prisma from '../../../lib/prisma'
import { pub } from '../base'
import { publisher } from '../publisher'
import { getPlayer } from '../utils/auth'
import { generateMap } from '../utils/map'

export const gameRouter = {
  start: pub
    .input(z.object({ lobbyId: z.string() }))
    .handler(async ({ input, context }) => {
      const player = await getPlayer(context.sessionToken)

      const lobby = await prisma.lobby.findUnique({
        where: { id: input.lobbyId }
      })
      if (!lobby) throw new Error('Lobby not found')
      if (lobby.hostId !== player.id) throw new Error('Only the host can start the game')
      if (lobby.status !== 'waiting') throw new Error('Game already started')

      const tiles = generateMap(10, 10)

      const game = await prisma.game.create({
        data: {
          lobbyId: input.lobbyId,
          mapData: JSON.stringify({ tiles })
        }
      })

      await prisma.lobby.update({
        where: { id: input.lobbyId },
        data: { status: 'playing' }
      })

      publisher.publish(`lobby:${input.lobbyId}`, {
        type: 'gameStarted',
        gameId: game.id
      })

      return { gameId: game.id }
    }),

  subscribe: pub
    .input(z.object({ gameId: z.string() }))
    .handler(async function* ({ input, signal }) {
      const game = await prisma.game.findUnique({
        where: { id: input.gameId }
      })
      if (!game) throw new Error('Game not found')

      yield {
        type: 'mapReady' as const,
        mapData: JSON.parse(game.mapData) as { tiles: Array<{ q: number; r: number; type: string }> }
      }

      for await (const event of publisher.subscribe(`game:${input.gameId}`, { signal })) {
        yield event
      }
    })
}
```

**Step 6: Run all unit tests**

Run:
```bash
bun test:unit
```
Expected: PASS

**Step 7: Commit**

```bash
git add server/rpc/utils/map.ts server/rpc/procedures/game.ts test/unit/map.test.ts
git commit -m "feat: implement game.start, game.subscribe, and map generation (10x10 hex grid)"
```

---

### Task 5: Entry Page + Lobby Pages

**Specialist:** vue-engineer
**Depends on:** Task 3 (for player/lobby procedures) AND Task 4 (lobby room calls `game.start`)
**Produces:** Working entry page at `/`, lobby list at `/lobbies`, lobby room at `/lobbies/:id`. Simplified `app.vue`. `LobbyPlayerList` component.

**Important context:** The oRPC client is available as `useNuxtApp().$orpc` (client-only plugin). All UI uses Nuxt UI components: `UButton`, `UInput`, `UCard`, `UBadge`, etc. Primary color is green, neutral is slate (configured in `app/app.config.ts`).

**Files:**
- Modify: `app/app.vue` (simplify for game)
- Modify: `app/pages/index.vue` (replace starter template)
- Create: `app/pages/lobbies/index.vue`
- Create: `app/pages/lobbies/[id].vue`
- Create: `app/components/LobbyPlayerList.vue`

**Step 1: Simplify app.vue**

Replace `app/app.vue` contents:

```vue
<template>
  <UApp>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
```

**Step 2: Build entry page — name input**

Replace `app/pages/index.vue` contents:

```vue
<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-6">
    <h1 class="text-4xl font-bold">Civ</h1>
    <form class="flex gap-2" @submit.prevent="join">
      <UInput
        v-model="name"
        placeholder="Your name"
        size="lg"
        required
      />
      <UButton type="submit" size="lg" :loading="loading">
        Join
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
const name = ref('')
const loading = ref(false)
const token = useCookie('session-token')
const playerId = useCookie('player-id')

async function join() {
  loading.value = true
  try {
    const { $orpc } = useNuxtApp()
    const result = await $orpc.player.join({ name: name.value })
    token.value = result.sessionToken
    playerId.value = result.id
    navigateTo('/lobbies')
  } finally {
    loading.value = false
  }
}
</script>
```

**Step 3: Build lobby list page**

```vue
<!-- app/pages/lobbies/index.vue -->
<template>
  <div class="max-w-xl mx-auto p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Lobbies</h1>
      <UButton :loading="creating" @click="create">
        Create Lobby
      </UButton>
    </div>

    <div class="space-y-2">
      <UCard
        v-for="lobby in lobbies"
        :key="lobby.id"
        class="cursor-pointer hover:ring-primary"
        @click="navigateTo(`/lobbies/${lobby.id}`)"
      >
        <div class="flex justify-between items-center">
          <span class="font-mono text-sm">{{ lobby.id.slice(0, 8) }}</span>
          <UBadge>{{ lobby.players.length }} players</UBadge>
        </div>
      </UCard>
    </div>

    <p v-if="lobbies && lobbies.length === 0" class="text-center text-gray-500 mt-8">
      No lobbies yet. Create one!
    </p>
  </div>
</template>

<script setup lang="ts">
const { $orpc } = useNuxtApp()
const creating = ref(false)
const lobbies = ref<Awaited<ReturnType<typeof $orpc.lobby.list>>>([])

onMounted(async () => {
  lobbies.value = await $orpc.lobby.list()
})

const refreshInterval = setInterval(async () => {
  lobbies.value = await $orpc.lobby.list()
}, 3000)

onUnmounted(() => clearInterval(refreshInterval))

async function create() {
  creating.value = true
  try {
    const lobby = await $orpc.lobby.create()
    navigateTo(`/lobbies/${lobby.id}`)
  } finally {
    creating.value = false
  }
}
</script>
```

**Step 4: Build LobbyPlayerList component**

```vue
<!-- app/components/LobbyPlayerList.vue -->
<template>
  <div class="space-y-1">
    <div
      v-for="player in players"
      :key="player.id"
      class="flex items-center gap-2 p-2 rounded"
    >
      <UBadge v-if="player.id === hostId" color="primary" size="xs">Host</UBadge>
      <span>{{ player.name }}</span>
    </div>
    <p v-if="players.length === 0" class="text-gray-500 text-sm">
      No players yet
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  players: Array<{ id: string; name: string }>
  hostId: string
}>()
</script>
```

**Step 5: Build lobby room page**

```vue
<!-- app/pages/lobbies/[id].vue -->
<template>
  <div class="max-w-xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">
      Lobby {{ (route.params.id as string).slice(0, 8) }}
    </h1>

    <UCard class="mb-4">
      <LobbyPlayerList :players="players" :host-id="hostId" />
    </UCard>

    <div class="flex gap-2">
      <UButton
        v-if="isHost"
        :disabled="players.length < 1"
        @click="startGame"
      >
        Start Game
      </UButton>
      <UButton color="neutral" variant="outline" @click="leaveLobby">
        Leave
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const lobbyId = route.params.id as string
const { $orpc } = useNuxtApp()
const token = useCookie('session-token')

const players = ref<Array<{ id: string; name: string }>>([])
const hostId = ref('')
const currentPlayerId = ref('')
const isHost = computed(() => currentPlayerId.value === hostId.value)

let subscriptionActive = true

onMounted(async () => {
  // Identify current player
  // We store player ID alongside session token
  const playerIdCookie = useCookie('player-id')
  currentPlayerId.value = playerIdCookie.value || ''

  // Join the lobby
  await $orpc.lobby.join({ lobbyId })

  // Load initial lobby state
  const lobbies = await $orpc.lobby.list()
  const lobby = lobbies.find((l: { id: string }) => l.id === lobbyId)
  if (lobby) {
    players.value = lobby.players
    hostId.value = lobby.hostId
  }

  // Subscribe to real-time updates
  try {
    const stream = await $orpc.lobby.subscribe({ lobbyId })
    for await (const event of stream) {
      if (!subscriptionActive) break

      if (event.type === 'playerJoined') {
        const existing = players.value.find(p => p.id === event.player.id)
        if (!existing) {
          players.value.push(event.player)
        }
      } else if (event.type === 'playerLeft') {
        players.value = players.value.filter(p => p.id !== event.playerId)
      } else if (event.type === 'gameStarted') {
        navigateTo(`/game/${event.gameId}`)
      }
    }
  } catch (e) {
    // Stream ended (navigation or unmount)
  }
})

onUnmounted(() => {
  subscriptionActive = false
})

async function startGame() {
  await $orpc.game.start({ lobbyId })
}

async function leaveLobby() {
  await $orpc.lobby.leave({ lobbyId })
  navigateTo('/lobbies')
}
</script>
```

**Step 6: Verify — manual testing**

Run:
```bash
bun dev
```

1. Open `http://localhost:3000` — enter name, click Join
2. Redirected to `/lobbies` — see empty list, click "Create Lobby"
3. Redirected to `/lobbies/:id` — see yourself in the player list with Host badge
4. Click "Leave" — redirected back to `/lobbies`

**Step 7: Commit**

```bash
git add app/app.vue app/pages/ app/components/LobbyPlayerList.vue
git commit -m "feat: add entry page, lobby list, and lobby room with real-time updates"
```

---

### Task 6: Game Page + HexMap Component

**Specialist:** vue-engineer
**Depends on:** Task 4 (for `game.subscribe`) AND Task 3 (for shared `getPlayer` auth used by game procedures)
**Produces:** Working game page at `/game/:id` that renders a 10x10 hex grid via vue3-pixi. `HexMap.vue` component.

**Important context:** vue3-pixi is configured via `vue3-pixi-nuxt` module (added in Task 1). Components `<Application>` and `<graphics>` are auto-imported. PixiJS v8 Graphics API: chainable methods (`clear()`, `regularPoly()`, `fill()`, `stroke()`). The oRPC client is at `useNuxtApp().$orpc`.

**Files:**
- Create: `app/components/HexMap.vue`
- Create: `app/pages/game/[id].vue`

**Step 1: Build HexMap component**

```vue
<!-- app/components/HexMap.vue -->
<template>
  <Application :width="800" :height="600" :background-color="0x1a1a2e">
    <graphics
      v-for="tile in tiles"
      :key="`${tile.q}-${tile.r}`"
      @render="(g: any) => drawHex(g, tile)"
    />
  </Application>
</template>

<script setup lang="ts">
interface Tile {
  q: number
  r: number
  type: 'grass' | 'water' | 'mountain'
}

defineProps<{
  tiles: Tile[]
}>()

const HEX_SIZE = 28
const OFFSET_X = 60
const OFFSET_Y = 60

const COLORS: Record<string, number> = {
  grass: 0x4ade80,
  water: 0x60a5fa,
  mountain: 0x9ca3af
}

function hexToPixel(q: number, r: number) {
  return {
    x: HEX_SIZE * (3 / 2) * q + OFFSET_X,
    y: HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) + OFFSET_Y
  }
}

function drawHex(g: any, tile: Tile) {
  const { x, y } = hexToPixel(tile.q, tile.r)
  g.clear()
  g.regularPoly(x, y, HEX_SIZE, 6)
  g.fill({ color: COLORS[tile.type] })
  g.stroke({ width: 1, color: 0x334155 })
}
</script>
```

**Step 2: Build game page**

```vue
<!-- app/pages/game/[id].vue -->
<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-950">
    <HexMap v-if="tiles" :tiles="tiles" />
    <div v-else class="text-white text-lg">Loading map...</div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const gameId = route.params.id as string
const { $orpc } = useNuxtApp()

const tiles = ref<Array<{ q: number; r: number; type: 'grass' | 'water' | 'mountain' }> | null>(null)

let active = true

onMounted(async () => {
  try {
    const stream = await $orpc.game.subscribe({ gameId })
    for await (const event of stream) {
      if (!active) break
      if (event.type === 'mapReady') {
        tiles.value = event.mapData.tiles
      }
    }
  } catch (e) {
    // Stream ended
  }
})

onUnmounted(() => {
  active = false
})
</script>
```

**Step 3: Verify — full flow manual test**

Run:
```bash
bun dev
```

Full test flow (use 2 browser tabs):

1. **Tab 1:** Go to `/` → enter name "Alice" → Join → Create Lobby
2. **Tab 2:** Go to `/` → enter name "Bob" → Join → see lobby in list → click it → see both players
3. **Tab 1:** Click "Start Game" → both tabs navigate to `/game/:id`
4. **Both tabs:** See the same 10x10 hex map with green/blue/gray hexagons

**Step 4: Commit**

```bash
git add app/components/HexMap.vue app/pages/game/
git commit -m "feat: add game page with PixiJS hex map rendering via vue3-pixi"
```

---

## Execution

Plan complete and saved to `docs/plans/2026-02-11-multiplayer-skeleton.md`.

**Recommended: Agent Team-Driven** — Parallel specialist agents, wave-based execution, two-stage review after each task. Waves 3 and 4 each have 2 parallel tasks.

**Alternative: Subagent-Driven** — Serial execution, simpler orchestration, no team overhead. Good fallback if oRPC or vue3-pixi integration issues require tight coordination.

Which approach?
