# 出勤加班單系統 - 多階段建置
FROM node:18-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# 預設 nginx 服務根路徑，由主 Nginx 依 /attendance/ 轉發
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

