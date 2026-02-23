FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bunx prisma generate && bun run build && rm -rf .output/server/node_modules

# ---

FROM oven/bun:1-slim AS runtime

WORKDIR /app

COPY --from=build /app/.output .output
COPY --from=build /app/prisma prisma
COPY --from=build /app/prisma.config.ts prisma.config.ts
COPY --from=build /app/node_modules node_modules

ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:./dev.db

EXPOSE 3000

CMD ["sh", "-c", "bunx prisma migrate deploy && bun .output/server/index.mjs"]
