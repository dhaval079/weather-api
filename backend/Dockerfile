# Multi-stage build for production optimization
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev:enhanced"]

FROM builder AS production-deps
RUN npm ci --only=production --no-audit --no-fund

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S warden -u 1001
WORKDIR /app
COPY --from=production-deps --chown=warden:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=warden:nodejs /app/dist ./dist
COPY --from=build --chown=warden:nodejs /app/prisma ./prisma
COPY --chown=warden:nodejs package*.json ./

USER warden
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start:enhanced"]