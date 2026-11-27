FROM node:22-bookworm-slim

WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
EXPOSE 8081
CMD ["npm", "start", "--", "--lan", "--go", "--port", "8081"]
