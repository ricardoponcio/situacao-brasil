# Uma imagem para a API e a coleta (alvo "node") e outra para o front (alvo "web").
# Contexto de build: raiz do repositório. As dependências são instaladas uma vez só e servem aos dois alvos.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/storage/package.json packages/storage/
COPY apps/api/package.json apps/api/
COPY apps/ingest/package.json apps/ingest/
COPY apps/web/package.json apps/web/
RUN npm ci

# Typecheck de tudo e build do front. Se o typecheck falhar, nenhuma imagem é gerada e o que está no ar continua.
FROM deps AS check
COPY packages packages
COPY apps apps
RUN npm run typecheck && npm run build -w @sb/web

# Só o que roda em produção (o código roda direto em TypeScript pelo tsx).
FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS node
WORKDIR /app
ENV NODE_ENV=production SB_DATA_DIR=/data PORT=3101
COPY --from=prod-deps /app ./
COPY --from=check /app/packages/core/src packages/core/src
COPY --from=check /app/packages/storage/src packages/storage/src
COPY --from=check /app/apps/api/src apps/api/src
COPY --from=check /app/apps/ingest/src apps/ingest/src
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3101
CMD ["node_modules/.bin/tsx", "apps/api/src/server.ts"]

FROM nginx:1.29-alpine AS web
COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=check /app/apps/web/dist /usr/share/nginx/html
