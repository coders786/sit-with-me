FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* bun.lockb* ./
COPY prisma ./prisma/

# Install dependencies using npm (more reliable in Docker)
RUN npm install --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js app (standalone output)
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and DB
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create data directory for SQLite and initialize the database
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Set DATABASE_URL for production and push schema
ENV DATABASE_URL="file:/app/data/custom.db"
RUN npx prisma db push --skip-generate

USER nextjs

EXPOSE 7860

ENV PORT=7860
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/custom.db"

CMD ["node", "server.js"]
