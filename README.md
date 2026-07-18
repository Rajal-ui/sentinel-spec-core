# Sentinel Spec

### Autonomous Architecture Compliance Reviewer for IBM Bob IDE

![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.2.10-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)
![IBM Granite](https://img.shields.io/badge/IBM%20Granite-4--h-small--0F62FE?style=flat-square&logo=ibm)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![MCP](https://img.shields.io/badge/MCP-Enabled-orange?style=flat-square&logo=markdown)

---

## Description

Sentinel Spec is an autonomous architecture-compliance reviewer that intercepts policy violations at authorship time — inside IBM Bob IDE — and as a hard blocking gate in CI/CD pipelines, before a pull request ever exists. Engineers submit source files or code diffs through the analysis workspace; a dual-agent IBM Granite pipeline (Sentinel Classifier → Adversarial Critic) cross-references every submission against a 22-rule compliance matrix spanning secrets management, injection vectors, PII handling, API contracts, and architecture decisions. Each finding is returned with a severity tier, confidence score, cited ADR, machine-generated inline fix, and a full diff block. Every action — finding, override, approval — is written as an immutable lineage record, producing an auditor-ready decision trail that satisfies SOC 2, ISO 27001, and financial-services regulatory requirements.

The system is a three-service monorepo. The **Python compliance engine** (`app.py`) implements a hexagonal ports-and-adapters architecture: the domain layer has zero framework dependencies, a typed `AIEnginePort` abstract interface is satisfied by either the IBM Granite adapter (production) or a local regex engine (offline / `MOCK_MODE`), and the FastAPI surface exposes both synchronous and SSE-streaming evaluation endpoints. The **Node.js auth service** (`backend/`) is an Express + Prisma server that manages JWT authentication, Google OAuth 2.0, and the PostgreSQL user and findings ledger. The **Next.js frontend** (`frontend/`) is a React 19 dashboard providing the analysis workspace, governance audit console, analytics, and API export surface, with all client state managed by Zustand persistent stores and route protection enforced at the edge.

---

## Key Features

- **Dual-Agent IBM Granite Pipeline:** Agent 1 (Sentinel Classifier) evaluates the submitted code against the 22-rule compliance matrix using `ibm/granite-4-h-small` via the watsonx.ai SDK. Agent 2 (Adversarial Critic) independently verifies every classification through strict entailment checking to eliminate false positives before findings are emitted.

- **22-Rule Compliance Matrix:** Covers `SEC` (secrets, injection, transport), `ADR` (architecture decisions), `PII` (data residency, logging), and `API` (contract, versioning) domains. Each rule carries a `severity` (`CRITICAL` → `INFO`), a `FindingTier` routing decision (`blocking` → `logged_only`), and a human-readable remediation suggestion.

- **SSE Streaming with Live Thinking Log:** The `/evaluate/stream` endpoint yields granular `AgentThinkingStep` events — one per phase of the dual-agent DAG — so the IBM Bob IDE panel and the dashboard's ThinkingDrawer can animate the analysis in real time.

- **MOCK_MODE Zero-Cost Fallback:** Setting `MOCK_MODE=true` swaps the IBM adapter for `LocalAIEngine` — a pure-Python regex engine that covers the most critical rule patterns with no SDK or cloud dependency. The same port interface is satisfied; no domain or API code changes.

- **Governance Audit Console:** The full finding ledger is filterable by policy domain, finding tier, confidence range, override status, and date window. Override requests carry a full approval workflow (submit → approve / reject) with every state transition persisted and auditable.

- **Full-File Patch Download:** On finding resolution the dashboard reconstructs the complete corrected source file (`diff_old → diff_new` substitution against the original ingestion buffer) and triggers a named browser download (`billing_fixed.py`), eliminating manual apply steps.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            IBM Bob IDE / Browser                             │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │   Next.js Frontend  :3000        │
                    │   (React 19, Zustand, Tailwind)  │
                    │                                  │
                    │  Edge Middleware (proxy.ts)       │
                    │  → cookie-guard on /agent /audit │
                    └──────────┬──────────────┬────────┘
                               │              │
              ┌────────────────▼──┐    ┌──────▼──────────────────────┐
              │  Auth API  :4000  │    │  Compliance Engine  :8080   │
              │  Express + Prisma │    │  FastAPI + Uvicorn           │
              │  PostgreSQL (JWT) │    │                              │
              │  Google OAuth 2.0 │    │  POST /evaluate              │
              └───────────────────┘    │  POST /evaluate/stream (SSE) │
                                       │  GET  /compliance/matrix     │
                                       │  GET  /analytics/summary     │
                                       │  GET  /health                │
                                       │                              │
                                       │  ┌──────────────────────┐   │
                                       │  │  AIEnginePort (ABC)   │   │
                                       │  └────────┬─────────┬───┘   │
                                       │           │         │        │
                                       │    ┌──────▼──┐  ┌───▼─────┐ │
                                       │    │IBM      │  │Local    │ │
                                       │    │Adapter  │  │Adapter  │ │
                                       │    │Granite  │  │(regex)  │ │
                                       │    │+ COS    │  │MOCK_MODE│ │
                                       │    └─────────┘  └─────────┘ │
                                       └──────────────────────────────┘
```

**Request flow:**
1. Bob IDE / browser submits a code snippet or file diff
2. Next.js edge middleware validates the `sentinel-auth` session cookie
3. Frontend calls `POST /evaluate` (or `/evaluate/stream` for live thinking)
4. Compliance engine routes to `IBMAIEngine` or `LocalAIEngine` based on `MOCK_MODE`
5. Agent 1 classifies; Agent 2 critiques; findings are tier-routed and returned
6. Execution record is persisted to IBM Cloud Object Storage (when COS creds are set)
7. Frontend persists findings to the auth service's PostgreSQL ledger via `/v1/findings/bulk`

---

## Technology Stack

### Compliance Engine (Python)

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.13 | Runtime |
| FastAPI | 0.115.6 | REST API framework + SSE streaming |
| Uvicorn | 0.32.1 | ASGI server (2 workers, port 8080) |
| ibm-watsonx-ai | 1.5.14 | IBM Granite model inference SDK |
| ibm-cos-sdk | 2.13.6 | IBM Cloud Object Storage — execution record persistence |
| Pydantic | 2.10.4 | Request/response schema validation |
| httpx | 0.28.1 | Async HTTP client |

### Auth Service (Node.js)

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20.x | Runtime |
| Express | 4.21.x | HTTP server |
| Prisma | 6.2.x | PostgreSQL ORM + migrations |
| jsonwebtoken | 9.0.x | JWT access + refresh token issuance |
| passport-google-oauth20 | 2.0.x | Google OAuth 2.0 strategy |
| bcryptjs | 2.4.x | Password hashing |
| Zod | 4.4.x | Request body validation |
| helmet + express-rate-limit | latest | Security hardening |

### Frontend (Next.js)

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.10 | App Router, SSR, edge middleware |
| React | 19.2.4 | UI component model |
| TypeScript | 5.x | Static typing |
| Tailwind CSS | 4.x | Utility-first glassmorphic styling |
| Zustand | 5.0.14 | Persistent client state management |
| Framer Motion | 12.x | Animations, streaming cursor, transitions |
| Recharts | 3.x | Trend charts, domain bar charts |
| Axios | 1.18.x | HTTP client with auth interceptors |
| Zod | 4.x | Form schema validation |

---

## Project Structure

```
sentinel-spec/
│
├── app.py                        # FastAPI compliance engine entrypoint
├── main.py                       # CLI entrypoint (direct engine invocation)
├── bob_bridge.py                 # IBM Bob IDE execution bridge (stdout JSON)
├── requirements.txt              # Python production dependencies (pinned)
├── Dockerfile                    # Multi-stage Python 3.13-slim image (port 8080)
├── .dockerignore
├── SEC-POLICY-credential-handling.md  # Accepted security ADR (SEC-001, SEC-013, TLS-001)
├── sentinel_spec_openapi.json    # OpenAPI 3.1.0 spec (served by /export page)
│
├── domain/                       # Zero-dependency domain layer
│   ├── models.py                 # Frozen dataclasses: CodeSnippet, ComplianceReport,
│   │                             #   ComplianceViolation, ClassificationResult,
│   │                             #   CriticVerdict, AgentThinkingStep, ExecutionRecord
│   └── __init__.py
│
├── ports/                        # Abstract interface layer
│   ├── ai_engine_port.py         # AIEnginePort ABC — evaluate_code / evaluate_code_stream
│   └── __init__.py
│
├── adapters/                     # Concrete port implementations
│   ├── ibm.py                    # IBMAIEngine — Granite dual-agent + COS persistence
│   ├── local.py                  # LocalAIEngine — regex engine, MOCK_MODE fallback
│   └── __init__.py
│
├── backend/                      # Auth & data service (Node.js / Express)
│   ├── src/
│   │   ├── app.ts                # Express server bootstrap
│   │   ├── config/               # env, CORS, database, Passport config
│   │   ├── controllers/          # auth, findings, analytics, user controllers
│   │   ├── middleware/           # authenticate, validate, errorHandler
│   │   ├── routes/               # auth, findings, analytics, user route handlers
│   │   ├── services/             # auth, OAuth, token services
│   │   ├── types/                # Shared TypeScript types
│   │   └── utils/                # cookies, errors, snakecase helpers
│   ├── prisma/                   # Prisma schema + migrations
│   ├── package.json
│   └── .env.example
│
├── frontend/                     # Next.js dashboard (React 19)
│   ├── app/
│   │   ├── page.tsx              # Landing page (public)
│   │   ├── layout.tsx            # Root layout — theme init, AuthSyncProvider
│   │   ├── agent/page.tsx        # Primary analysis workspace (protected)
│   │   ├── audit/page.tsx        # Governance audit console (protected)
│   │   ├── analytics/page.tsx    # KPI dashboards and trend charts (protected)
│   │   ├── export/page.tsx       # OpenAPI spec viewer and download
│   │   ├── docs/page.tsx         # Architecture blueprint
│   │   ├── how-it-works/         # Pipeline explainer
│   │   └── ibm-integration/      # IBM watsonx services detail
│   ├── components/
│   │   ├── AnalysisFeed.tsx      # Streaming chat-style message thread
│   │   ├── HistoryPanel.tsx      # Session history with metric chip strip
│   │   ├── ViolationCard.tsx     # Finding card with diff + patch download
│   │   ├── layout/               # AppShell, TopBar, Sidebar, LoginModal, ThinkingDrawer
│   │   └── shared/               # CodeBlock, ConfidenceBar, StatusBadge, StatsRow, Leaderboard
│   ├── lib/
│   │   ├── api.ts                # Axios singleton with Bearer token interceptors
│   │   ├── types.ts              # Canonical TypeScript domain interfaces
│   │   └── store/                # Zustand stores: auth, session, findings, theme
│   ├── proxy.ts                  # Next.js edge middleware — route protection
│   └── package.json
│
├── Documentation/                # Extended design and architecture documents
├── Testing-example-files/        # Example source files for manual engine testing
└── deploy/                       # Deployment manifests (IBM Code Engine, etc.)
```

---

## Getting Started

### Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Python | 3.13 | Compliance engine runtime |
| Node.js | 20.x | Auth service + frontend |
| npm | 10.x | Package management |
| PostgreSQL | 15.x | Auth service database |
| IBM Cloud account | — | Required for `MOCK_MODE=false` only |

---

### 1 · Compliance Engine (Python)

```bash
# Clone the repository
git clone https://github.com/your-org/sentinel-spec.git
cd sentinel-spec

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install production dependencies
pip install -r requirements.txt

# Run in MOCK_MODE (no IBM credentials required)
MOCK_MODE=true uvicorn app:app --host 0.0.0.0 --port 8080 --reload

# Run against live IBM Granite (set credentials first — see Environment Configuration)
MOCK_MODE=false uvicorn app:app --host 0.0.0.0 --port 8080 --reload
```

**Verify the engine is running:**

```bash
curl http://localhost:8080/health
# {"status":"ok"}

curl -X POST http://localhost:8080/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "content": "ibm_secret_access_key = \"AKIAIOSFODNN7EXAMPLE\"",
    "file_path": "demo.py",
    "language": "python"
  }'
```

**CLI invocation (without HTTP server):**

```bash
python main.py
# Bootstrapped engine: LocalAIEngine
# Compliance status: violations detected
# - SEC-001 [CRITICAL] line 2: Hard-coded cloud credential detected in source code.
#   Suggested fix: Remove the hard-coded credential and inject it at runtime via IBM Secrets Manager.
```

**Bob IDE bridge:**

```bash
python bob_bridge.py path/to/target_file.py
# Outputs a JSON array of Bob-structured diagnostic findings to stdout
```

---

### 2 · Auth Service (Node.js)

```bash
cd backend

# Install dependencies
npm install

# Copy and edit environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT secrets, Google OAuth credentials

# Initialise the database
npm run db:generate   # generate Prisma client
npm run db:push       # push schema to PostgreSQL (dev)
# npm run db:migrate  # use migrations in production

# Start the development server
npm run dev
# Auth API available at http://localhost:4000
```

---

### 3 · Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
echo "NEXT_PUBLIC_AUTH_API_URL=http://localhost:4000/api" > .env.local

# Start the development server
npm run dev
# Dashboard available at http://localhost:3000
```

---

## Environment Configuration

### Compliance Engine (`/` root — set as process environment or in `.env`)

| Variable | Description | Required | Example |
|---|---|---|---|
| `MOCK_MODE` | `true` → LocalAIEngine (regex, no IBM SDK); `false` → IBMAIEngine | N | `false` |
| `WATSONX_API_KEY` | IBM Cloud API key for watsonx.ai inference | Only if `MOCK_MODE=false` | `abc123...` |
| `WATSONX_URL` | watsonx.ai service URL | Only if `MOCK_MODE=false` | `https://us-south.ml.cloud.ibm.com` |
| `WATSONX_PROJECT_ID` | watsonx.ai project GUID | Only if `MOCK_MODE=false` | `a1b2c3d4-...` |
| `WATSONX_MODEL_ID` | Granite model ID | N | `ibm/granite-4-h-small` |
| `COS_API_KEY` | IBM COS API key for execution record persistence | N | `abc123...` |
| `COS_INSTANCE_CRN` | IBM COS service instance CRN | N | `crn:v1:bluemix:...` |
| `COS_ENDPOINT` | IBM COS regional endpoint | N | `https://s3.us-south.cloud-object-storage.appdomain.cloud` |
| `COS_BUCKET` | COS bucket name for execution records | N | `sentinel-records` |

### Auth Service (`backend/.env`)

| Variable | Description | Required | Example |
|---|---|---|---|
| `PORT` | Server port | N | `4000` |
| `NODE_ENV` | Runtime environment | N | `development` |
| `DATABASE_URL` | PostgreSQL connection string | **Y** | `postgresql://user:pass@localhost:5432/sentinel` |
| `JWT_ACCESS_SECRET` | 64-char secret for access token signing | **Y** | `change-me-...` |
| `JWT_REFRESH_SECRET` | 64-char secret for refresh token signing | **Y** | `change-me-...` |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | N | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | N | `7d` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | N | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | N | `GOCSPX-...` |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI | N | `http://localhost:4000/api/auth/google/callback` |
| `CLIENT_URL` | Frontend origin for CORS | N | `http://localhost:3000` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Required | Example |
|---|---|---|---|
| `NEXT_PUBLIC_AUTH_API_URL` | Auth + data service base URL | **Y** | `http://localhost:4000/api` |

---

## Docker (Compliance Engine)

The `Dockerfile` builds a two-stage Python 3.13-slim image targeting IBM Code Engine (port 8080, 2 Uvicorn workers).

```bash
# Build
docker build -t sentinel-spec-engine .

# Run in MOCK_MODE
docker run -p 8080:8080 -e MOCK_MODE=true sentinel-spec-engine

# Run with IBM credentials
docker run -p 8080:8080 \
  -e MOCK_MODE=false \
  -e WATSONX_API_KEY=your_key \
  -e WATSONX_URL=https://us-south.ml.cloud.ibm.com \
  -e WATSONX_PROJECT_ID=your_project_id \
  sentinel-spec-engine
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/evaluate` | Synchronous compliance check — returns `ComplianceReport` |
| `POST` | `/evaluate/stream` | SSE streaming — yields `AgentThinkingStep` events then final report |
| `GET` | `/compliance/matrix` | Returns all 22 rules with domain, severity, and rule ID |
| `GET` | `/analytics/summary` | Aggregated analytics (violation counts, trends) |
| `GET` | `/health` | Liveness probe — `{"status": "ok"}` |
| `POST` | `/api/auth/login` | Authenticate with email + password → JWT |
| `POST` | `/api/auth/register` | Register new user account |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/google` | Initiate Google OAuth 2.0 flow |
| `GET` | `/api/user/me` | Fetch authenticated user profile |
| `GET` | `/api/findings` | List governance findings (filterable) |
| `POST` | `/api/findings/bulk` | Persist a batch of findings from an analysis run |
| `PATCH` | `/api/findings/:id/resolve` | Mark a finding as resolved |
| `GET` | `/api/analytics/summary` | KPI summary for the dashboard |

The full OpenAPI 3.1.0 specification is available at `sentinel_spec_openapi.json` and rendered in-app at `/export`.

---

## User Roles

| Role | Capabilities |
|---|---|
| `developer` | Submit code for analysis; view own session history and findings |
| `compliance_officer` | Approve or reject override requests; full audit console access |
| `engineering_manager` | View analytics dashboards, leaderboards, and team governance reports |
| `admin` | Full access to all features including user management |

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`
2. For Python changes — ensure `MOCK_MODE=true` tests pass before touching the IBM adapter
3. For frontend changes — run `npm run lint` and `npx tsc --noEmit --skipLibCheck` with zero new errors
4. Keep changes minimal and traceable: every modified line must map to a stated requirement
5. Open a pull request against `main` with a clear description of what changed and why

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for the full text.


