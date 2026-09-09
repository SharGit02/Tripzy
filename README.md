# Tripzee

Local setup for the three services. Run each in its own terminal.

Requires **Node.js 20+** and **Python 3.11+**.

## 1. ML microservice (`backend/ml-microservice/`)

Flight fare predictions on port **8000**. The Express server is the only intended caller.

```bash
cd backend/ml-microservice
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Set `ML_INTERNAL_API_KEY` in `.env` to the same value as `FASTAPI_ML_API_KEY` in `backend/server/.env`.

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 2. Server (`backend/server/`)

API on port **5000**.

```bash
cd backend/server
npm install
cp .env.example .env
```

Fill in at least `NEON_URI` (or `DATABASE_URL`) and `JWT_SECRET`. Set `FASTAPI_ML_API_KEY` to match the ML service. Gemini / NVIDIA keys are optional until you use itinerary generation.

```bash
npx drizzle-kit push
npm run dev
```

## 3. Client (`client/`)

Frontend on port **5173**.

```bash
cd client
npm install
cp .env.example .env
```

`VITE_API_URL` defaults to `http://localhost:5000` if unset.

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy backend (Render)

The Express API and ML service run in **one Docker image**. In Render, set:

- **Root Directory:** `backend`
- **Runtime:** Docker
- **Dockerfile path:** `Dockerfile`
- **Health check path:** `/api/health`

Set at least `NEON_URI` (or `DATABASE_URL`), `JWT_SECRET`, `CORS_ORIGINS` (your frontend URL), and `FASTAPI_ML_API_KEY`. Render injects `PORT`; leave `FASTAPI_ML_BASE_URL` as `http://127.0.0.1:8000`.

Give the instance at least **1 GB RAM** — the fare model loads a large parquet into memory.

From the repo root you can also preview the image locally:

```bash
docker build -t tripzee-api ./backend
docker run --env-file backend/server/.env -p 5000:5000 tripzee-api
```
