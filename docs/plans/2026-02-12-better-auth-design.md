# Better Auth Integration Design

## Goal

Replace the current anonymous Player-based auth with Better Auth — a TypeScript-first auth framework. Email/password sign-in now, with Google OAuth, guilds (organization plugin), and admin panel planned for later.

## Architecture

Better Auth runs as a standalone handler at `/api/auth/*` in Nuxt's server routes. It manages its own tables (`user`, `session`, `account`, `verification`) via the Prisma adapter.

oRPC's `authedProcedure` validates sessions through `auth.api.getSession()` using HTTP-only cookies set by Better Auth. No manual token headers needed.

Frontend uses `@better-auth/vue` client with `useSession()` for reactive auth state.

## Key Decisions

- **Player model removed.** Better Auth's `user` table replaces it.
- **LobbyMember join table** separates game state from auth. No game-specific fields on `user`.
- **Email/password only** for now. No email verification (can add later).
- **HTTP-only cookies** managed by Better Auth replace the manual `x-session-token` header.

## Database Schema Changes

### New tables (Better Auth managed)

- `user` — id, name, email, emailVerified, image, createdAt, updatedAt
- `session` — id, expiresAt, token, ipAddress, userAgent, userId
- `account` — id, accountId, providerId, userId, accessToken, refreshToken, etc.
- `verification` — id, identifier, value, expiresAt, createdAt, updatedAt

### Modified tables

- `Lobby` — `hostId` stays as String (now references `user.id`), `players` relation removed
- `LobbyMember` — new join table: `{ id, lobbyId, userId, joinedAt }`

### Deleted tables

- `Player` — fully replaced by `user`

## File Changes

### New files

- `server/utils/auth.ts` — Better Auth config (Prisma adapter, email/password, secret)
- `server/routes/auth/[...all].ts` — Catch-all route delegating to Better Auth
- `app/utils/auth-client.ts` — `createAuthClient()` for frontend
- `app/pages/auth/sign-in.vue` — Sign-in page
- `app/pages/auth/sign-up.vue` — Sign-up page
- `app/middleware/auth.global.ts` — Redirects unauthenticated users

### Modified files

- `prisma/schema.prisma` — Remove Player, add Better Auth tables + LobbyMember
- `server/rpc/base.ts` — authedProcedure uses `auth.api.getSession()`
- `server/api/rpc/[...].ts` — Pass headers to oRPC context
- `app/plugins/rpc.client.ts` — Remove manual session token header
- `app/pages/index.vue` — Redirect based on session
- `app/pages/lobbies/*.vue`, `app/pages/game/*.vue` — player → user
- `server/rpc/procedures/lobby.ts` — Use user.id, LobbyMember table
- `server/rpc/procedures/player.ts` — Remove join procedure
- `server/rpc/publisher.ts` — Update event types

### Deleted files

- `app/composables/player.ts` — useJoinPlayer no longer needed

## Auth Flows

### Sign-up

1. `/auth/sign-up` → enter name, email, password
2. `authClient.signUp.email()` → Better Auth creates user + account + session
3. HTTP-only cookie set → redirect to `/lobbies`

### Sign-in

1. `/auth/sign-in` → enter email, password
2. `authClient.signIn.email()` → validates, creates session
3. Cookie set → redirect to `/lobbies`

### Session validation (oRPC)

Request → extract headers → authedProcedure calls `auth.api.getSession({ headers })` → context gets `{ user }` → handler proceeds

### Client-side middleware

- Public routes: `/auth/sign-in`, `/auth/sign-up`, `/`
- All other routes require active session → redirect to sign-in

### Sign-out

`authClient.signOut()` → clears session + cookie → redirect to `/auth/sign-in`
