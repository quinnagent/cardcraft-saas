# CardCraft Backend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy backend package files first (for caching)
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm install

# Go back to app root
WORKDIR /app

# Copy all backend files
COPY backend/ ./backend/

# Copy CSV to root where the code expects it
COPY wedding_planners_FINAL.csv ./

# Create data directory for SQLite volume
RUN mkdir -p /app/data

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "backend/server.js"]
