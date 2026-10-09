# 构建上下文 = 仓库根（treasure-plugin-icons/scripts 需读取兄弟插件目录）
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
WORKDIR /repo/treasure-plugin-icons
RUN npm ci
RUN npm run build        # collect + vite build + tsc server

FROM node:22-alpine AS deps
WORKDIR /repo/treasure-plugin-icons
COPY treasure-plugin-icons/package.json treasure-plugin-icons/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app

COPY --from=deps /repo/treasure-plugin-icons/node_modules ./node_modules
COPY --from=build /repo/treasure-plugin-icons/dist ./dist
COPY --from=build /repo/treasure-plugin-icons/dist-server ./dist-server

# HOST=0.0.0.0 是容器/托管平台（ModelScope Space 等）反向代理访问所必需；
# PORT 由平台注入，应用默认 7860。
ENV NODE_ENV=production PORT=7860 HOST=0.0.0.0 STATIC_DIR=/app/dist
EXPOSE 7860
CMD ["node", "dist-server/index.js"]