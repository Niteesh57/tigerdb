# ==============================================================
# Stage 1: Build the React (Vite) Frontend
# ==============================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==============================================================
# Stage 2: Unified Python Backend + Static Asset Server
# ==============================================================
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application modules
COPY tiger_agent/ ./tiger_agent/
COPY tiger_mia/ ./tiger_mia/
COPY examples/ ./examples/

# Copy compiled frontend from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Render sets PORT dynamically (default 8000 for local runs)
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Start Uvicorn bound to 0.0.0.0 and dynamic $PORT
CMD ["sh", "-c", "uvicorn tiger_agent.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
