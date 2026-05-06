# ---------- Stage 1: Build Widget SDK ----------
FROM node:18-alpine AS widget-builder

WORKDIR /app/widget-sdk

COPY widget-sdk/package*.json ./
RUN npm ci

COPY widget-sdk/ ./
RUN npm run build


# ---------- Stage 2: Backend Core ----------
FROM node:18-alpine

WORKDIR /app

# Install backend deps
COPY backend-core/package*.json ./
RUN npm ci --omit=dev

# Copy backend code
COPY backend-core/ ./

# Copy built widget
COPY --from=widget-builder /app/widget-sdk/dist ./widget-sdk-dist

# Env
ENV NODE_ENV=production
ENV PORT=8080
ENV WIDGET_DIST_PATH=/app/widget-sdk-dist

EXPOSE 8080

CMD ["node", "src/index.js"]