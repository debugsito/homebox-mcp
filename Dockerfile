FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/server.js"]
