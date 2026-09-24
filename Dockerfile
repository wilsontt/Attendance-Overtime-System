# 出勤加班單系統 - 多階段建置
# Vite 7 需 Node ^20.19 或 >=22.12（見 frontend/package.json）
# 建置 context＝企業入口網站根目錄

FROM node:22-alpine AS builder

# 設定 npm 參數
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
  NPM_CONFIG_FUND=false \
  NPM_CONFIG_AUDIT=false

# 設定工作目錄
WORKDIR /app/frontend

# 先裝 frontend 依賴
COPY 1.出勤加班單系統/frontend/package*.json ./
RUN npm --version && npm ci --no-audit --no-fund

# 複製 frontend 與 shared-ui 原始碼
COPY 1.出勤加班單系統/frontend/ ./
COPY 0.shared-ui /app/frontend/0.shared-ui

RUN npm run build

FROM nginx:alpine

# 非 root：聽 8080（<1024 需 root）；入口 upstream 請指向 attendance:8080
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY 1.出勤加班單系統/nginx/default.conf /etc/nginx/conf.d/default.conf
RUN chown -R nginx:nginx /usr/share/nginx/html \
  && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
  && touch /var/run/nginx.pid \
  && chown nginx:nginx /var/run/nginx.pid \
  && sed -i '/^user /d' /etc/nginx/nginx.conf

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
