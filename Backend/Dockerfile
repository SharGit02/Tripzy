FROM node:22-bookworm-slim

# Install Python + runtime libs.
# build-essential is needed only for native npm modules (bcrypt); we remove it
# after the build phase to keep the final image lean.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        build-essential \
        libgomp1 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps ───────────────────────────────────────────────────────────────
COPY ml-microservice/requirements.txt /app/ml-microservice/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir \
        -r /app/ml-microservice/requirements.txt

# ── Node deps ─────────────────────────────────────────────────────────────────
COPY server/package.json server/package-lock.json /app/server/
WORKDIR /app/server
RUN npm ci --ignore-scripts \
    && npm rebuild bcrypt

# ── Source code ───────────────────────────────────────────────────────────────
COPY server/ /app/server/
RUN npm run build \
    && npm prune --omit=dev

COPY ml-microservice /app/ml-microservice

# ── Precompute slim ML artifacts at build time ────────────────────────────────
# This reads the full 50 MB Parquet ONCE here in Docker, extracts all the
# lookup structures the service needs at runtime, and writes a ~1-3 MB
# precomputed_stats.pkl. The production container then loads only that slim
# file — the Parquet itself is never read in production, cutting startup RAM
# from ~400 MB to ~30 MB and fixing the Render 512 MB OOM crash.
WORKDIR /app
RUN python3 ml-microservice/precompute_artifacts.py \
    && rm -f ml-microservice/data/Indian_Domestic_Flight_Historical_Dataset_FINAL.parquet

# Remove build tools to slim the final image
RUN apt-get purge -y build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production \
    PORT=5000 \
    FASTAPI_ML_BASE_URL=http://127.0.0.1:8000

EXPOSE 5000

CMD ["/entrypoint.sh"]
