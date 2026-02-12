# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev                    # Start dev server (http://localhost:3000)
bun build                  # Production build
bun preview                # Preview production build
bun run lint               # ESLint
bun run typecheck          # nuxt typecheck (vue-tsc)
bun test                   # Run all tests (unit + nuxt)
bun test:unit              # Unit tests only (test/unit/)
bun test:nuxt              # Nuxt component tests only (test/nuxt/)
bun test:watch             # Tests in watch mode
bunx vitest test/unit/example.test.ts  # Run a single test file
```

## Architecture

**Nuxt 4 full-stack app** (SPA, `ssr: false`) with TypeScript, Tailwind CSS 4, Prisma ORM (SQLite), and oRPC.

### Directory Layout

- `app/` — Frontend: pages, components, composables, plugins, generated Prisma client
- `server/` — Backend: oRPC procedures, API handlers, utilities
  - `server/rpc/procedures/` — oRPC procedure files (player, lobby, game)
  - `server/rpc/base.ts` — Context types and auth middleware
  - `server/rpc/router.ts` — Combined router
  - `server/rpc/publisher.ts` — SSE event publisher for real-time updates
  - `server/utils/prisma.ts` — Prisma client singleton
- `prisma/` — Schema (`schema.prisma`), migrations, dev database (`dev.db`)
- `test/unit/` — Pure unit tests (node environment)
- `test/nuxt/` — Component/integration tests (nuxt environment, happy-dom)
- `docs/plans/` — Architecture and implementation plans

### Key Modules

Nuxt modules in `nuxt.config.ts`: `@nuxt/ui`, `@pinia/nuxt` + `@pinia/colada-nuxt` (state/data fetching), `@vueuse/nuxt`, `@formkit/auto-animate`, `@nuxt/image`, `@nuxt/scripts`.

### Database

- **Prisma 7** with SQLite via `better-sqlite3` adapter.
- Schema at `prisma/schema.prisma`, config at `prisma.config.ts`.
- Prisma client generated to `app/generated/prisma/` (set via `output` in schema).
- Connection singleton in `server/utils/prisma.ts` prevents connection leaks during dev hot-reload.
- `DATABASE_URL` set in `.env`.

### Testing

Two Vitest projects defined in `vitest.config.ts`:

- **unit** — `test/unit/*.{test,spec}.ts`, node environment
- **nuxt** — `test/nuxt/*.{test,spec}.ts`, nuxt environment with happy-dom. Uses `mountSuspended()` from `@nuxt/test-utils/runtime`.

### Styling

Tailwind CSS 4 with Nuxt UI. Custom color theme defined in `app/assets/css/main.css` (`@theme static` block). App-level UI colors (primary: green, neutral: slate) set in `app/app.config.ts`.

---

## Code Style

- **No `any` type.** Use `unknown`, generics, or proper types instead.
- **File naming:** all files in `kebab-case`.
- ESLint via `@nuxt/eslint` with stylistic rules: `commaDangle: 'never'`, `braceStyle: '1tbs'`
- 2-space indentation, LF line endings (`.editorconfig`)
- TypeScript throughout — all config files use `.ts`
- Components and composables are auto-imported by Nuxt

---

## oRPC Patterns

### Middleware Stack

Authentication is layered via oRPC middlewares in `server/rpc/base.ts`:

```text
publicProcedure (base context: sessionToken)
  -> authedProcedure (validates session, adds player to context)
    -> handler
```

When adding new middleware layers, follow this pattern:

```typescript
export const newMiddleware = authedProcedure.use(async ({ context, next }) => {
  // validation logic
  return next({ context: { ...extraContext } })
})
```

### Procedure Pattern

```typescript
// server/rpc/procedures/example.ts
import { authedProcedure } from '../base'
import { z } from 'zod'

export const exampleRouter = {
  create: authedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .handler(async ({ input, context: { player } }) => {
      // Always use typed context from middleware
      return prisma.example.create({ data: { ...input, playerId: player.id } })
    })
}
```

### Key Rules

1. Use `authedProcedure` for all player-facing endpoints, `publicProcedure` only for joining
2. Validate input with Zod schemas via `.input()`
3. Access `player` from context — never trust client-provided player IDs
4. Real-time updates via `EventPublisher` and SSE subscriptions

---

## Client-Side Patterns

### oRPC + Pinia Colada (`@orpc/vue-colada` adapter)

Two module-level singletons in `app/utils/rpc.ts` (auto-imported):

- **`orpc`** — Vue Colada utils with `.queryOptions()`, `.mutationOptions()`, `.key()` for all procedures. Use for reactive queries/mutations.
- **`rpcClient`** — raw oRPC client for imperative (non-reactive) calls, SSE subscriptions, etc.

No plugin needed — SPA mode means these are plain module singletons.

### Reactive Queries

```typescript
// orpc is auto-imported from app/utils/rpc.ts
const { data: lobbies, isPending } = useQuery(
  orpc.lobby.list.queryOptions({})
)

// Query with reactive input
const { data: lobby } = useQuery(
  orpc.lobby.get.queryOptions({
    input: computed(() => ({ lobbyId: route.params.id as string }))
  })
)
```

### Mutations with Cache Invalidation

```typescript
const queryCache = useQueryCache()

const { mutate: createLobby, isPending: isCreating } = useMutation(
  orpc.lobby.create.mutationOptions({
    onSuccess: () => {
      queryCache.invalidateQueries({ key: orpc.lobby.key() })
    }
  })
)
```

### Cache Invalidation via `.key()`

```typescript
const queryCache = useQueryCache()

// Invalidate all lobby queries
queryCache.invalidateQueries({ key: orpc.lobby.key() })

// Invalidate specific query
queryCache.invalidateQueries({
  key: orpc.lobby.get.key({ input: { lobbyId: '123' } })
})
```

### Composable Wrappers

Wrap queries/mutations in composables for reuse across components:

```typescript
// app/composables/lobbies.ts
export const useListLobbies = () => {
  return useQuery(orpc.lobby.list.queryOptions({}))
}

export const useCreateLobby = () => {
  const queryCache = useQueryCache()
  return useMutation(orpc.lobby.create.mutationOptions({
    onSuccess: () => queryCache.invalidateQueries({ key: orpc.lobby.key() })
  }))
}
```

### Direct RPC Calls (imperative / SSE subscriptions)

Use `rpcClient` for one-off calls and streaming subscriptions:

```typescript
// rpcClient is auto-imported from app/utils/rpc.ts
await rpcClient.lobby.join({ lobbyId })

// SSE subscription
const iterator = await rpcClient.lobby.subscribe(
  { lobbyId },
  { signal: abortController.signal }
)
for await (const event of iterator) { /* ... */ }
```

### Toast Notifications

```typescript
const toast = useToast()
toast.add({ title: 'Game started', color: 'success' })
toast.add({ title: 'Error', description: error.message, color: 'error' })
toast.add({ title: 'Warning', description: 'Host left', color: 'warning' })
```

---

## Vue Component Patterns

### Props & Emits

```typescript
interface Props {
  lobbyId: string
  isHost?: boolean
}

interface Emits {
  (e: 'close', result: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
```

### v-model with defineModel

```typescript
const model = defineModel<string>()
const search = defineModel<string>('search', { default: '' })
```

### Generic Components

```vue
<script setup lang="ts" generic="T extends { id: string }">
defineProps<{ items: T[] }>()
defineSlots<{ item: (props: { item: T }) => unknown }>()
</script>
```

---

## Form Patterns

Use `UForm` + `UFormField` + Zod schema for all forms:

```vue
<template>
  <UForm :state="state" :schema="schema" @submit="handleSubmit">
    <UFormField label="Name" name="name" required>
      <UInput v-model="state.name" />
    </UFormField>
    <UButton type="submit" :loading="isPending">Save</UButton>
  </UForm>
</template>

<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  name: z.string().min(1, 'Required').max(255)
})

type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({ name: '' })

const handleSubmit = (event: FormSubmitEvent<Schema>) => {
  const { data } = event
  // data is fully typed and validated
}
</script>
```

**Key rules:**

- Submit button inside `<UForm>` with `type="submit"`
- Cancel button uses `type="button"`
- Use `FormSubmitEvent<Schema>` for typed handler

---

## Modal Patterns

### Overlay Factory Composables

```typescript
// app/composables/modals.ts
import { LazyUiConfirmModal } from '#components'

export const useConfirmModal = (overlay: ReturnType<typeof useOverlay>) =>
  overlay.create(LazyUiConfirmModal)
```

### Usage

```typescript
const overlay = useOverlay()
const confirmModal = useConfirmModal(overlay)

async function handleLeave() {
  const instance = confirmModal.open({
    title: 'Leave lobby?',
    description: 'You will lose your spot.'
  })
  const confirmed = await instance.result
  if (confirmed) await rpc.lobby.leave()
}
```

### Modal Component Structure

```vue
<UModal :close="{ onClick: () => emit('close', false) }" :title="title">
  <template #body><!-- content --></template>
  <template #footer>
    <UButton variant="ghost" @click="emit('close', false)">Cancel</UButton>
    <UButton :loading="isLoading" @click="handleConfirm">Confirm</UButton>
  </template>
</UModal>
```

**Key rules:**

- Content in `#body` slot, actions in `#footer` slot
- Always emit `close` with result
- Use `Lazy` imports for code splitting
- Create overlay composables in `modals.ts`

---

## Prisma Error Handling

Wrap Prisma operations for consistent error handling:

```typescript
import { ORPCError } from '@orpc/server'

// In procedures — catch common Prisma errors
try {
  return await prisma.lobby.update({ where: { id }, data })
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new ORPCError('NOT_FOUND', { message: 'Lobby not found' })
    if (error.code === 'P2002') throw new ORPCError('CONFLICT', { message: 'Already exists' })
  }
  throw error
}
```

---

## Nuxt UI v4 Notes

API differs from v3. Always verify:

| v3 | v4 |
| --- | --- |
| `:options` | `:items` |
| `value-attribute` | `value-key` |
| `option-attribute` | `label-key` |

---

## Auto-Import Rules

### Auto-imported (no manual import needed)

| Source | Examples |
| --- | --- |
| `server/utils/*.ts` | `prisma` (default export) |
| `app/utils/*.ts` | `useORPC`, `useRpcClient` |
| `app/composables/` | custom composables |
| `app/components/` | All `.vue` components |
| Vue | `ref`, `computed`, `reactive`, `watch`, `onMounted` |
| VueUse | `useBreakpoints`, `createReusableTemplate` |
| Pinia Colada | `useQuery`, `useMutation`, `useQueryCache` |
| Nuxt UI | `useToast`, `useOverlay` |
| Nuxt | `definePageMeta`, `navigateTo`, `useRoute`, `useCookie` |

### Requires Manual Import

```typescript
// Prisma types
import type { Player, Lobby } from '~/generated/prisma/client'

// Zod
import { z } from 'zod'

// oRPC (server-side)
import { ORPCError } from '@orpc/server'
```
