# Multi-stage build
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build server native dependencies
FROM node:20-alpine AS backend
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --production
RUN npm rebuild better-sqlite3 --build-from-source

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=backend /app/node_modules ./node_modules
COPY server/ ./
COPY --from=frontend /app/client/dist ./public

# Create data directory for SQLite + uploads
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000
CMD ["node", "index.js"]
