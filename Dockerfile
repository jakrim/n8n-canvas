FROM node:18-slim

# Update package list and install dependencies
RUN apt-get update && apt-get install -y \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
