# Tripzy

> **AI-powered travel planning platform** — Generate personalized itineraries, predict flight fares with ML, and manage your travel portfolio in one place.

![Tripzy Landing Page](readme-assets/landing_page.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)

---

## 🎯 Project Overview

**Tripzy** is a full-stack travel planning application that combines AI-generated personalized itineraries with machine learning-powered flight fare predictions. Built for travelers who want intelligent trip planning without the manual research.

### What problem does it solve?
- **Hours of itinerary research** → Reduced to seconds via AI (Gemini + NVIDIA fallback)
- **Guessing when to book flights** → ML model predicts cheapest days across a 30-day window (LightGBM trained on 1.67M Indian domestic flights)
- **Scattered travel data** → Unified dashboard for itineraries, bookings, fare history, and search history

### Who is it for?
- **Solo travelers & couples** planning personalized trips
- **Families & friend groups** needing coordinated multi-person itineraries
- **Budget-conscious travelers** optimizing flight booking timing
- **Developers** learning modern full-stack architecture with AI/ML integration

---

## ✨ Key Features

### 🤖 AI-Powered Itinerary Generation
| Feature | Description |
|---------|-------------|
| **Direct Generation** | One-shot itinerary creation from destination, dates, group size, interests, budget, travel style |
| **Questionnaire Flow** (infra ready) | Multi-step AI-guided Q&A for progressive refinement |
| **Regeneration** | Modify existing itineraries with natural language instructions |
| **PDF Export** | Professional PDF download/email with `pdfkit` |
| **Public Sharing** | Shareable read-only links (`/share/:id`) |
| **Profile Personalization** | Uses home city, travel interests, budget preferences, travel style |

### ✈️ Flight Fare Prediction (ML Microservice)
- **LightGBM model** trained on **1.67M records** across **1,336 Indian domestic routes**
- **30-day prediction window** — finds cheapest day to fly within a month
- **Per-user history** — every prediction saved to PostgreSQL
- **Rate limited** — 10 requests/minute per user
- **Internal-only API** — ML service never exposed to browser (server-side proxy)

### 📊 Travel Dashboard
- **Cost visualization** (Recharts) — spending by category across bookings, itineraries, fare predictions
- **Journey stats** — total trips, unique places visited, itineraries created
- **Weather widget** — current conditions for home city (OpenWeatherMap)
- **Seasonal recommendations** — curated destination picks by season

### 🔐 Authentication & User Management
- **JWT in httpOnly cookies** with automatic refresh rotation
- **Email/password** signup & login (Zod validated)
- **OAuth ready** — Google & GitHub providers configured
- **Protected routes** on both frontend and backend
- **User profiles** — extended profile with travel preferences, budget, interests

### 🛠 Technical Features
- **Multi-provider AI** — Gemini primary with NVIDIA (Gemma/Nemotron) fallback, circuit breakers, key waterfall
- **Type-safe API** — Zod schemas shared via `zod-to-openapi` for validation
- **Database** — Drizzle ORM with Neon PostgreSQL, full relational schema
- **Rate limiting** — Express-rate-limit with IP trust proxy for Render/behind-proxy deployments
- **Observability** — Pino logging, structured AI request logging with request IDs

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TRIPZY ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     HTTPS/REST      ┌──────────────┐     Internal API    │
│  │   Browser    │ ◄─────────────────► │  Express     │ ◄─────────────────► │
│  │  (React 19)  │   /api/* proxy      │  (Port 5000) │   X-Internal-API-Key│
│  │  Port 5173   │                     │  TypeScript  │                     │
│  └──────────────┘                     └──────┬───────┘                     │
│                                               │                             │
│                                               │ Drizzle ORM                 │
│                                               ▼                             │
│                                    ┌────────────────────┐                   │
│                                    │  Neon PostgreSQL   │                   │
│                                    │  (Managed, SSL)    │                   │
│                                    └────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Architecture diagram will be added here.**

<!-- ARCHITECTURE DIAGRAM PLACEHOLDER -->

### Service Breakdown

| Service | Tech | Port | Responsibility |
|---------|------|------|----------------|
| **Frontend** | React 19 + Vite 6 + Tailwind 4 | 5173 | SPA, routing, auth state, UI components |
| **Backend** | Express 5 + TypeScript + Drizzle | 5000 | REST API, auth, business logic, AI orchestration, DB |
| **ML Microservice** | FastAPI + LightGBM + Pandas | 8000 | Flight fare prediction (internal API only) |

### Data Flow: Flight Fare Prediction

```
User (Trip Page)
    │
    ▼
POST /api/flight-fare/predict  (authMiddleware + rateLimiter)
    │
    ▼
flightFare.service.ts
    │
    ▼
POST /predict/window  (FastAPI, X-Internal-API-Key header)
    │
    ▼
predictor.predict_window()  → LightGBM model.predict() (batched)
    │
    ▼
Response normalized (snake_case → camelCase)
    │
    ▼
Persisted to flight_fare_predictions table
    │
    ▼
{ prediction } returned to browser
```

### Data Flow: AI Itinerary Generation

```
User (Catalog Page)
    │
    ▼
POST /api/plan/generate  (authMiddleware)
    │
    ▼
itinerary.service.ts → itinerary.ai.service.ts
    │
    ▼
buildItineraryPrompt() + ITINERARY_SYSTEM_PROMPT
    │
    ▼
ai.service.ts.generateJson()
    ├──► Gemini (key waterfall + model fallbacks + circuit breaker)
    │       │
    │       └──► On quota/exhaustion → NVIDIA fallback (not yet verified)
    │
    ▼
JSON parsed, validated, normalized
    │
    ▼
Saved to itineraries + itinerary_questions tables
    │
    ▼
Returned to frontend → GeneratingItineraryPage → ItineraryDetailPage
```

---

## 🖼 Screenshots

### Landing Page
![Landing Page](readme-assets/landing_page.png)
*Hero section with animated background, feature highlights, FAQ, and CTA*

### Authentication
![Login Page](readme-assets/login_pge.png)
*Modal-based login/signup with email/password and OAuth options*

---

## 🧰 Technology Stack

### Frontend (`Client/`)
| Category | Technologies |
|----------|--------------|
| **Framework** | React 19, Vite 6, React Router 7 |
| **Language** | JavaScript (ESM), JSDoc type hints |
| **Styling** | Tailwind CSS 4 (via `@tailwindcss/vite`), CSS custom properties |
| **Fonts** | Cormorant Garamond, DM Sans, Inter, Playfair Display, Plus Jakarta Sans, Roboto Mono (`@fontsource/*`) |
| **State & Data** | TanStack React Query 5, React Context (Auth) |
| **Forms** | React Hook Form 7 + Zod 4 resolvers (`@hookform/resolvers`) |
| **Animations** | Framer Motion 12 |
| **Icons** | Lucide React |
| **Charts** | Recharts 3 |
| **Notifications** | Sonner 2 |
| **Utilities** | date-fns 4, react-spinners |
| **Linting** | ESLint 10 + React Hooks + React Refresh |

### Backend (`Backend/server/`)
| Category | Technologies |
|----------|--------------|
| **Runtime** | Node.js 20+ (ESM), `tsx` watch mode |
| **Framework** | Express 5, TypeScript 7 (NodeNext) |
| **Database** | Neon PostgreSQL, Drizzle ORM 0.45, `pg` pool |
| **Auth** | JWT (jsonwebtoken), bcrypt 6, httpOnly cookies |
| **Validation** | Zod 4, `@asteasolutions/zod-to-openapi` |
| **AI** | Google Gemini REST, NVIDIA API (Gemma/Nemotron), custom key waterfall, circuit breakers |
| **PDF** | PDFKit |
| **Email** | Resend |
| **Weather** | OpenWeatherMap |
| **Security** | Helmet, CORS (credentials), express-rate-limit |
| **Logging** | Pino + pino-http, Morgan (dev) |
| **Dev Tools** | drizzle-kit, Vitest, Supertest |

### ML Microservice (`Backend/ml-microservice/`)
| Category | Technologies |
|----------|--------------|
| **Framework** | FastAPI, Uvicorn |
| **ML** | LightGBM, scikit-learn, Pandas, NumPy |
| **Model** | `flight_fare_model.pkl` (1.67M training rows, 1,336 routes) |
| **Features** | Cyclical date encoding, route frequency, airline encoding |
| **Auth** | `X-Internal-API-Key` header (shared secret) |

### Infrastructure & Deployment
| Target | Configuration |
|--------|---------------|
| **Frontend** | Vercel (rewrites `/api/*` → Render backend) |
| **Backend** | Render (Docker, health check `/api/health`, 1GB+ RAM) |
| **Database** | Neon PostgreSQL (serverless, connection pooling) |
| **ML Service** | Runs in same Docker container as backend (background process) |

---

## 📁 Project Structure

```text
tripzy/
├── Client/                          # React Frontend (Vite)
│   ├── public/
│   │   └── flights-brand-name-svg/  # Airline logos (SVG)
│   │   └── flight-planes-image/     # Aircraft images
│   ├── src/
│   │   ├── assets/images/           # Destination photos, hero images
│   │   ├── components/
│   │   │   ├── auth/                # ProtectedRoute, AuthModal
│   │   │   ├── layout/              # Navbar, UserNavbar, Footer
│   │   │   └── ui/                  # Reusable UI components
│   │   ├── lib/
│   │   │   └── authApi.js           # All API calls (auth, bookings, fare, itinerary)
│   │   ├── pages/
│   │   │   ├── Landing/             # Hero, Features, HowItWorks, FAQ, FinalCTA
│   │   │   ├── Catalog/             # Trip planning entry, top picks, boarding pass search
│   │   │   ├── Dashboard/           # Cost charts, weather, journey stats
│   │   │   ├── Trip/                # Flight fare prediction UI
│   │   │   ├── Itinerary/           # Detail, generating, share, results, map
│   │   │   ├── Profile/             # Profile management
│   │   │   ├── Bookings/            # My bookings, fare history
│   │   │   └── NotFound/
│   │   ├── services/                # placeImageResolver
│   │   ├── styles/                  # Global CSS, Tailwind entry
│   │   ├── App.jsx                  # Routes with ProtectedRoute wrapper
│   │   └── main.jsx                 # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json                  # API rewrites for production
│
├── Backend/
│   ├── server/                      # Express + TypeScript API
│   │   ├── src/
│   │   │   ├── config/              # env.ts (Zod), cors.ts
│   │   │   ├── db/                  # client.ts (pg+Drizzle), schema.ts
│   │   │   ├── features/
│   │   │   │   ├── auth/            # Controller, routes, schema, middleware
│   │   │   │   ├── bookings/        # CRUD for user bookings
│   │   │   │   ├── flightFare/      # ML proxy, prediction, history
│   │   │   │   ├── health/          # /api/health endpoint
│   │   │   │   ├── itinerary/       # Full AI pipeline (7 files)
│   │   │   │   ├── search-history/  # User search logging
│   │   │   │   ├── users/           # Profile CRUD
│   │   │   │   └── weather/         # OpenWeatherMap proxy
│   │   │   ├── middlewares/         # auth, error, rateLimit
│   │   │   ├── routes/              # Root router composition
│   │   │   ├── services/
│   │   │   │   ├── ai/              # Gemini, NVIDIA, keyWaterfall, unified service
│   │   │   │   └── pdf/             # PDFKit itinerary generation
│   │   │   ├── types/               # TypeScript types
│   │   │   └── index.ts             # App entry, middleware, DB connect
│   │   ├── drizzle/                 # Generated SQL migrations
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── entrypoint.sh            # Starts ML service + Express
│   │
│   ├── ml-microservice/             # FastAPI + LightGBM
│   │   ├── app/
│   │   │   ├── main.py              # FastAPI app, /health, /predict/window
│   │   │   ├── predictor.py         # Model loading, prediction logic
│   │   │   ├── feature_engineering.py
│   │   │   └── schemas.py           # Pydantic models
│   │   ├── models/                  # flight_fare_model.pkl
│   │   ├── data/                    # Historical flight data (parquet)
│   │   ├── requirements.txt
│   │   └── .env
│   │
│   ├── .env.example
│   ├── .dockerignore
│   └── render.yaml                  # Render deployment config
│
├── readme-assets/                   # Screenshots for README
│   ├── landing_page.png
│   └── login_pge.png
│
├── knowledge/                       # Persistent engineering knowledge
│   ├── PROJECT.md
│   ├── architecture/system.md
│   ├── decisions/
│   │   ├── 0001-server-side-third-party-api-proxy.md
│   │   ├── 0002-gemini-key-waterfall-dam.md
│   │   └── 0003-flight-fare-ml-microservice.md
│   ├── conventions/
│   └── debugging/
│
├── CLAUDE.md                        # Project instructions for AI
├── PROJECT.md                       # Complete technical documentation
├── render.yaml                      # Render service definition
└── README.md                        # This file
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+** (LTS recommended)
- **Python 3.11+** (for ML microservice)
- **Neon PostgreSQL account** (or local Postgres)
- **API Keys**: Gemini (Google AI Studio), NVIDIA (optional fallback), OpenWeatherMap, Resend (email)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/tripzy.git
cd tripzy
```

### 2. Backend Setup

```bash
cd Backend/server
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)
npm install
npx drizzle-kit push  # Apply schema to Neon
npm run dev           # Starts on http://localhost:5000
```

### 3. ML Microservice Setup

```bash
cd Backend/ml-microservice
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate

pip install -r requirements.txt
# Ensure model file exists at models/flight_fare_model.pkl
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend Setup

```bash
cd Client
cp .env.example .env  # Optional: VITE_API_URL for non-standard backend URL
npm install
npm run dev           # Starts on http://localhost:5173
```

### 5. Verify

| Service | URL | Health Check |
|---------|-----|--------------|
| Frontend | http://localhost:5173 | — |
| Backend API | http://localhost:5000 | GET `/api/health` |
| ML Service | http://localhost:8000 | GET `/health` |

---

## ⚙️ Environment Variables

### Backend (`Backend/server/.env`)

```env
# Core
NODE_ENV=development
PORT=5000
CORS_ORIGINS=http://localhost:5173

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
# OR legacy name still supported:
NEON_URI=postgresql://user:pass@host/db?sslmode=require

# Auth
JWT_SECRET=your-super-secret-min-32-chars

# ML Microservice (internal)
FASTAPI_ML_BASE_URL=http://127.0.0.1:8000
FASTAPI_ML_API_KEY=ml-internal-secret-key-12345

# Gemini (primary AI) — supports GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2...
GEMINI_MODEL=gemini-3.5-flash
GEMINI_MODEL_FALLBACKS=gemini-3.6-flash,gemini-flash-latest,gemini-2.5-flash
GEMINI_TIMEOUT_MS=90000
GEMINI_API_KEY=your-gemini-key
GEMINI_API_KEY_1=your-gemini-key-1
GEMINI_API_KEY_2=your-gemini-key-2

# NVIDIA (fallback AI) — optional but recommended
NVIDIA_API_KEY=nvapi-your-key
NVIDIA_MODEL=google/gemma-4-31b-it
NVIDIA_MODEL_FALLBACKS=moonshotai/kimi-k3,deepseek-ai/deepseek-v4-flash-0731
NVIDIA_TIMEOUT_MS=60000

# OAuth (optional)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# Frontend URL (for email links, OAuth redirects)
FRONTEND_URL=http://localhost:5173

# Email (Resend)
RESEND_API_KEY=re_xxx

# Weather (OpenWeatherMap)
OPEN_WEATHER_API=your-owm-key
```

### ML Microservice (`Backend/ml-microservice/.env`)

```env
ML_INTERNAL_API_KEY=ml-internal-secret-key-12345  # Must match FASTAPI_ML_API_KEY
```

### Frontend (`Client/.env`)

```env
# Only needed if backend isn't at http://localhost:5000
VITE_API_URL=http://localhost:5000
```

---

## 📡 API Reference

### Base URL
```
Development:  http://localhost:5000/api
Production:   https://tripzy-qiv6.onrender.com/api
```

### Authentication
All protected endpoints require **JWT in httpOnly cookie** (set on login).  
`credentials: 'include'` must be sent with every request.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Register new user |
| `POST` | `/auth/login` | Login, sets cookies |
| `POST` | `/auth/logout` | Clears cookies |
| `POST` | `/auth/refresh` | Rotates access/refresh tokens |
| `GET` | `/auth/me` | Current user (validates session) |

### Itinerary (`/api/plan` or `/api/itinerary`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/generate` | Generate new itinerary (direct) |
| `GET` | `/` | List user itineraries (paginated) |
| `GET` | `/:id` | Get single itinerary |
| `GET` | `/:id/pdf` | Download PDF |
| `POST` | `/:id/email-pdf` | Email PDF to user |
| `POST` | `/:id/regenerate` | Modify with natural language |
| `PATCH` | `/:id` | Update title/status/data |
| `DELETE` | `/:id` | Delete itinerary |
| `GET` | `/plan/:id/public` | Public read-only (no auth) |

**Generate Request Body:**
```json
{
  "destination": "Goa",
  "startDate": "2025-12-20",
  "endDate": "2025-12-27",
  "origin": "Delhi",
  "adults": 2,
  "children": 0,
  "rooms": 1,
  "accommodationType": "standard",
  "preferredTransport": "flight",
  "tripType": "couple",
  "interests": ["beaches", "food", "history"],
  "wheelchairAccessible": false,
  "travelStyle": "balanced",
  "specialRequests": "Vegetarian food preferred",
  "budget": 50000
}
```

### Flight Fare (`/api/flight-fare`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/predict` | Predict cheapest days (rate limited: 10/min) |
| `GET` | `/history` | User's prediction history |
| `GET` | `/:id` | Get single prediction |

**Predict Request Body:**
```json
{
  "origin": "Delhi",
  "destination": "Mumbai",
  "startDate": "2025-12-01",
  "windowDays": 30
}
```

### Users (`/api/users`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/profile` | Get current user + profile |
| `PUT` | `/profile` | Update profile |

### Weather (`/api/weather`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `?city=Nagpur` | Current weather for city |

### Health (`/api/health`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Server + DB + AI status |

---

## 🗄 Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Core accounts (id, name, email, password, role) |
| `user_profiles` | Extended 1:1 profile (username, phone, dob, interests, budget, preferences) |
| `bookings` | User bookings (flights, hotels, packages, activities) |
| `search_history` | Lightweight search logging for personalization |
| `flight_fare_predictions` | ML predictions with full day-by-day results (JSONB) |
| `itineraries` | AI-generated itineraries (itineraryData JSONB, userAnswers, status) |
| `itinerary_questions` | Q&A flow steps for questionnaire mode |

> Full schema with types: [`Backend/server/src/db/schema.ts`](Backend/server/src/db/schema.ts)

---

## 🔑 Key Architectural Decisions

| Decision | Document |
|----------|----------|
| Third-party APIs proxied through server (never browser) | [`0001-server-side-third-party-api-proxy.md`](knowledge/decisions/0001-server-side-third-party-api-proxy.md) |
| Gemini API keys rotated via waterfall dam with cooldown gates | [`0002-gemini-key-waterfall-dam.md`](knowledge/decisions/0002-gemini-key-waterfall-dam.md) |
| Flight fare prediction via proxied ML microservice (LightGBM) | [`0003-flight-fare-ml-microservice.md`](knowledge/decisions/0003-flight-fare-ml-microservice.md) |

---

## 🚀 Deployment

### Frontend (Vercel)
1. Connect `Client/` folder to Vercel
2. Set `VITE_API_URL` to production backend URL
3. `vercel.json` handles `/api/*` rewrites to backend

### Backend (Render + Docker)
```bash
# Local Docker test
docker build -t tripzy-api ./Backend
docker run --env-file Backend/.env -p 5000:5000 tripzy-api
```

**Render Configuration** (`render.yaml`):
- Runtime: Docker
- Dockerfile: `./Backend/Dockerfile`
- Health check: `/api/health`
- Min 1 GB RAM (ML model loads in same container)
- Env vars: same as `.env` + `NODE_ENV=production`

### ML Service in Production
The Dockerfile starts both services via `entrypoint.sh`:
```bash
# Starts uvicorn (ML) on 8000 + tsx/node (Express) on 5000
# Both in same container, communicating via localhost
```

---

## 🧪 Development Workflow

### Backend Changes
```bash
cd Backend/server
# Edit files in src/
# Server auto-restarts (tsx watch)
curl -X POST http://localhost:5000/api/endpoint \
  -b cookies.txt -H "Content-Type: application/json" -d '{}'
```

### Frontend Changes
```bash
cd Client
# Edit files in src/
# Vite HMR updates browser instantly
```

### Database Migrations
```bash
cd Backend/server
# 1. Edit schema.ts
# 2. Generate migration
npx drizzle-kit generate
# 3. Apply to DB
npx drizzle-kit push --force
```

### Adding New AI Provider
1. Create `server/src/services/ai/newprovider.provider.ts`
2. Export `callNewProvider`, `classifyNewProviderError`
3. Register in `ai.service.ts` provider selection logic
4. Add env vars in `config/env.ts`

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **LightGBM** — Gradient boosting framework for flight fare prediction
- **Google Gemini** — Primary LLM for itinerary generation
- **NVIDIA** — Fallback LLM provider (Gemma, Nemotron models)
- **Neon** — Serverless PostgreSQL with connection pooling
- **Resend** — Transactional email for PDF delivery
- **OpenWeatherMap** — Weather data for dashboard widget
- **Indian domestic flight dataset** — 1.67M records for ML training

---

**Built with ❤️ for smarter travel planning**