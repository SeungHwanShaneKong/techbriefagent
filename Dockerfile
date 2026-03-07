# ── Stage 1: Build frontend ─────────────────────────────────────────
FROM node:22-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + static assets ────────────────────────
FROM python:3.10-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    # Playwright Chromium dependencies (Debian Trixie compatible)
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2t64 libatspi2.0-0 libwayland-client0 \
    fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium

COPY backend /app/backend

# Copy built frontend into /app/static (served by FastAPI)
COPY --from=frontend-build /build/dist /app/static

# Create DB directories
RUN mkdir -p /app/data && touch /app/tech_news.db && touch /app/data/tech_news.db

# HF Spaces requires port 7860
ENV PORT=7860

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:7860/api/crawl-status || exit 1

EXPOSE 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
