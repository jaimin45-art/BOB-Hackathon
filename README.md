# BoB Identity Trust Platform

**Bank of Baroda — Continuous Trust. Frictionless Banking.**

A privacy-first, risk-based Identity Trust Framework that continuously validates customer and enterprise identities across digital banking channels. Verification is triggered only when risk increases — not on every interaction.

---

## Problem This Solves

> *"How can Bank of Baroda continuously trust an identity without forcing verification on every user interaction?"*

This platform answers that question with continuous trust scoring, adaptive step-up authentication, and explainable decisions across all banking channels.

---

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js | Customer NetBanking + Fraud Operations Dashboard |
| Backend API | Node.js + Express | REST APIs, JWT auth, WebSocket live monitoring |
| Risk Engine | Node.js rules + Python scikit-learn | Rule-based scoring + behavioral anomaly detection |
| Database | MongoDB Atlas (JSON fallback) | Sessions, risk logs, cases, audit trail |
| AI Explainer | Gemini / OpenAI / Anthropic | Plain-language risk explanations |
| Real-time | Socket.io | Live session monitoring for fraud ops |
| Security | bcrypt, AES-256, JWT | Password hashing, encrypted telemetry, RBAC |

### Core Engines

1. **Identity Trust Engine** — Continuous trust score (0–100)
2. **Risk Scoring Engine** — Rule-based + ML behavioral model
3. **Device Intelligence Layer** — New device / fingerprint detection
4. **Behavioral Analytics Engine** — Typing rhythm, scroll, navigation
5. **Fraud Detection Engine** — ATO, KYC fraud, recovery fraud
6. **Insider Threat Engine** — Employee activity monitoring
7. **Verification Orchestrator** — OTP / Face / Block decisions
8. **Case Management System** — Alert → Investigate → Resolve workflow
9. **Audit & Compliance Layer** — Encrypted logs, full audit trail

---

## Risk-Based Authentication Policy

| Risk Score | Level | Action |
|-----------|-------|--------|
| 0 – 30 | Trusted | Allow Access |
| 31 – 60 | Elevated | OTP Verification |
| 61 – 80 | High Risk | Face Verification |
| 81 – 100 | Critical | Block and Escalate |

---

## Demo Scenarios (For Judges)

Sign in as **bob_employee / employee123** → go to **Customer Trust** → run any scenario:

| # | Scenario | Expected Trust | Decision |
|---|----------|---------------|----------|
| 1 | Trusted Customer Login | 95 | Allow Access |
| 2 | New Device Login | 62 | OTP Required |
| 3 | Password Reset + New Device | 38 | Face Verification |
| 4 | Suspicious KYC Application | Critical | Fraud Alert |
| 5 | Employee VIP Account Access | Critical | Insider Alert |

Each scenario shows: **Problem → Detection → Risk Calculation → Decision → Outcome**

---

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB Atlas account (optional — works without it)

### 1. Backend
```powershell
cd backend
npm install
# Create backend/.env (see RUN_INSTRUCTIONS.md)
npm run dev
```

### 2. Python ML Engine
```powershell
cd python_engine
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### Demo Credentials
| Role | Username | Password |
|------|----------|----------|
| Customer | bob_customer | customer123 |
| Fraud Ops | bob_employee | employee123 |
| Admin | bob_admin | admin123 |

---

## Project Structure

```
bob-trust-framework/
├── frontend/          # Next.js UI (customer + ops dashboard)
├── backend/           # Express API + Socket.io + risk engine
│   └── services/
│       ├── riskEngine.js    # Core trust scoring rules
│       ├── ai_explainer.js  # LLM explainable AI
│       └── crypto.js        # AES encryption
├── python_engine/     # scikit-learn behavioral anomaly model
├── RUN_INSTRUCTIONS.md
└── DEPLOYMENT.md
```

---

## Multi-Channel Support

The same Trust Engine protects:
- Internet Banking
- Mobile Banking
- ATM
- Employee Portal
- Customer Support Portal

---

## License

Built for Bank of Baroda Identity Trust Framework hackathon demonstration.
