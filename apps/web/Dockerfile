# Contexto de build: raiz do repositório. Gera o front e serve com nginx (que também faz o proxy da API).
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/storage/package.json packages/storage/
COPY apps/api/package.json apps/api/
COPY apps/ingest/package.json apps/ingest/
COPY apps/web/package.json apps/web/
RUN npm ci -w @sb/web
COPY packages/core packages/core
COPY apps/web apps/web
RUN npm run build -w @sb/web

FROM nginx:1.29-alpine
COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
