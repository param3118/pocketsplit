# Use lightweight Node Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files for caching
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies (including devDependencies for build)
RUN npm install
RUN cd client && npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Prune dev dependencies and clean up
# Note: Keeping some dev deps if needed for runtime, but usually we want to prune
# However, to keep it simple and reliable for this exercise:
# RUN npm prune --production

# Expose backend port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV DB_PATH=/app/data/pocketsplit.db

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

# Use production startup command
CMD ["npm", "start"]
