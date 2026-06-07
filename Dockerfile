FROM node:22-alpine

# Install bun
RUN npm install -g bun

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN bun install

# Generate Prisma client
RUN npx prisma generate

# Create data directory and initialize DB
RUN mkdir -p /app/data
ENV DATABASE_URL="file:/app/data/custom.db"
RUN npx prisma db push --skip-generate

# Expose port
EXPOSE 7860

ENV PORT=7860
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/custom.db"

# Run in dev mode — production build OOMs due to 6571-line page.tsx (308KB)
# Dev mode compiles on-demand, avoiding the peak memory of a full build
CMD ["npx", "next", "dev", "-p", "7860", "-H", "0.0.0.0"]
