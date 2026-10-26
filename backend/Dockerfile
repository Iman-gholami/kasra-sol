# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package.json ./
# NPM_REGISTRY (set in .env) points the install at a mirror where registry.npmjs.org is slow or unreachable, as it often
# is from Iran. A stalled download is dropped after one minute (npm's default is five) and retried twice.
ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN npm install --no-audit --no-fund --registry="$NPM_REGISTRY" --fetch-timeout=60000 --fetch-retries=2 \
  --fetch-retry-maxtimeout=20000
COPY backend ./
COPY src /app/src
RUN npm run build

FROM node:22-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S -G nodejs api
COPY --from=build --chown=api:nodejs /app/backend/node_modules ./node_modules
COPY --from=build --chown=api:nodejs /app/backend/dist ./dist
COPY --from=build --chown=api:nodejs /app/backend/sql ./sql
RUN mkdir -p /app/backend/uploads && chown api:nodejs /app/backend/uploads
USER api
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && if [ \"$SEED_DEMO_DATA\" = 'true' ]; then node dist/db/seed.js; fi && node dist/index.js"]
