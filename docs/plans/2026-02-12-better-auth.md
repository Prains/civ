# Better Auth Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use agent-team-driven-development to execute this plan.

**Goal:** Replace anonymous Player-based auth with Better Auth email/password authentication.

**Architecture:** Better Auth handles `/api/auth/*` via H3 catch-all route. oRPC middleware validates sessions through `auth.api.getSession()`. Frontend uses `@better-auth/vue` client. Player model replaced by Better Auth's User + new LobbyMember join table.

**Tech Stack:** better-auth, Prisma 7 (SQLite), oRPC, Nuxt 4 SPA, Vue 3

---

## Wave Analysis

### Specialists

| Role | Expertise | Model | Tasks |
|------|-----------|-------|-------|
| backend-engineer | Better Auth, Prisma, oRPC, H3 | sonnet | Tasks 1, 2, 4 |
| frontend-engineer | Vue 3, Nuxt 4, Better Auth Vue client | sonnet | Tasks 3, 5 |

### Waves

**Wave 1: Foundation** — core setup that everything depends on
- Task 1 (backend-engineer) — Install Better Auth, create config, update schema, create API route

**Wave 2: Core Integration** — needs Wave 1 for auth config and schema
- Task 2 (backend-engineer) — Update oRPC middleware and handlers
- Task 3 (frontend-engineer) — Create auth client, pages, middleware, update RPC plugin

  *Parallel-safe because:* Task 2 touches `server/rpc/` files only. Task 3 touches `app/` files only. No shared files. Note: `app/utils/rpc.ts` imports the router type from Task 2, but Task 3 does not depend on the new router shape — it only removes the session token header. Types reconcile at compile time after both tasks merge.
  *Depends on Wave 1:* `server/utils/auth.ts`, Prisma schema with User model

**Wave 3: Domain Updates** — needs Wave 2 for new context types and auth client
- Task 4 (backend-engineer) — Rewrite lobby procedures for LobbyMember + user context
- Task 5 (frontend-engineer) — Update frontend pages to use Better Auth session

  *Parallel-safe because:* Task 4 touches `server/rpc/procedures/lobby.ts` only. Task 5 touches `app/pages/` and `app/components/`. No shared files.
  *Depends on Wave 2:* Task 4 needs Task 2 (updated base context). Task 5 needs Task 3 (auth client).

### Dependency Graph

```
Task 1 ──→ Task 2 ──→ Task 4
       ──→ Task 3 ──→ Task 5
```

---

### Task 1: Install Better Auth + Schema + API Route

**Specialist:** backend-engineer
**Depends on:** None
**Produces:** `better-auth` package installed, `server/utils/auth.ts`, `server/api/auth/[...all].ts`, updated Prisma schema with User/Session/Account/Verification/LobbyMember models, `.env` with auth secrets

**Files:**
- Modify: `package.json` (via bun add)
- Modify: `.env`
- Create: `server/utils/auth.ts`
- Create: `server/api/auth/[...all].ts`
- Modify: `prisma/schema.prisma`

**Step 1: Install better-auth**

Run: `bun add better-auth`

**Step 2: Add environment variables**

Append to `.env`:

```
BETTER_AUTH_SECRET="<run: openssl rand -base64 32>"
BETTER_AUTH_URL="http://localhost:3000"
```

Run: `openssl rand -base64 32` and paste the output as the secret value.

**Step 3: Create Better Auth server config**

Create `server/utils/auth.ts`:

```typescript
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from './prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  }
})
```

**Step 4: Create auth API route handler**

Create `server/api/auth/[...all].ts`:

```typescript
import { toWebRequest } from 'h3'
import { auth } from '../../utils/auth'

export default defineEventHandler((event) => {
  return auth.handler(toWebRequest(event))
})
```

**Step 5: Generate Better Auth schema additions**

Run: `bunx @better-auth/cli generate --config server/utils/auth.ts`

This adds User, Session, Account, Verification models to `prisma/schema.prisma`. The existing `prisma.config.ts` is picked up automatically.

If the CLI fails or does not produce expected output, manually add these models to the schema:

```prisma
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime? @default(now())
  updatedAt  DateTime? @updatedAt
}
```

**Step 6: Manually update Prisma schema**

After the CLI runs, edit `prisma/schema.prisma` to:
1. Remove the entire `Player` model
2. Remove the `players Player[]` relation from `Lobby`
3. Add `LobbyMember` model
4. Add `members LobbyMember[]` relation to `Lobby`
5. Add `lobbyMembers LobbyMember[]` relation to `User`

The `LobbyMember` model to add:

```prisma
model LobbyMember {
  id       String   @id @default(cuid())
  lobbyId  String
  lobby    Lobby    @relation(fields: [lobbyId], references: [id], onDelete: Cascade)
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt DateTime @default(now())

  @@unique([lobbyId, userId])
}
```

The `Lobby` model should look like:

```prisma
model Lobby {
  id        String        @id @default(cuid())
  hostId    String
  status    String        @default("waiting")
  createdAt DateTime      @default(now())
  members   LobbyMember[]
  game      Game?
}
```

Add to the `User` model (generated by CLI):

```prisma
  lobbyMembers LobbyMember[]
```

**Step 7: Push schema to database**

Run: `bunx prisma db push`

Accept data loss when prompted (dev database, Player table being dropped).

**Step 8: Regenerate Prisma client**

Run: `bunx prisma generate`

**Step 9: Verify**

Run: `bun run typecheck`

Expected: No errors related to schema. There will be errors in files still referencing `Player` — those are fixed in later tasks.

**Step 10: Commit**

Note: `.env` is gitignored — do not commit it. The secret stays local.

```bash
git add package.json bun.lockb server/utils/auth.ts server/api/auth/\[...all\].ts prisma/schema.prisma app/generated/
git commit -m "feat: add Better Auth with Prisma adapter and LobbyMember schema"
```

---

### Task 2: Update oRPC Backend Layer

**Specialist:** backend-engineer
**Depends on:** Task 1 (auth config at `server/utils/auth.ts`, Prisma schema with User model)
**Produces:** Updated `server/rpc/base.ts` with Better Auth session validation, updated `server/api/rpc/[...].ts` passing headers, updated router without playerRouter, updated game procedure

**Files:**
- Modify: `server/rpc/base.ts`
- Modify: `server/api/rpc/[...].ts`
- Modify: `server/rpc/router.ts`
- Delete: `server/rpc/procedures/player.ts`
- Modify: `server/rpc/procedures/game.ts`

**Step 1: Update oRPC base context and middleware**

Replace the entire contents of `server/rpc/base.ts`:

```typescript
import { ORPCError, os } from '@orpc/server'
import { auth } from '../utils/auth'

type AuthSession = typeof auth.$Infer.Session

export interface BaseContext {
  headers: Headers
}

export interface AuthedContext extends BaseContext {
  user: AuthSession['user']
  session: AuthSession['session']
}

export const publicProcedure = os.$context<BaseContext>()

export const authedProcedure = publicProcedure.use(async ({ context, next }) => {
  const session = await auth.api.getSession({
    headers: context.headers
  })

  if (!session) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Not authenticated' })
  }

  return next({ context: { user: session.user, session: session.session } })
})
```

**Step 2: Update oRPC API handler to pass headers**

Replace the entire contents of `server/api/rpc/[...].ts`:

```typescript
import { RPCHandler } from '@orpc/server/fetch'
import { toWebRequest } from 'h3'
import { router } from '../../rpc/router'
import type { BaseContext } from '../../rpc/base'

const handler = new RPCHandler(router)

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)

  const { matched, response } = await handler.handle(request, {
    prefix: '/api/rpc',
    context: {
      headers: request.headers
    } satisfies BaseContext
  })

  if (matched) {
    return response
  }

  throw createError({ statusCode: 404, message: 'Not found' })
})
```

**Step 3: Remove player router and update router**

Delete `server/rpc/procedures/player.ts`.

Replace the entire contents of `server/rpc/router.ts`:

```typescript
import { lobbyRouter } from './procedures/lobby'
import { gameRouter } from './procedures/game'

export { type BaseContext, type AuthedContext } from './base'

export const router = {
  lobby: lobbyRouter,
  game: gameRouter
}
```

**Step 4: Update game procedure**

In `server/rpc/procedures/game.ts`, change `context.player` to `context.user`:

Replace:
```typescript
    if (lobby.hostId !== context.player.id) {
```
With:
```typescript
    if (lobby.hostId !== context.user.id) {
```

Remove the `Player` import at the top if present (there isn't one currently, but verify).

**Step 5: Commit**

```bash
git add server/rpc/base.ts server/api/rpc/ server/rpc/router.ts server/rpc/procedures/game.ts
git rm server/rpc/procedures/player.ts
git commit -m "feat: integrate Better Auth session validation into oRPC middleware"
```

---

### Task 3: Auth Client + Auth Pages + Middleware

**Specialist:** frontend-engineer
**Depends on:** Task 1 (Better Auth installed, auth API route at `/api/auth/*`)
**Produces:** `app/utils/auth-client.ts`, `app/pages/auth/sign-in.vue`, `app/pages/auth/sign-up.vue`, updated `app/plugins/rpc.client.ts`, `app/middleware/auth.global.ts`, updated `app/pages/index.vue`

**Files:**
- Create: `app/utils/auth-client.ts`
- Modify: `app/plugins/rpc.client.ts`
- Create: `app/middleware/auth.global.ts`
- Create: `app/pages/auth/sign-in.vue`
- Create: `app/pages/auth/sign-up.vue`
- Modify: `app/pages/index.vue`
- Delete: `app/composables/player.ts`

**Step 1: Create Better Auth Vue client**

Create `app/utils/auth-client.ts`:

```typescript
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient()
```

**Step 2: Update RPC plugin — remove manual session token**

Replace the entire contents of `app/plugins/rpc.client.ts`:

```typescript
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RpcClient } from '~/utils/rpc'

export default defineNuxtPlugin(() => {
  const link = new RPCLink({
    url: `${window.location.origin}/api/rpc`,
    fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: 'include' })
  })

  const rpc: RpcClient = createORPCClient(link)

  return {
    provide: {
      rpc
    }
  }
})
```

Note: `credentials: 'include'` ensures the Better Auth session cookie is sent with every RPC request.

**Step 3: Create global auth middleware**

Create `app/middleware/auth.global.ts`:

```typescript
export default defineNuxtRouteMiddleware(async (to) => {
  const session = authClient.useSession()

  // On first load, wait for session fetch to complete
  if (session.isPending.value) {
    await until(session.isPending).toBe(false)
  }

  const isAuthenticated = !!session.data.value

  const publicRoutes = ['/auth/sign-in', '/auth/sign-up']

  if (!isAuthenticated && !publicRoutes.includes(to.path)) {
    return navigateTo('/auth/sign-in')
  }

  if (isAuthenticated && [...publicRoutes, '/'].includes(to.path)) {
    return navigateTo('/lobbies')
  }
})
```

Note: Uses `useSession()` (cached/reactive) instead of `getSession()` (network request) to avoid a server round-trip on every navigation. The `until()` helper is from VueUse (auto-imported via `@vueuse/nuxt`).

**Step 4: Create sign-up page**

Create `app/pages/auth/sign-up.vue`:

```vue
<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: '',
  email: '',
  password: ''
})

const error = ref('')
const loading = ref(false)

async function handleSubmit(event: FormSubmitEvent<Schema>) {
  error.value = ''
  loading.value = true

  try {
    const { error: authError } = await authClient.signUp.email({
      name: event.data.name,
      email: event.data.email,
      password: event.data.password
    })

    if (authError) {
      error.value = authError.message ?? 'Sign up failed'
      return
    }

    await navigateTo('/lobbies')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Sign up failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-bold text-center">
          Sign Up
        </h1>
      </template>

      <UForm
        :state="state"
        :schema="schema"
        class="flex flex-col gap-4"
        @submit="handleSubmit"
      >
        <UFormField label="Name" name="name" required>
          <UInput v-model="state.name" placeholder="Your name" autofocus />
        </UFormField>

        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" placeholder="you@example.com" />
        </UFormField>

        <UFormField label="Password" name="password" required>
          <UInput v-model="state.password" type="password" placeholder="Min 8 characters" />
        </UFormField>

        <p v-if="error" class="text-sm text-red-500">
          {{ error }}
        </p>

        <UButton type="submit" label="Sign Up" size="lg" block :loading="loading" />

        <p class="text-sm text-center text-neutral-500">
          Already have an account?
          <NuxtLink to="/auth/sign-in" class="text-primary hover:underline">
            Sign in
          </NuxtLink>
        </p>
      </UForm>
    </UCard>
  </div>
</template>
```

**Step 5: Create sign-in page**

Create `app/pages/auth/sign-in.vue`:

```vue
<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email: '',
  password: ''
})

const error = ref('')
const loading = ref(false)

async function handleSubmit(event: FormSubmitEvent<Schema>) {
  error.value = ''
  loading.value = true

  try {
    const { error: authError } = await authClient.signIn.email({
      email: event.data.email,
      password: event.data.password
    })

    if (authError) {
      error.value = authError.message ?? 'Invalid credentials'
      return
    }

    await navigateTo('/lobbies')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Sign in failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-bold text-center">
          Sign In
        </h1>
      </template>

      <UForm
        :state="state"
        :schema="schema"
        class="flex flex-col gap-4"
        @submit="handleSubmit"
      >
        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" placeholder="you@example.com" autofocus />
        </UFormField>

        <UFormField label="Password" name="password" required>
          <UInput v-model="state.password" type="password" />
        </UFormField>

        <p v-if="error" class="text-sm text-red-500">
          {{ error }}
        </p>

        <UButton type="submit" label="Sign In" size="lg" block :loading="loading" />

        <p class="text-sm text-center text-neutral-500">
          Don't have an account?
          <NuxtLink to="/auth/sign-up" class="text-primary hover:underline">
            Sign up
          </NuxtLink>
        </p>
      </UForm>
    </UCard>
  </div>
</template>
```

**Step 6: Update index page**

Replace the entire contents of `app/pages/index.vue`:

```vue
<script setup lang="ts">
// Auth middleware handles redirect to /lobbies or /auth/sign-in
await navigateTo('/lobbies')
</script>

<template>
  <div />
</template>
```

**Step 7: Delete player composable**

Delete `app/composables/player.ts`.

**Step 8: Commit**

```bash
git add app/utils/auth-client.ts app/plugins/rpc.client.ts app/middleware/auth.global.ts app/pages/auth/ app/pages/index.vue
git rm app/composables/player.ts
git commit -m "feat: add Better Auth frontend with sign-in/sign-up pages and auth middleware"
```

---

### Task 4: Rewrite Lobby Procedures

**Specialist:** backend-engineer
**Depends on:** Task 1 (LobbyMember model in Prisma schema), Task 2 (updated `authedProcedure` with `context.user`)
**Produces:** Updated `server/rpc/procedures/lobby.ts` using LobbyMember table and user context

**Files:**
- Modify: `server/rpc/procedures/lobby.ts`

Note: `server/rpc/publisher.ts` needs NO changes — the `LobbyEvent` types (`playerJoined`, `playerLeft`, `gameStarted`) use `{ id: string, name: string }` which is compatible with both the old Player and new User shapes.

**Step 1: Rewrite lobby procedures**

Replace the entire contents of `server/rpc/procedures/lobby.ts`:

```typescript
import { z } from 'zod'
import { ORPCError } from '@orpc/server'
import { publicProcedure, authedProcedure } from '../base'
import { publisher } from '../publisher'
import prisma from '../../utils/prisma'

const get = publicProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async ({ input }) => {
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true } } }
        }
      }
    })

    if (!lobby) {
      throw new ORPCError('NOT_FOUND', { message: 'Lobby not found' })
    }

    return {
      id: lobby.id,
      hostId: lobby.hostId,
      status: lobby.status,
      createdAt: lobby.createdAt,
      players: lobby.members.map(m => ({ id: m.user.id, name: m.user.name }))
    }
  })

const list = publicProcedure
  .handler(async () => {
    const lobbies = await prisma.lobby.findMany({
      where: { status: 'waiting' },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' }
    })

    return lobbies.map(lobby => ({
      id: lobby.id,
      hostId: lobby.hostId,
      playerCount: lobby._count.members,
      createdAt: lobby.createdAt
    }))
  })

const create = authedProcedure
  .handler(async ({ context }) => {
    const { user } = context

    const existingMembership = await prisma.lobbyMember.findFirst({
      where: { userId: user.id, lobby: { status: 'waiting' } }
    })

    if (existingMembership) {
      throw new ORPCError('BAD_REQUEST', { message: 'Already in a lobby' })
    }

    const lobby = await prisma.$transaction(async (tx) => {
      const created = await tx.lobby.create({
        data: { hostId: user.id }
      })

      await tx.lobbyMember.create({
        data: { lobbyId: created.id, userId: user.id }
      })

      return tx.lobby.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          members: {
            include: { user: { select: { id: true, name: true } } }
          }
        }
      })
    })

    return {
      id: lobby.id,
      hostId: lobby.hostId,
      status: lobby.status,
      createdAt: lobby.createdAt,
      players: lobby.members.map(m => ({ id: m.user.id, name: m.user.name }))
    }
  })

const join = authedProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async ({ input, context }) => {
    const { user } = context

    const existingMembership = await prisma.lobbyMember.findFirst({
      where: { userId: user.id, lobby: { status: 'waiting' } }
    })

    if (existingMembership) {
      throw new ORPCError('BAD_REQUEST', { message: 'Already in a lobby' })
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId }
    })

    if (!lobby || lobby.status !== 'waiting') {
      throw new ORPCError('NOT_FOUND', { message: 'Lobby not found or not accepting players' })
    }

    await prisma.lobbyMember.create({
      data: { lobbyId: input.lobbyId, userId: user.id }
    })

    publisher.publish(`lobby:${input.lobbyId}`, {
      type: 'playerJoined',
      player: { id: user.id, name: user.name }
    })

    return { success: true }
  })

const leave = authedProcedure
  .handler(async ({ context }) => {
    const { user } = context

    const membership = await prisma.lobbyMember.findFirst({
      where: { userId: user.id, lobby: { status: 'waiting' } }
    })

    if (!membership) {
      throw new ORPCError('BAD_REQUEST', { message: 'Not in a lobby' })
    }

    const lobbyId = membership.lobbyId

    await prisma.lobbyMember.delete({
      where: { id: membership.id }
    })

    publisher.publish(`lobby:${lobbyId}`, {
      type: 'playerLeft',
      playerId: user.id
    })

    return { success: true }
  })

const subscribe = publicProcedure
  .input(z.object({ lobbyId: z.string() }))
  .handler(async function* ({ input, signal }) {
    for await (const event of publisher.subscribe(`lobby:${input.lobbyId}`, { signal })) {
      yield event
    }
  })

export const lobbyRouter = {
  get,
  list,
  create,
  join,
  leave,
  subscribe
}
```

**Step 2: Verify compilation**

Run: `bun run typecheck`

Expected: No errors in `server/rpc/procedures/lobby.ts`. There may still be errors in frontend files — those are fixed in Task 5.

**Step 3: Commit**

```bash
git add server/rpc/procedures/lobby.ts
git commit -m "feat: rewrite lobby procedures for LobbyMember + Better Auth user context"
```

---

### Task 5: Update Frontend Pages

**Specialist:** frontend-engineer
**Depends on:** Task 3 (`authClient` at `app/utils/auth-client.ts`, auth middleware)
**Produces:** Updated lobby and game pages using Better Auth session instead of cookies

**Files:**
- Modify: `app/pages/lobbies/index.vue`
- Modify: `app/pages/lobbies/[id].vue`
- Modify: `app/pages/game/[id].vue`

Note: `app/components/LobbyPlayerList.vue` and `app/composables/lobbies.ts` and `app/composables/game.ts` need NO changes — their types are inferred from the router and the data shape stays compatible.

**Step 1: Update lobbies list page**

Replace the entire contents of `app/pages/lobbies/index.vue`:

```vue
<script setup lang="ts">
const { data: session } = authClient.useSession()
const { data: lobbies, isPending: loading } = useListLobbies()
const { mutateAsync: createLobbyAsync, isLoading: creating } = useCreateLobby()
const { mutateAsync: joinLobbyAsync } = useJoinLobby()

async function createLobby() {
  const lobby = await createLobbyAsync()
  await navigateTo(`/lobbies/${lobby.id}`)
}

async function joinLobby(lobbyId: string) {
  await joinLobbyAsync({ lobbyId })
  await navigateTo(`/lobbies/${lobbyId}`)
}

async function handleSignOut() {
  await authClient.signOut()
  await navigateTo('/auth/sign-in')
}
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">
          Lobbies
        </h1>
        <UBadge v-if="session?.user" variant="subtle">
          {{ session.user.name }}
        </UBadge>
      </div>
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-plus"
          label="Create Lobby"
          :loading="creating"
          @click="createLobby"
        />
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          @click="handleSignOut"
        />
      </div>
    </div>

    <div
      v-if="loading"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader"
        class="size-8 animate-spin text-neutral-400"
      />
    </div>

    <div
      v-else-if="(lobbies ?? []).length === 0"
      class="py-12 text-center text-neutral-500"
    >
      No lobbies available. Create one to get started.
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="lobby in lobbies ?? []"
        :key="lobby.id"
        class="cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
        @click="joinLobby(lobby.id)"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              Lobby
            </p>
            <p class="text-sm text-neutral-500">
              {{ lobby.id.slice(0, 8) }}
            </p>
          </div>
          <UBadge variant="subtle">
            {{ lobby.playerCount }} {{ lobby.playerCount === 1 ? 'player' : 'players' }}
          </UBadge>
        </div>
      </UCard>
    </div>
  </div>
</template>
```

**Step 2: Update lobby room page**

Replace the entire contents of `app/pages/lobbies/[id].vue`:

```vue
<script setup lang="ts">
const { data: session } = authClient.useSession()

const route = useRoute()
const lobbyId = route.params.id as string

const { data: lobby, isPending: loading } = useGetLobby(lobbyId)

const players = ref<Array<{ id: string, name: string }>>([])
const hostId = ref('')

watch(lobby, (val) => {
  if (val) {
    hostId.value = val.hostId
    players.value = val.players
  }
}, { immediate: true })

const client = useRpcClient()
const abortController = new AbortController()

async function subscribeToLobby() {
  try {
    const iterator = await client.lobby.subscribe(
      { lobbyId },
      { signal: abortController.signal }
    )

    for await (const event of iterator) {
      if (event.type === 'playerJoined') {
        const exists = players.value.some(p => p.id === event.player.id)
        if (!exists) {
          players.value.push(event.player)
        }
      } else if (event.type === 'playerLeft') {
        players.value = players.value.filter(p => p.id !== event.playerId)
      } else if (event.type === 'gameStarted') {
        await navigateTo(`/game/${event.gameId}`)
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Subscription error:', err)
    }
  }
}

const { mutateAsync: startGameAsync } = useStartGame()
const { mutateAsync: leaveLobbyAsync } = useLeaveLobby()

async function handleStart() {
  const result = await startGameAsync({ lobbyId })
  await navigateTo(`/game/${result.gameId}`)
}

async function handleLeave() {
  await leaveLobbyAsync()
  await navigateTo('/lobbies')
}

const isHost = computed(() => session.value?.user.id === hostId.value)

onMounted(() => {
  subscribeToLobby()
})

onUnmounted(() => {
  abortController.abort()
})
</script>

<template>
  <div class="mx-auto max-w-2xl p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">
          Lobby Room
        </h1>
        <p class="text-sm text-neutral-500">
          {{ lobbyId.slice(0, 8) }}
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="isHost"
          icon="i-lucide-play"
          label="Start Game"
          @click="handleStart"
        />
        <UButton
          icon="i-lucide-log-out"
          label="Leave"
          color="neutral"
          variant="outline"
          @click="handleLeave"
        />
      </div>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">
            Players
          </h2>
          <UBadge variant="subtle">
            {{ players.length }}
          </UBadge>
        </div>
      </template>

      <div
        v-if="loading"
        class="flex justify-center py-4"
      >
        <UIcon
          name="i-lucide-loader"
          class="size-6 animate-spin text-neutral-400"
        />
      </div>

      <div
        v-else-if="players.length === 0"
        class="py-4 text-center text-neutral-500"
      >
        Waiting for players...
      </div>

      <LobbyPlayerList
        v-else
        :players="players"
        :host-id="hostId"
      />
    </UCard>
  </div>
</template>
```

**Step 3: Update game page**

Replace the entire contents of `app/pages/game/[id].vue`:

```vue
<script setup lang="ts">
const route = useRoute()
const gameId = route.params.id as string

interface Tile {
  q: number
  r: number
  type: 'grass' | 'water' | 'mountain'
}

const tiles = ref<Tile[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const client = useRpcClient()
  const controller = new AbortController()

  onBeforeUnmount(() => {
    controller.abort()
  })

  try {
    const iterator = await client.game.subscribe({ gameId }, {
      signal: controller.signal
    })

    for await (const event of iterator) {
      if (event.type === 'mapReady') {
        tiles.value = event.mapData.tiles as Tile[]
        loading.value = false
      }
    }
  } catch (e: unknown) {
    if (controller.signal.aborted) return
    error.value = e instanceof Error ? e.message : 'Connection lost'
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 p-4">
    <h1 class="text-2xl font-bold">
      Game
    </h1>

    <div v-if="error" class="text-red-500">
      {{ error }}
    </div>

    <div v-else-if="loading" class="flex items-center gap-2">
      <UIcon name="i-lucide-loader-2" class="animate-spin" />
      <span>Loading map...</span>
    </div>

    <ClientOnly v-else>
      <HexMap :tiles="tiles" />
    </ClientOnly>
  </div>
</template>
```

**Step 4: Verify full build**

Run: `bun run typecheck`

Expected: PASS — no type errors.

Run: `bun run lint`

Expected: PASS — no lint errors.

**Step 5: Commit**

```bash
git add app/pages/lobbies/index.vue app/pages/lobbies/\[id\].vue app/pages/game/\[id\].vue
git commit -m "feat: update frontend pages to use Better Auth session"
```

---

## Smoke Test

After all tasks complete, verify the full flow:

1. Run: `bun dev`
2. Open `http://localhost:3000` — should redirect to `/auth/sign-in`
3. Click "Sign up" link → go to `/auth/sign-up`
4. Enter name, email, password → submit → redirect to `/lobbies`
5. Click "Create Lobby" → navigate to lobby room
6. Open a second browser/incognito → sign up with different account → join the lobby
7. Verify player list shows both users
8. Host clicks "Start Game" → both users navigate to game page
9. Click sign-out button → redirect to `/auth/sign-in`
10. Try accessing `/lobbies` directly → redirect to `/auth/sign-in`

---

## Execution

Plan complete and saved to `docs/plans/2026-02-12-better-auth.md`.

**Recommended: Agent Team-Driven** — Parallel specialist agents, wave-based execution.

**Alternative: Subagent-Driven** — Serial execution, simpler orchestration.
