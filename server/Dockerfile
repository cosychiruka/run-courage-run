# Stage 1: Build the React frontend
FROM node:18-alpine AS build-stage
# Install build dependencies for native modules (only in build stage)
RUN apk add --no-cache \
    autoconf \
    automake \
    make \
    g++ \
    python3 \
    libpng-dev \
    giflib-dev \
    nasm \
    file \
    libtool \
    pkgconfig
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Final Python environment
FROM python:3.11-slim
ARG INSTALL_KOKORO=false
ENV MALLOC_ARENA_MAX=2 \
    OMP_NUM_THREADS=1 \
    OMP_WAIT_POLICY=PASSIVE
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && if [ "$INSTALL_KOKORO" = "true" ]; then \
      apt-get install -y --no-install-recommends libsndfile1 wget; \
    fi \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the 1 GB dependency set by default. Larger hosts can explicitly build
# with --build-arg INSTALL_KOKORO=true to add local neural TTS.
COPY server/requirements.txt server/requirements-kokoro.txt ./
RUN if [ "$INSTALL_KOKORO" = "true" ]; then \
      pip install --no-cache-dir -r requirements-kokoro.txt; \
    else \
      pip install --no-cache-dir -r requirements.txt; \
    fi

# Pre-download Whisper (tiny.en = 39MB). Kokoro's package and large model files
# are excluded from the default image and added only for an explicit larger-host build.
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')"
RUN if [ "$INSTALL_KOKORO" = "true" ]; then \
      wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.int8.onnx && \
      wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin; \
    fi

# Copy backend code
COPY server/ .

# Copy built frontend assets from Stage 1
COPY --from=build-stage /app/dist /app/static

# Data directory for SQLite DB
RUN mkdir -p /app/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
