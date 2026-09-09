FROM node:22-bookworm-slim

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

COPY ml-microservice/requirements.txt /app/ml-microservice/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r /app/ml-microservice/requirements.txt

COPY server/package.json server/package-lock.json /app/server/
WORKDIR /app/server
RUN npm ci --ignore-scripts \
    && npm rebuild bcrypt

COPY server/ /app/server/
RUN npm run build \
    && npm prune --omit=dev

COPY ml-microservice /app/ml-microservice
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && apt-get purge -y build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=5000 \
    FASTAPI_ML_BASE_URL=http://127.0.0.1:8000

EXPOSE 5000

CMD ["/entrypoint.sh"]
