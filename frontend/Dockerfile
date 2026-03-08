# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY frontend/package*.json /app/
RUN npm ci

COPY frontend /app
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json /app/
RUN npm ci --omit=dev 2>/dev/null || true

EXPOSE 8501

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget --spider -q http://localhost:8501 || exit 1

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "8501"]
