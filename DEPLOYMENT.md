# Deployment Guide — BoB Identity Trust Platform

Step-by-step guide to deploy the platform for hackathon demo or production pilot.

---

## Option A: Local Demo (Fastest — 5 minutes)

Best for hackathon judges and local presentation.

### Step 1 — Clone / Open Project
```powershell
cd C:\Users\modi jaimin\.gemini\antigravity\scratch\bob-trust-framework
```

### Step 2 — Configure Environment
Create `backend/.env`:
```env
PORT=5000
PYTHON_ENGINE_URL=http://localhost:5001
JWT_SECRET=your_secure_jwt_secret_here
AES_KEY=your_32_char_aes_encryption_key

# Optional — works without MongoDB (uses JSON file fallback)
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/identity_trust

# Optional — for AI explanations (falls back to rule-based if missing)
GEMINI_API_KEY=your_gemini_api_key
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Step 3 — Install Dependencies
Open **3 terminal windows**:

**Terminal 1 — Python Engine:**
```powershell
cd python_engine
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
✅ Expected: `Starting Python Risk Scoring microservice on port 5001...`

**Terminal 2 — Backend:**
```powershell
cd backend
npm install
npm run dev
```
✅ Expected: `Node.js Express Server running on port 5000...`

**Terminal 3 — Frontend:**
```powershell
cd frontend
npm install
npm run dev
```
✅ Expected: `Ready on http://localhost:3000`

### Step 4 — Verify
1. Open http://localhost:3000
2. Sign in as `bob_employee / employee123`
3. Go to **Customer Trust** → Run Scenario 1
4. Confirm Trust Score ≈ 95 and Decision = Allow Access

---

## Option B: MongoDB Atlas Setup

### Create Cluster
1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create **M0 Free Tier** cluster
3. **Database Access** → Create user with read/write
4. **Network Access** → Add IP `0.0.0.0/0` (demo only)
5. **Connect** → Drivers → Node.js → Copy connection string
6. Paste into `backend/.env` as `MONGODB_URI`

The backend auto-seeds demo users and cases on first connect.

---

## Option C: Deploy to Cloud (Production Pilot)

### Recommended Stack
| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | Connect GitHub repo, set `NEXT_PUBLIC_API_URL` |
| Backend | Railway / Render | Node.js, set all env vars |
| Python ML | Railway / Render | Separate service on port 5001 |
| Database | MongoDB Atlas | M0 free or M10 production |

### Deploy Backend (Render example)

1. Push code to GitHub
2. Create new **Web Service** on [render.com](https://render.com)
3. Root directory: `backend`
4. Build command: `npm install`
5. Start command: `node server.js`
6. Environment variables:
   ```
   PORT=5000
   PYTHON_ENGINE_URL=https://your-python-service.onrender.com
   JWT_SECRET=<strong-secret>
   AES_KEY=<strong-key>
   MONGODB_URI=<atlas-uri>
   GEMINI_API_KEY=<optional>
   ```

### Deploy Python Engine (Render)

1. New Web Service, root: `python_engine`
2. Build: `pip install -r requirements.txt`
3. Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
4. Add to `requirements.txt`: `gunicorn`

### Deploy Frontend (Vercel)

1. Import repo on [vercel.com](https://vercel.com)
2. Root directory: `frontend`
3. Environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   ```
4. Deploy

### CORS Update
In `backend/server.js`, update Socket.io CORS:
```javascript
const io = socketIo(server, {
  cors: {
    origin: ['https://your-frontend.vercel.app'],
    methods: ['GET', 'POST']
  }
});
```

---

## Option D: Docker (All-in-One)

Create `docker-compose.yml` at project root:

```yaml
version: '3.8'
services:
  python-engine:
    build: ./python_engine
    ports:
      - "5001:5001"
    environment:
      - PORT=5001

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - PYTHON_ENGINE_URL=http://python-engine:5001
      - JWT_SECRET=bob_trust_secret_key_1001
      - AES_KEY=bob_aes_encryption_secret_key_99
      - MONGODB_URI=${MONGODB_URI}
    depends_on:
      - python-engine

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5000
    depends_on:
      - backend
```

Run: `docker-compose up --build`

---

## AI Explainer API Keys

| Provider | Get Key | Env Variable |
|----------|---------|-------------|
| Google Gemini | [aistudio.google.com](https://aistudio.google.com) | `GEMINI_API_KEY` |
| OpenAI | [platform.openai.com](https://platform.openai.com) | `OPENAI_API_KEY` |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` |

If no key is set, the system uses a built-in rule-based explainer (always works offline).

---

## Health Checks

| Endpoint | Expected |
|----------|----------|
| `GET http://localhost:5001/health` | `{"status":"healthy"}` |
| `GET http://localhost:5000/api/demo/scenarios` | List of 5 scenarios |
| `POST http://localhost:5000/api/demo/run/scenario_1` | Trust score ~95 |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Frontend can't reach backend | Check `NEXT_PUBLIC_API_URL` in `.env.local` |
| Python engine timeout | Ensure port 5001 is running; backend falls back to Z-score |
| MongoDB connection failed | Backend auto-falls back to JSON files in `backend/mock_*.json` |
| JWT 401 on admin routes | Sign in as `bob_employee` or `bob_admin` first |
| OTP not working in demo | Use OTP `123456` |

---

## Hackathon Demo Script (3 minutes)

1. **0:00** — Open landing page, explain tagline and 9 engines
2. **0:30** — Sign in as `bob_employee`, show Fraud Operations Dashboard
3. **1:00** — **Customer Trust** → Run Scenario 1 (Trusted Login, Score 95)
4. **1:30** — Run Scenario 2 (New Device, OTP) and Scenario 3 (Recovery, Face)
5. **2:00** — Run Scenario 4 (KYC Fraud) → show alert in **Fraud Detection**
6. **2:30** — Run Scenario 5 (Insider Threat) → show **Case Management**
7. **3:00** — Show **Reports** and risk policy in **Settings**

---

## Security Notes for Production

- Replace all demo passwords before production
- Restrict MongoDB Atlas IP whitelist to your server IPs
- Use strong `JWT_SECRET` and `AES_KEY` (32+ characters)
- Enable HTTPS on all services
- Remove `0.0.0.0/0` from MongoDB network access
