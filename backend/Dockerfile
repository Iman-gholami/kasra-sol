# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --no-audit --no-fund
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
USER api
EXPOSE 4000
CMD ["sh", "-c", "node dist/migrate.js && if [ \"$SEED_DEMO_DATA\" = 'true' ]; then node dist/seed.js; fi && node dist/index.js"]
