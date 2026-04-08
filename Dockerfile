# 出勤加班單系統 - 多階段建置
# Vite 7 需 Node ^20.19 或 >=22.12（見 frontend/package.json）

FROM node:22-alpine AS builder

# 設定 npm 參數
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
  NPM_CONFIG_FUND=false \
  NPM_CONFIG_AUDIT=false

# 設定工作目錄
WORKDIR /app/frontend

# 先裝 frontend 依賴
COPY 1.出勤加班單系統/frontend/package*.json ./
RUN npm i -g npm@11.12.1 && npm --version && npm ci --no-audit --no-fund

# 複製 frontend 與 shared-ui 原始碼
COPY 1.出勤加班單系統/frontend/ ./
COPY 0.shared-ui /app/frontend/0.shared-ui

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY 1.出勤加班單系統/nginx/default.conf /etc/nginx/conf.d/default.conf

# 預設 nginx 服務根路徑，由主 Nginx 依 /attendance/ 轉發
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

