# Development stage - Fast and simple
FROM node:18-alpine AS development

# Install compatibility layer for Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Copy source code
COPY . .

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "dev"]

# Production stage - Optimized
FROM node:18-alpine AS production

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["npm", "start"]