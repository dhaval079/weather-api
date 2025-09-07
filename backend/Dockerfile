# Development stage - Fast and simple
FROM node:18-alpine AS development
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5001
CMD ["npm", "run", "dev"]

# Production stage - Optimized
FROM node:18-alpine AS production

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S warden -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Change ownership to non-root user
RUN chown -R warden:nodejs /app

USER warden

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]