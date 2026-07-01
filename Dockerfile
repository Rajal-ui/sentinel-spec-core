# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build: install dependencies into an isolated prefix
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

WORKDIR /build

# Install system-level build tools needed by ibm-watsonx-ai and ibm-cos-sdk
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runtime: minimal image, no build tools
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Copy pre-built packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source
# .dockerignore excludes: .env, .git, __pycache__, *.pyc, *.pyo, frontend/node_modules
COPY . .

# Runtime environment defaults (all overridable at container start)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MOCK_MODE=false \
    WATSONX_MODEL_ID=ibm/granite-20b-code-instruct

# IBM Code Engine expects port 8080
EXPOSE 8080

# Two uvicorn workers — appropriate for Code Engine 1-2 vCPU serverless instances.
# Scale horizontally via Code Engine min/max-scale, not via worker count.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2", "--log-level", "info"]
