FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/
COPY data/ ./data/

EXPOSE 3000

CMD ["node", "src/index.js"]
