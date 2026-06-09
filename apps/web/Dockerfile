ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG DATABASE_URL=postgresql://live2d:live2d@localhost:5432/live2d_creator_platform?schema=public
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ARG VCS_REF=unknown
ARG SOURCE_URL=unknown

LABEL org.opencontainers.image.title="live2d-creator-platform-web" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.source=$SOURCE_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts/start-standalone.mjs ./scripts/start-standalone.mjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "scripts/start-standalone.mjs"]
