# Imagem da API e da coleta (apps/api e apps/ingest). Contexto de build: raiz do repositório.
# O código roda direto em TypeScript pelo tsx, como em desenvolvimento.
FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/storage/package.json packages/storage/
COPY apps/api/package.json apps/api/
COPY apps/ingest/package.json apps/ingest/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages packages
COPY apps apps
# Se o typecheck falhar, o build falha e o deploy para: o container antigo continua no ar.
RUN npm run typecheck
ENV NODE_ENV=production SB_DATA_DIR=/data PORT=3101
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3101
CMD ["node_modules/.bin/tsx", "apps/api/src/server.ts"]
