# Stage 1: Build Widget SDK
FROM node:18-alpine AS widget-builder
WORKDIR /app/widget-sdk
COPY widget-sdk/package*.json ./
RUN npm install
COPY widget-sdk/ ./
RUN npm run build

# Stage 2: Build Backend Core
FROM node:18-alpine
WORKDIR /app
COPY backend-core/package*.json ./
RUN npm install --production
COPY backend-core/ ./
COPY collection.json /app/collection.json

# Copy built widget from Stage 1
COPY --from=widget-builder /app/widget-sdk/dist ./widget-sdk-dist

# Update the code to point to the correct static path in production
# We'll use an environment variable or a simple check in the code
ENV NODE_ENV=production
ENV PORT=4000
ENV WIDGET_DIST_PATH=/app/widget-sdk-dist
ENV COLLECTION_JSON_PATH=/app/collection.json

EXPOSE 4000
CMD ["node", "src/index.js"]
