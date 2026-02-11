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

**Nuxt 4 full-stack app** with TypeScript, Tailwind CSS 4, and Prisma ORM (SQLite).

### Directory Layout

- `app/` — Frontend: pages, components, assets, generated Prisma client
- `lib/` — Shared utilities (e.g., Prisma singleton at `lib/prisma.ts`)
- `prisma/` — Schema (`schema.prisma`), migrations, dev database (`dev.db`)
- `test/unit/` — Pure unit tests (node environment)
- `test/nuxt/` — Component/integration tests (nuxt environment, happy-dom)

### Key Modules

Nuxt modules configured in `nuxt.config.ts`: `@nuxt/ui` (UI components), `@prisma/nuxt` (database), `@pinia/nuxt` + `@pinia/colada-nuxt` (state/data fetching), `@vueuse/nuxt`, `@formkit/auto-animate`, `@nuxt/image`, `@nuxt/scripts`.

### Database

- **Prisma** with SQLite. Schema at `prisma/schema.prisma`, config at `prisma.config.ts`.
- Prisma client is generated to `app/generated/prisma/` (set via `output` in schema).
- Connection singleton in `lib/prisma.ts` prevents connection leaks during dev hot-reload.
- `DATABASE_URL` set in `.env`.

### Testing

Two Vitest projects defined in `vitest.config.ts`:
- **unit** — `test/unit/*.{test,spec}.ts`, node environment
- **nuxt** — `test/nuxt/*.{test,spec}.ts`, nuxt environment with happy-dom. Uses `mountSuspended()` from `@nuxt/test-utils/runtime`.

### Styling

Tailwind CSS 4 with Nuxt UI. Custom color theme defined in `app/assets/css/main.css` (`@theme static` block). App-level UI colors (primary: green, neutral: slate) set in `app/app.config.ts`.

## Code Style

- ESLint via `@nuxt/eslint` with stylistic rules: `commaDangle: 'never'`, `braceStyle: '1tbs'`
- 2-space indentation, LF line endings (`.editorconfig`)
- TypeScript throughout — all config files use `.ts`
- Components and composables are auto-imported by Nuxt
