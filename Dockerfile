# Multi-stage build for RIS PDM Performance Dashboard
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd backend && npm ci --only=production && npm cache clean --force
RUN cd frontend && npm ci && npm cache clean --force

# Build frontend
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

# Copy source code
COPY . .

# Vite reads import.meta.env.VITE_* at build time — Docker does not auto-forward
# Railway env vars into the build stage, so we declare them as ARGs (Railway
# passes matching Variables as --build-arg automatically) and re-export as ENV
# so `vite build` sees them. Without this, the production bundle shipped with an
# empty VITE_GOOGLE_CLIENT_ID and the <GoogleLogin> button rendered nothing.
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ARG VITE_WEBSOCKET_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_API_URL=$VITE_API_URL \
    VITE_WEBSOCKET_URL=$VITE_WEBSOCKET_URL

# Build frontend
RUN cd frontend && npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/backend ./backend
COPY --from=builder --chown=nextjs:nodejs /app/frontend/dist ./frontend/dist
COPY --from=deps --chown=nextjs:nodejs /app/backend/node_modules ./backend/node_modules

# Create logs directory with proper permissions (optional, logger will fall back to console)
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

USER nextjs

EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node backend/health-check.js || exit 1

# Start the application
CMD ["node", "backend/server.js"]