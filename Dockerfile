# --- Stage 1: Build Frontend ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app/client
# Look inside the pocketsplit subdirectory
COPY pocketsplit/client/package*.json ./
RUN npm install
COPY pocketsplit/client/ ./
RUN npm run build

# --- Stage 2: Final Image ---
FROM node:18-alpine
WORKDIR /app

# Install production dependencies for backend
COPY pocketsplit/package*.json ./
RUN npm install --production

# Copy backend code from the subdirectory
COPY pocketsplit/server/ ./server/
COPY pocketsplit/api/ ./api/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/client/build ./client/build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

EXPOSE 5000

CMD ["node", "server/index.js"]
