# DocMax Worker (BullMQ consumer, HTTP server yo'q) — pnpm workspace'dan multi-stage build.
# Build kontekst repo ILDIZI: docker build -f apps/worker/Dockerfile .

FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++ \
  && npm install -g pnpm@11.11.0
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @docmax/shared build
RUN pnpm --filter @docmax/db build
RUN pnpm --filter @docmax/worker build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app

# Portsiz — standalone application context (TZ-0 §1, HANDOFF.md §3). Migratsiyalarni
# api konteyneri qo'llaydi; worker faqat DB tayyor bo'lishini kutadi (docker-compose depends_on).
CMD ["node", "apps/worker/dist/main.js"]
