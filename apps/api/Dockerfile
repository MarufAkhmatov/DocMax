# DocMax API (NestJS) — pnpm workspace'dan multi-stage build.
# Build kontekst repo ILDIZI bo'lishi shart (monorepo — @docmax/shared va @docmax/db
# workspace bog'liqliklari kerak): docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
# argon2 ba'zi node/alpine kombinatsiyalarida prebuilt binary topa olmasa manba'dan
# qurishga to'g'ri keladi (node-gyp) — shu uchun build vositalari.
RUN apk add --no-cache python3 make g++ \
  && npm install -g pnpm@11.11.0
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @docmax/shared build
RUN pnpm --filter @docmax/db build
RUN pnpm --filter @docmax/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

EXPOSE 3001
# Ishga tushishdan oldin migratsiyalarni qo'llaydi (DATABASE_URL — jadval egasi roli bilan
# beriladi, docker-compose.yml'da). packages/db'ning o'z devDependency'si sifatidagi prisma
# CLI'ga to'g'ridan-to'g'ri yo'l orqali murojaat qilinadi — pnpm hoisting nozikliklariga bog'liq emas.
CMD ["sh", "-c", "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/main.js"]
