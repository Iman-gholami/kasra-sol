# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# NPM_REGISTRY (set in .env for local builds) points the install at a mirror where registry.npmjs.org is slow or
# unreachable, as it often is from Iran; production images are built by GitHub Actions with the default. The lockfile
# pins every version, and downloaded packages stay in a build cache, so a retry after a dropped connection continues.
ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --registry="$NPM_REGISTRY"

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_BACKEND_ENABLED=false
# Search engines stay out (robots.txt, noindex) unless the release is built with "true" (src/lib/seo.ts).
ARG NEXT_PUBLIC_SITE_INDEXABLE=false
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_BACKEND_ENABLED=$NEXT_PUBLIC_BACKEND_ENABLED
ENV NEXT_PUBLIC_SITE_INDEXABLE=$NEXT_PUBLIC_SITE_INDEXABLE
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
