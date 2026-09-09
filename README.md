# Tripzee

Local setup for the three services. Run each in its own terminal.

Requires **Node.js 20+** and **Python 3.11+**.

## 1. Backend env

One env file covers Express and the ML service (including Docker).

```bash
cd Backend
cp .env.example .env
```

Set `NEON_URI` (or `DATABASE_URL`), `JWT_SECRET`, and the two ML keys to the **same** secret (`FASTAPI_ML_API_KEY` and `ML_INTERNAL_API_KEY`).

## 2. ML microservice (`Backend/ml-microservice/`)

```bash
cd Backend/ml-microservice
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 3. Server (`Backend/server/`)

```bash
cd Backend/server
npm install
npx drizzle-kit push
npm run dev
```

## 4. Client (`Client/`)

```bash
cd Client
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy backend (Render)

- **Root Directory:** `Backend`
- **Runtime:** Docker
- **Dockerfile path:** `Dockerfile`
- **Health check path:** `/api/health`

Set the same secrets as `Backend/.env`. Render injects `PORT`. Use at least **1 GB RAM**.

```bash
docker build -t tripzee-api ./Backend
docker run --env-file Backend/.env -p 5000:5000 tripzee-api
```
