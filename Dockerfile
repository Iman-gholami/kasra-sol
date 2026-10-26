# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
# NPM_REGISTRY (set in .env) points the install at a mirror where registry.npmjs.org is slow or unreachable, as it often
# is from Iran. A stalled download is dropped after one minute (npm's default is five) and retried twice.
ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN npm install --no-audit --no-fund --registry="$NPM_REGISTRY" --fetch-timeout=60000 --fetch-retries=2 \
  --fetch-retry-maxtimeout=20000

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_BACKEND_ENABLED=false
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_BACKEND_ENABLED=$NEXT_PUBLIC_BACKEND_ENABLED
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
