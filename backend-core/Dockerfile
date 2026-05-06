# ---------- Stage 1: Build Widget SDK ----------
FROM node:18-alpine AS widget-builder

WORKDIR /app/widget-sdk

# Install deps (better caching)
COPY widget-sdk/package*.json ./
RUN npm ci

# Copy code & build
COPY widget-sdk/ ./
RUN npm run build


# ---------- Stage 2: Backend Core ----------
FROM node:18-alpine

WORKDIR /app

# Install only production deps
COPY backend-core/package*.json ./
RUN npm ci --omit=dev

# Copy backend code
COPY backend-core/ ./

# Copy built widget from Stage 1
COPY --from=widget-builder /app/widget-sdk/dist ./widget-sdk-dist

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV WIDGET_DIST_PATH=/app/widget-sdk-dist

# Cloud Run requires PORT
EXPOSE 8080

# Start app
CMD ["node", "src/index.js"]