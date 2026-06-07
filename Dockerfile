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

# Create .z-ai-config from environment variables at startup
# Required env vars: ZAI_BASE_URL, ZAI_API_KEY, ZAI_CHAT_ID, ZAI_TOKEN, ZAI_USER_ID
# These should be set in HF Spaces Settings > Variables and Secrets
COPY <<'EOF' /app/start.sh
#!/bin/sh

# Create .z-ai-config from env vars
if [ -n "$ZAI_BASE_URL" ] && [ -n "$ZAI_API_KEY" ]; then
  cat > /app/.z-ai-config <<CONF
{
  "baseUrl": "${ZAI_BASE_URL}",
  "apiKey": "${ZAI_API_KEY}",
  "chatId": "${ZAI_CHAT_ID:-default}",
  "token": "${ZAI_TOKEN:-}",
  "userId": "${ZAI_USER_ID:-default}"
}
CONF
  echo "Created .z-ai-config"
else
  echo "WARNING: ZAI_BASE_URL and ZAI_API_KEY not set - AI features will not work"
fi

# Start the app
exec npx next dev -p 7860 -H 0.0.0.0
EOF

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
