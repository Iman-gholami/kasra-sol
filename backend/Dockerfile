# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
# NPM_REGISTRY (set in .env for local builds) points the install at a mirror where registry.npmjs.org is slow or
# unreachable, as it often is from Iran; production images are built by GitHub Actions with the default. The lockfile
# pins every version, and downloaded packages stay in a build cache, so a retry after a dropped connection continues.
ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --registry="$NPM_REGISTRY"
COPY backend ./
COPY src /app/src
# The bundle in dist/ still imports the runtime dependencies; the build tools are not shipped.
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

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
