# syntax = docker/dockerfile:1

# Stage 1: Build frontend
FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production server
FROM node:22-alpine
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev && cd ..

COPY --from=build /app/frontend/dist ./frontend/dist
COPY server/index.js ./server/
COPY server/entrypoint.sh ./server/

# Seed data: copied to volume on first run
COPY server/db.json ./seed/db.json

# Ensure entrypoint is executable
RUN chmod +x server/entrypoint.sh

ENV PORT=3001
ENV DB_PATH=/app/data/db.json
ENV NODE_ENV=production

EXPOSE 3001
CMD ["server/entrypoint.sh"]
