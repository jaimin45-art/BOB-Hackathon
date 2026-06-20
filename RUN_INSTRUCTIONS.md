# Run Instructions — BoB Identity Trust Platform

### `backend/.env`
```env
PORT=5000
PYTHON_ENGINE_URL=http://localhost:5001
JWT_SECRET=bob_trust_secret_key_1001
AES_KEY=bob_aes_encryption_secret_key_99

# Optional — MongoDB Atlas (works without it via JSON fallback)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/identity_trust?retryWrites=true&w=majority

# Optional — AI Explainer (provide at least one, or use built-in fallback)
GEMINI_API_KEY=your_key_here
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Step-by-Step Running Guide

Open **3 terminal windows**:

### Terminal 1 — Python Risk Engine
```powershell
cd bob-trust-framework
cd python engine
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Runs on **http://localhost:5001**

### Terminal 2 — Node.js Backend
```powershell
cd bob-trust-framework
cd backend
npm install
npm run dev
```
Runs on **http://localhost:5000**

### Terminal 3 — Next.js Frontend
```powershell
cd bob-trust-framework
cd frontend
npm install
npm run dev
```
Runs on **http://localhost:3000**

---

## Demo Walkthrough

### For Judges (3-minute demo)
1. Open **http://localhost:3000**
2. Sign in: `bob_employee` / `employee123`
3. Navigate to **Customer Trust**
4. Run each of the 5 demo scenarios — each shows live trust score, factors, and decision
5. Check **Fraud Detection** for alerts, **Case Management** for open cases

### Customer Experience
1. Sign in: `bob_customer` / `customer123`
2. View live **Identity Trust Score** in sidebar
3. Try a fund transfer — risk engine evaluates in real-time

### Fraud Operations
1. Sign in: `bob_employee` / `employee123`
2. **Dashboard** — KPIs, multi-channel status, architecture flow
3. **Risk Center** — click any log for full explainable breakdown
4. **Fraud Detection** — review KYC queue and active alerts
5. **Employee Monitoring** — log employee activity for risk scoring
6. **Case Management** — investigate and resolve cases
7. **Reports** — compliance metrics

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with trust evaluation |
| POST | `/api/auth/verify-step-up` | OTP / Face verification |
| POST | `/api/trust/evaluate` | Evaluate any banking action |
| POST | `/api/demo/run/:scenarioId` | Run demo scenario 1–5 |
| POST | `/api/kyc/onboard` | KYC fraud evaluation |
| POST | `/api/employee/activity` | Employee activity monitoring |
| GET | `/api/admin/cases` | List investigation cases |
| GET | `/api/admin/reports` | Compliance reports |
| GET | `/api/admin/stats` | Dashboard KPIs |

---

## MongoDB Atlas Setup (Optional)

1. Create free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create M0 cluster
3. Database Access → create user
4. Network Access → Add IP `0.0.0.0/0`
5. Connect → Drivers → copy URI to `MONGODB_URI`

---

## Gemini API Key (Optional)

1. Visit [aistudio.google.com](https://aistudio.google.com)
2. Get API Key → Create
3. Add to `backend/.env` as `GEMINI_API_KEY`

Without any AI key, the system uses built-in explainable rule templates.

---

See **DEPLOYMENT.md** for cloud deployment instructions.
