FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat && corepack enable

COPY . ./

RUN pnpm install --frozen-lockfile

FROM deps AS build

RUN pnpm --filter @dexera/web build

FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache wget && \
    corepack enable && \
    addgroup -S app && \
    adduser -S -u 10001 -G app app

COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/packages ./packages

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=10 \
  CMD wget -qO- "http://127.0.0.1:3000" >/dev/null || exit 1

USER app

CMD ["pnpm", "--filter", "@dexera/web", "start"]
