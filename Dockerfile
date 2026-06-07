FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Install bun and dependencies
RUN npm install -g bun
RUN bun install

# Build stage
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Set DATABASE_URL for build
ENV DATABASE_URL="file:/app/data/build.db"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js with extra memory for the large page.tsx (6571 lines / 308KB)
# HF Spaces builder has ~16GB RAM, so 4GB heap should be fine
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/custom.db"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create data dir and init DB
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
RUN npx prisma db push --skip-generate

USER nextjs

EXPOSE 7860

ENV PORT=7860
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
