FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:node
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-node ./dist-node

# HOST=0.0.0.0 是容器/托管平台（Hugging Face Space 等）反向代理访问所必需；
# PORT 由平台注入（Hugging Face 会按 Dockerfile EXPOSE 端口设置），应用默认 7860。
ENV NODE_ENV=production PORT=7860 HOST=0.0.0.0 STATIC_DIR=/app/dist
EXPOSE 7860
CMD ["node", "dist-node/index.js"]
