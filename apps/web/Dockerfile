# DocMax Web (Vite + React SPA) — pnpm workspace'dan multi-stage build, statik fayllar
# nginx orqali xizmat qiladi. Build kontekst repo ILDIZI: docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS base
RUN npm install -g pnpm@11.11.0
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @docmax/shared build
# VITE_API_URL build-vaqtida bundle'ga "qotib qoladi" (Vite konvensiyasi) — brauzer
# ko'radigan manzil bo'lishi kerak (docker tarmog'idagi "api" xost nomi emas).
ARG VITE_API_URL=http://localhost:3001/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @docmax/web build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
