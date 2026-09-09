# Tripzy Project - Complete Technical Documentation

**Last Updated:** 2025-09-04
**Project Root:** `D:/PS2/Tripzy`

---

## 📁 Project Structure Overview

```
D:/PS2/Tripzy/
├── client/                 # React + Vite + Tailwind Frontend (Port 5173)
├── server/                 # Express + TypeScript Backend (Port 5000)
├── ml-microservice/        # FastAPI + Python ML Service (Port 8000)
├── start-all.sh / .bat     # One-command startup scripts
├── stop-all.sh / .bat      # Cleanup scripts
├── CLAUDE.md               # Project instructions
└── temp.json               # Temporary data
```

---

## 🔧 Technology Stack

### Frontend (client/)
- **React 19** + **Vite 8** + **TypeScript**
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **React Router 7** for routing
- **Framer Motion** for animations
- **Lucide React** for icons
- **Recharts** for data visualization

### Backend (server/)
- **Express 5** + **TypeScript** (ESM)
- **Drizzle ORM** with **PostgreSQL (Neon)**
- **JWT Authentication** (httpOnly cookies)
- **Zod** for validation
- **Morgan** (logging) + **Helmet** (security) + **CORS**
- **tsx watch** for development

### ML Microservice (ml-microservice/)
- **FastAPI** + **Uvicorn**
- **LightGBM** for flight fare prediction
- **Pandas/NumPy/Scikit-learn** for feature engineering
- **Internal API key** authentication (server ↔ ML only)

---

## 🌐 Service Architecture

```
┌─────────────────┐     /api proxy      ┌─────────────────┐
│   React Client  │ ──────────────────► │  Express Server │
│   Port 5173     │                     │   Port 5000     │
└─────────────────┘                     └────────┬────────┘
                                                 │
                    Internal API (X-Internal-API-Key)
                                                 ▼
                                        ┌─────────────────┐
                                        │  ML Microservice│
                                        │   Port 8000     │
                                        └─────────────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │  Neon Postgres  │
                                        │  (Managed DB)   │
                                        └─────────────────┘
```

---

## 📦 Backend - Detailed File Map

### Core Configuration
| File | Purpose |
|------|---------|
| `server/src/index.ts` | App entry, middleware, routes, DB connection |
| `server/src/config/env.ts` | Zod-validated env config (Gemini, NVIDIA, DB, JWT) |
| `server/src/config/cors.ts` | CORS with credentials support |
| `server/drizzle.config.ts` | Drizzle config (PostgreSQL dialect) |
| `server/tsconfig.json` | TypeScript config (ESM, NodeNext) |

### Database Layer
| File | Purpose |
|------|---------|
| `server/src/db/client.ts` | pg Pool + Drizzle instance |
| `server/src/db/schema.ts` | **Main schema** - users, profiles, bookings, itineraries, search_history, flight_fare_predictions |
| `server/src/db/schema.sqlite.ts` | Legacy SQLite schema (unused) |

### Auth System
| File | Purpose |
|------|---------|
| `server/src/features/auth/auth.controller.ts` | signup, login, logout, refresh, me |
| `server/src/features/auth/auth.routes.ts` | `/auth/*` routes with rate limiting |
| `server/src/features/auth/auth.schema.ts` | Zod schemas for auth |
| `server/src/middlewares/auth.middleware.ts` | JWT verification (cookie + header) |
| `server/src/services/auth.service.ts` | Password hashing, JWT generation/verification |

### Flight Fare Feature
| File | Purpose |
|------|---------|
| `server/src/features/flightFare/flightFare.service.ts` | Calls ML microservice, saves to DB |
| `server/src/features/flightFare/flightFare.controller.ts` | `/api/flight-fare/predict`, `/history` |
| `server/src/features/flightFare/flightFare.repository.ts` | DB operations for predictions |

### Itinerary Feature (Complete AI Pipeline)
| File | Purpose |
|------|---------|
| `server/src/features/itinerary/itinerary.ai.service.ts` | **Core AI logic** - prompts, schema conversion, Gemini/NVIDIA calls |
| `server/src/features/itinerary/itinerary.service.ts` | Business logic - questions, answers, generation, PDF |
| `server/src/features/itinerary/itinerary.controller.ts` | All REST endpoints |
| `server/src/features/itinerary/itinerary.routes.ts` | Route definitions |
| `server/src/features/itinerary/itinerary.schema.ts` | **Zod schemas** - questions, itinerary, budget, places, etc. |
| `server/src/features/itinerary/itinerary.repository.ts` | DB operations |
| `server/src/features/itinerary/itinerary.template.ts` | Prompt templates |
| `server/src/features/itinerary/itinerary.formatter.ts` | Response formatting |

### AI Services (Multi-Provider)
| File | Purpose |
|------|---------|
| `server/src/services/ai/ai.service.ts` | **Unified service** - Gemini + NVIDIA fallback, circuit breakers, retries |
| `server/src/services/ai/gemini.provider.ts` | Gemini REST client, key waterfall, failure classification |
| `server/src/services/ai/nvidia.provider.ts` | NVIDIA API client (streaming, reasoning, images) |
| `server/src/services/ai/keyWaterfall.ts` | Key rotation with quota/exhaustion handling |
| `server/src/services/ai/opencode.provider.ts` | Unused legacy |

### Other Features
| Feature | Files |
|---------|-------|
| Weather | `weather.controller.ts`, `weather.service.ts`, `weather.routes.ts` |
| Search History | `search-history.controller.ts`, `repository.ts`, `routes.ts` |
| Bookings | `booking.controller.ts`, `repository.ts`, `routes.ts` |
| Users/Profile | `user.controllers.ts`, `user.repository.ts`, `profile.schema.ts` |
| Health | `health.controller.ts`, `health.routes.ts` |
| PDF | `services/pdf/pdf.service.ts` (itinerary PDF generation) |

---

## 🎨 Frontend - Detailed File Map

### App Structure
| File | Purpose |
|------|---------|
| `client/src/App.jsx` | Routes with ProtectedRoute wrapper |
| `client/src/main.jsx` | Entry point |
| `client/src/lib/authApi.js` | **All API calls** - auth, bookings, flight-fare, itinerary |
| `client/src/context/AuthContext.jsx` | Auth state management |

### Pages
| Page | Components |
|------|------------|
| **Landing** | Hero, Features, HowItWorks, Explore, FAQ, FinalCTA |
| **Auth** | LoginPage, SignupPage (AuthModal) |
| **Catalog** | CatalogHero, TopPicksSection, BoardingPassSearch |
| **Dashboard** | WelcomeBanner, TravelCostChart, TravelCostOverview, WeatherWidget, SeasonalPick, JourneyStats |
| **Trip** | FarePricesSection |
| **Profile** | ProfilePage |
| **Itinerary** | **ItineraryPlannerPage** (3-step AI flow) |

### Key Components
| Component | Purpose |
|-----------|---------|
| `UserNavbar` | Authenticated nav with user menu |
| `ProtectedRoute` | Wrapper for auth-required pages |
| `AuthModal` | Login/signup modal |
| `FarePricesSection` | Flight fare visualization |

---

## 🤖 ML Microservice

| File | Purpose |
|------|---------|
| `ml-microservice/app/main.py` | FastAPI app, `/health`, `/predict/window` |
| `ml-microservice/app/predictor.py` | LightGBM model loading, prediction logic |
| `ml-microservice/app/feature_engineering.py` | Feature extraction from raw data |
| `ml-microservice/app/schemas.py` | Pydantic request/response models |
| `ml-microservice/requirements.txt` | Python dependencies |

**Model:** LightGBM trained on 1.67M Indian domestic flight records, 1336 routes
**API:** `POST /predict/window` with `X-Internal-API-Key` header

---

## 🚀 Startup Scripts

### Unix/Git Bash (`start-all.sh`)
```bash
#!/usr/bin/env bash
# 1. Kills existing processes on ports 8000, 5000, 5173, 5174
# 2. Creates Python venv, installs ML deps
# 3. Starts ML microservice (uvicorn --reload)
# 4. Runs `drizzle-kit push --force` (DB migrations)
# 5. Starts Express server (tsx watch)
# 6. Starts React client (vite)
```

### Windows (`start-all.bat`)
- Opens 3 separate CMD windows for each service
- Uses `venv\Scripts\python` for ML service
- `npm run dev` for server and client

### Stop Scripts
- Kill by port (8000, 5000, 5173, 5174)
- Windows: also kills by window title

---

## ⚙️ Environment Variables

### Server (`server/.env`)
```env
NODE_ENV=development
PORT=5000
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

DATABASE_URL=postgresql://neondb_owner:***@ep-raspy-cake-b3u9t7xu-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

JWT_SECRET=dev-secret-change-in-production-1234567890

# ML Microservice
FASTAPI_ML_BASE_URL=http://127.0.0.1:8000
FASTAPI_ML_API_KEY=ml-internal-secret-key-12345

# Gemini
GEMINI_MODEL=gemini-3.5-flash
GEMINI_MODEL_FALLBACKS=gemini-3.6-flash,gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash
GEMINI_API_KEY_1=***
GEMINI_API_KEY_2=***
GEMINI_TIMEOUT_MS=60000

# NVIDIA (Fallback Provider)
NVIDIA_API_KEY=nvapi-***
NVIDIA_MODEL=google/gemma-4-31b-it
NVIDIA_MODEL_FALLBACKS=moonshotai/kimi-k3,deepseek-ai/deepseek-v4-flash-0731,nvidia/nemotron-3.5-lightning-30b-a3b,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
NVIDIA_TIMEOUT_MS=60000
```

### ML Microservice (`ml-microservice/.env`)
```env
ML_INTERNAL_API_KEY=ml-internal-secret-key-12345
```

---

## ✅ Working Features

### Fully Verified
| Feature | Status | Verified |
|---------|--------|----------|
| User Auth (signup/login/logout/refresh/me) | ✅ | ✅ |
| JWT httpOnly cookies + refresh rotation | ✅ | ✅ |
| Flight Fare Prediction (ML + DB save) | ✅ | ✅ |
| Itinerary List/Get by ID | ✅ | ✅ |
| Database Migrations (drizzle-kit push) | ✅ | ✅ |
| Protected Routes (frontend + backend) | ✅ | ✅ |
| React Proxy `/api` → `:5000` | ✅ | ✅ |
| ML Health Check (`/health`) | ✅ | ✅ |
| Server Health Check (`/api/health`) | ✅ | ✅ |

### Partially Working
| Feature | Issue |
|---------|-------|
| Itinerary Questions Generation | **Timeouts (60s)** - Gemini quota / NVIDIA fallback not triggering |
| Itinerary Direct Generation | **Timeouts** - Same as above |
| Itinerary Regenerate | **Timeouts** |
| PDF Download | **Connection reset** (exit code 56) |
| NVIDIA Provider | **Untested** - fallback logic exists but never verified |

---

## ❌ Known Issues & Root Causes

### 1. Neon Postgres Connection Instability
- **Symptom:** Server starts, then crashes with `Failed query: select 1` after ~2-5 minutes
- **Root Cause:** Neon connection pooling / SSL mode mismatch / connection timeout
- **Attempted Fixes:** Increased `connectionTimeoutMillis` to 30s, tried `ssl: { rejectUnauthorized: false }`
- **Status:** Unresolved - works intermittently

### 2. Itinerary AI Endpoints Timeout (60s)
- **Symptom:** `POST /api/itinerary/questions`, `/generate-direct`, `/generate` hang indefinitely
- **Root Cause:**
  - Gemini API keys likely exhausted (same keys used for flight-fare which works)
  - NVIDIA fallback not activating properly
  - `maxOutputTokens: 12000` for itinerary vs smaller for flight-fare
  - No request timeout enforcement in AI service
- **Evidence:** Flight-fare prediction works (smaller token usage), itinerary fails

### 3. NVIDIA Fallback Never Tested
- **Code exists** in `ai.service.ts` with smart routing
- **Never verified** if it actually activates when Gemini fails
- **API Keys** added to `.env` but no integration test performed

### 4. PDF Download Connection Reset
- **Exit code 56** on curl - likely server closes connection during PDF generation
- **Unverified** due to auth/timeout issues

### 5. Server Process Crashes
- **PID 11440** persisted across restarts
- `tsx watch` restarts on file changes but leaves orphan processes
- Need proper process management

---

## 🔧 How to Fix (Priority Order)

### 1. Fix Neon DB Stability (Critical)
```bash
# Test connection locally
npx tsx -e "
import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'YOUR_NEON_URL', connectionTimeoutMillis: 15000 });
pool.query('SELECT 1').then(() => console.log('OK')).catch(e => console.error(e)).finally(() => pool.end());
"
```
- Check Neon dashboard: connection limits, pooler status
- Try `sslmode=verify-full` in connection string
- Consider connection pooling middleware

### 2. Debug AI Timeout (High)
```typescript
// In ai.service.ts - add logging
console.log('[AI] Starting request:', { provider, model, tokens: options.maxOutputTokens });
// Add timeout wrapper
const result = await Promise.race([
  generateWithProvider(options),
  new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 30000))
]);
```
- Reduce `maxOutputTokens` from 12000 → 4000 for questions
- Add explicit 30s timeout per provider call
- Log which provider/model is being tried

### 3. Verify NVIDIA Fallback
```bash
# Test NVIDIA directly
curl -X POST https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemma-4-31b-it","messages":[{"role":"user","content":"test"}]}'
```
- Verify API key works
- Add NVIDIA health check to `/api/health`

### 4. Add Request Timeouts
```typescript
// In ai.service.ts
const TIMEOUT_MS = options.timeoutMs ?? 30000; // 30s max per call
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
// Pass signal to fetch calls
```

### 5. Fix Process Management
```bash
# In start-all.sh - track PIDs properly
echo "$ML_PID $SERVER_PID $CLIENT_PID" > .tripzy-pids
# In stop-all.sh - kill by PID file
```

---

## 📝 Development Workflow

### Making Backend Changes
```bash
# 1. Edit files in server/src/
# 2. Server auto-restarts (tsx watch)
# 3. Test with curl
curl -X POST http://localhost:5000/api/endpoint -b cookies.txt -H "Content-Type: application/json" -d '{}'
```

### Making Frontend Changes
```bash
# 1. Edit files in client/src/
# 2. Vite HMR updates browser instantly
# 3. Check browser console for errors
```

### Database Schema Changes
```bash
cd server
# 1. Edit server/src/db/schema.ts
# 2. Generate migration
npx drizzle-kit generate
# 3. Apply to DB
npx drizzle-kit push --force
```

### Adding New AI Provider
1. Create `server/src/services/ai/newprovider.provider.ts`
2. Export `callNewProvider`, `classifyNewProviderError`
3. Register in `ai.service.ts` provider selection logic
4. Add env vars in `env.ts`

---

## 🧪 Testing Endpoints

### Auth
```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"***"}' -c cookies.txt

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"***"}' -b cookies.txt -c cookies.txt

# Me
curl -X GET http://localhost:5000/api/auth/me -b cookies.txt
```

### Flight Fare
```bash
curl -X POST http://localhost:5000/api/flight-fare/predict \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"origin":"Delhi","destination":"Mumbai","startDate":"2025-12-01","windowDays":7}'
```

### Itinerary (when working)
```bash
# Questions
curl -X POST http://localhost:5000/api/itinerary/questions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"destination":"Goa","startDate":"2025-12-20","endDate":"2025-12-27"}'

# Generate Direct
curl -X POST http://localhost:5000/api/itinerary/generate-direct \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"destination":"Goa","startDate":"2025-12-20","endDate":"2025-12-27"}'
```

### ML Microservice
```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict/window \
  -H "X-Internal-API-Key: ml-internal-secret-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"origin":"Delhi","destination":"Mumbai","start_date":"2025-12-01","window_days":7}'
```

---

## 📊 Database Schema Summary

| Table | Key Columns |
|-------|-------------|
| `users` | id, name, email, password, role, created_at |
| `user_profiles` | user_id (PK), username, phone, dob, gender, bio, avatar, home_city, travel_interests[], budget_min/max, preferences |
| `bookings` | id, user_id, type (flight/hotel/etc), status, title, destination, origin, dates, guests, amount, reference |
| `itineraries` | id, user_id, title, destination, dates, total_days, budget, itineraryData (JSONB), userAnswers, status |
| `itinerary_questions` | id, itinerary_id, step, question, type, options, answer, is_required |
| `flight_fare_predictions` | id, user_id, origin, destination, search_start_date, window_days, best_*, results (JSONB) |
| `search_history` | id, user_id, query, filters |

---

## 🎯 Quick Reference Commands

```bash
# Start all
cd D:/PS2/Tripzy && ./start-all.sh

# Stop all
./stop-all.sh

# Server only
cd server && npm run dev

# Client only
cd client && npm run dev

# ML only
cd ml-microservice && ./venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# DB migrate
cd server && npx drizzle-kit push --force

# View logs
tail -f server/server.log
tail -f client/client.log
tail -f ml-microservice/ml.log
```

---

*Documentation generated from live codebase analysis. No changes made to source files during this scan.*