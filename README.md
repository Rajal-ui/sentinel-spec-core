# Sentinel Spec

### Universal Architecture Compliance Reviewer — Any IDE, Any Pipeline

![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15.x-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.x-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)
![IBM Granite](https://img.shields.io/badge/IBM%20Granite-4--h--small-0F62FE?style=flat-square&logo=ibm)
![MCP](https://img.shields.io/badge/MCP-Enabled-orange?style=flat-square&logo=markdown)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Description

Sentinel Spec is a universal, IDE-agnostic architecture compliance reviewer that intercepts policy violations at authorship time and enforces them as hard blocking gates in CI/CD pipelines — before a pull request ever exists. Engineers submit source files or code diffs through any supported integration surface (Web Dashboard, CLI, MCP Server, or IDE bridge); a dual-agent IBM Granite pipeline — **Sentinel Classifier → Adversarial Critic** — cross-references every submission against a **22-rule compliance matrix** spanning secrets management, injection vectors, PII handling, API contracts, and architecture decisions.

Each finding is returned with a severity tier, confidence score, cited ADR, machine-generated inline fix, and a full diff block. Every action — finding, override, approval — is written as an immutable lineage record and forwarded to IBM watsonx.governance, producing an auditor-ready decision trail that satisfies SOC 2, ISO 27001, and financial-services regulatory requirements.

**MCP (Model Context Protocol) support** is the primary driver for IDE-agnostic integration: the compliance engine can be registered as an MCP server, enabling any MCP-compatible IDE (Cursor, VS Code + Copilot, Windsurf, JetBrains AI, Claude Desktop, and others) to invoke compliance checks directly from the editor without any custom plugin.

The system is a three-service monorepo. The **Python compliance engine** (`app.py`) implements a hexagonal ports-and-adapters architecture: the domain layer has zero framework dependencies, a typed `AIEnginePort` abstract interface is satisfied by either the IBM Granite adapter (production) or a local regex engine (`MOCK_MODE`), and the FastAPI surface exposes synchronous, SSE-streaming, multi-file, and conversational evaluation endpoints. The **Node.js auth service** (`backend/`) is an Express + Prisma server managing JWT authentication, Google OAuth 2.0, and the PostgreSQL user and findings ledger. The **Next.js frontend** (`frontend/`) is a React 19 dashboard providing the analysis workspace, governance audit console, analytics, and OpenAPI export surface, with all client state managed by Zustand persistent stores and route protection enforced at the edge.

---

## Key Features

- **Dual-Agent IBM Granite Pipeline:** Agent 1 (Sentinel Classifier) evaluates submitted code against the 22-rule compliance matrix using `ibm/granite-4-h-small` via the watsonx.ai SDK. Agent 2 (Adversarial Critic) independently verifies every classification through strict entailment checking to eliminate false positives before findings are emitted.

- **22-Rule Compliance Matrix:** Covers `SEC` (secrets, injection, transport), `ARCH` (architecture decisions, hexagonal domain leakage, direct DB calls), `PII` (data residency, logging), and `QUAL` (unsafe deserialization, API contract) domains. Each rule carries a `severity` (`CRITICAL` → `INFO`), a `FindingTier` routing decision (`blocking` → `logged_only`), and a human-readable remediation suggestion.

- **IDE-Agnostic Integration via MCP:** The compliance engine registers as a Model Context Protocol (MCP) server, allowing any MCP-compatible IDE or AI assistant to call compliance checks as structured tool invocations — no custom plugins required.

- **Multi-File & Streaming Evaluation:** The `/evaluate` endpoint accepts both single-file and multi-file payloads. The `/evaluate/stream` SSE endpoint yields granular `AgentThinkingStep` events per phase of the dual-agent DAG so any connected IDE panel or the dashboard ThinkingDrawer can animate the analysis in real time.

- **MOCK_MODE Zero-Cost Fallback:** Setting `MOCK_MODE=true` swaps the IBM adapter for `LocalAIEngine` — a pure-Python regex engine covering the most critical rule patterns with no SDK or cloud dependency. The same port interface is satisfied; no domain or API code changes.

- **watsonx.governance Lineage Tracking:** Every evaluation event and human override is asynchronously logged to IBM watsonx.governance via `WatsonxGovernanceAdapter`, producing a tamper-evident audit trail for model risk management frameworks.

- **Override Workflow with Full Approval Chain:** Override requests carry a structured approval workflow (submit → approve / reject) with every state transition persisted and auditable through the Governance Audit Console.

- **Full-File Patch Download:** On finding resolution, the dashboard reconstructs the complete corrected source file (`diff_old → diff_new` substitution) and triggers a browser download, eliminating manual apply steps.

- **OpenAPI 3.1.0 Export:** The full machine-readable API specification is available at `sentinel_spec_openapi.json` and rendered in-app at `/export`, enabling direct import into watsonx Orchestrate as a reusable Agent-as-Code skill.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│               Trigger Surface  (choose any or all)                        │
│                                                                           │
│   ┌─────────────────┐   ┌──────────────────┐   ┌───────────────────────┐ │
│   │  Web Dashboard  │   │  CLI  (main.py)  │   │  MCP Server / IDE     │ │
│   │  (Next.js :3000)│   │  Direct engine   │   │  (any MCP-compatible  │ │
│   │                 │   │  invocation      │   │  IDE or AI assistant) │ │
│   └────────┬────────┘   └────────┬─────────┘   └──────────┬────────────┘ │
└────────────┼─────────────────────┼────────────────────────┼──────────────┘
             │                     │                         │
             ▼                     │                         │
  ┌──────────────────────┐         │                         │
  │  Next.js Frontend    │         │                         │
  │  (React 19, Zustand) │         │                         │
  │  Edge Middleware     │         │                         │
  │  → cookie-guard on   │         │                         │
  │    /agent /audit     │         │                         │
  └──────────┬───────────┘         │                         │
             │                     │                         │
     ┌───────▼───────┐             └──────────┬──────────────┘
     │  Auth API     │                        │
     │  :4000        │             ┌──────────▼──────────────────────────┐
     │  Express +    │             │       Compliance Engine  :8080       │
     │  Prisma       │             │       FastAPI + Uvicorn              │
     │  PostgreSQL   │             │                                      │
     │  JWT + Google │             │  POST /evaluate          (sync)      │
     │  OAuth 2.0    │             │  POST /evaluate/stream   (SSE)       │
     └───────────────┘             │  POST /override                      │
                                   │  GET  /compliance/matrix             │
                                   │  GET  /analytics/summary             │
                                   │  GET  /health                        │
                                   │                                      │
                                   │  ┌──────────────────────────────┐   │
                                   │  │       AIEnginePort (ABC)      │   │
                                   │  └──────────┬──────────┬─────────┘  │
                                   │             │          │             │
                                   │      ┌──────▼──┐  ┌────▼──────┐    │
                                   │      │IBM      │  │Local      │    │
                                   │      │Adapter  │  │Adapter    │    │
                                   │      │Granite  │  │(regex)    │    │
                                   │      │+ Gov.   │  │MOCK_MODE  │    │
                                   │      └─────────┘  └───────────┘    │
                                   └─────────────────────────────────────┘
```

**Request flow:**
1. A trigger surface (Web Dashboard, CLI, MCP server, or IDE bridge) submits a code snippet or file diff
2. Next.js edge middleware validates the `sentinel-auth` session cookie (dashboard path only)
3. The engine receives `POST /evaluate` (sync) or `POST /evaluate/stream` (SSE with live thinking)
4. The compliance engine routes to `IBMAIEngine` or `LocalAIEngine` based on `MOCK_MODE`
5. Agent 1 (Sentinel Classifier) classifies; Agent 2 (Adversarial Critic) verifies; findings are tier-routed and returned
6. `WatsonxGovernanceAdapter` asynchronously logs the evaluation event to IBM watsonx.governance
7. The frontend or calling client persists findings to the auth service PostgreSQL ledger via `/v1/findings/bulk`

---

## IDE-Agnostic Integration

Sentinel Spec exposes its compliance engine as an **MCP (Model Context Protocol) server**, making it natively callable from any MCP-compatible IDE or AI coding assistant.

### Supported Integration Surfaces

| Surface | Mechanism | Notes |
|---|---|---|
| **Cursor** | MCP Server (`.cursor/mcp.json`) | Register the engine URL as an MCP tool |
| **VS Code + GitHub Copilot** | MCP Server (`.vscode/mcp.json`) | Requires Copilot with MCP support |
| **Windsurf** | MCP Server config | Point to `http://localhost:8080` |
| **JetBrains AI** | MCP Server config | Configure in IDE AI settings |
| **Claude Desktop** | MCP Server (`claude_desktop_config.json`) | Full tool call support |
| **watsonx Orchestrate** | OpenAPI skill import | Import `sentinel_spec_openapi.json` as Agent-as-Code skill |
| **Web Dashboard** | Next.js frontend `:3000` | Full governance UI with audit console |
| **CLI** | `python main.py` / `python bob_bridge.py` | Direct engine invocation, JSON output |
| **CI/CD Gate** | `curl POST /evaluate` | Hard-blocking gate before PR creation |

### MCP Server Registration

Add this block to your IDE MCP config file (e.g., `.cursor/mcp.json`, `.vscode/mcp.json`, or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sentinel-spec": {
      "url": "http://localhost:8080",
      "description": "Sentinel Spec — Universal Architecture Compliance Engine"
    }
  }
}
```

Once registered, invoke compliance checks directly from your IDE AI assistant chat or command palette.

---

## Installation

### Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Python | 3.13 | Compliance engine runtime |
| Node.js | 20.x | Auth service + frontend |
| npm | 10.x | Package management |
| PostgreSQL | 15.x | Auth service database |
| IBM Cloud account | — | Required only when `MOCK_MODE=false` |

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
# {"status":"ok","engine":"LocalAIEngine","model":"local","mock_mode":true}

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

**IDE bridge (stdout JSON, auto-fallback to local engine):**

```bash
python bob_bridge.py path/to/target_file.py
# Outputs a JSON array of structured diagnostic findings to stdout.
# Automatically falls back to LocalAIEngine if IBM credentials are unavailable.
```

---

### 2 · Auth Service (Node.js)

```bash
cd backend

npm install

cp .env.example .env
# Edit .env — set DATABASE_URL, JWT secrets, Google OAuth credentials

npm run db:generate   # generate Prisma client
npm run db:push       # push schema to PostgreSQL (dev)
# npm run db:migrate  # use migrations in production

npm run dev
# Auth API available at http://localhost:4000
```

---

### 3 · Frontend (Next.js)

```bash
cd frontend

npm install

echo "NEXT_PUBLIC_AUTH_API_URL=http://localhost:4000/api" > .env.local

npm run dev
# Dashboard available at http://localhost:3000
```

---

## Technology Stack

### Compliance Engine (Python)

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.13 | Runtime |
| FastAPI | 0.115.x | REST API framework + SSE streaming |
| Uvicorn | 0.32.x | ASGI server (2 workers, port 8080) |
| ibm-watsonx-ai | 1.5.x | IBM Granite model inference + governance SDK |
| ibm-cos-sdk | 2.13.x | IBM Cloud Object Storage — execution record persistence |
| Pydantic | 2.10.x | Request/response schema validation |
| httpx | 0.28.x | Async HTTP client |

### Auth Service (Node.js)

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20.x | Runtime |
| Express | 4.21.x | HTTP server |
| Prisma | 6.2.x | PostgreSQL ORM + migrations |
| jsonwebtoken | 9.0.x | JWT access + refresh token issuance |
| passport-google-oauth2 | 2.0.x | Google OAuth 2.0 strategy |
| bcryptjs | 2.4.x | Password hashing |
| Zod | 4.x | Request body validation |
| helmet + express-rate-limit | latest | Security hardening |

### Frontend (Next.js)

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.x | App Router, SSR, edge middleware |
| React | 19.x | UI component model |
| TypeScript | 5.x | Static typing |
| Tailwind CSS | 4.x | Utility-first glassmorphic styling |
| Zustand | 5.x | Persistent client state management |
| Framer Motion | 12.x | Animations, streaming cursor, transitions |
| Recharts | 3.x | Trend charts, domain bar charts |
| Axios | 1.x | HTTP client with auth interceptors |

---

## Project Structure

```
sentinel-spec/
│
├── app.py                        # FastAPI compliance engine (v2.0.0)
├── main.py                       # CLI entrypoint (direct engine invocation)
├── bob_bridge.py                 # IDE execution bridge (stdout JSON, auto-fallback)
├── requirements.txt              # Python production dependencies (pinned)
├── Dockerfile                    # Multi-stage Python 3.13-slim image (port 8080)
├── sentinel_spec_openapi.json    # OpenAPI 3.1.0 spec (served at /export; importable as watsonx skill)
│
├── domain/                       # Zero-dependency domain layer
│   └── models.py                 # Frozen dataclasses: CodeSnippet, ComplianceReport,
│                                 #   ComplianceViolation, ClassificationResult,
│                                 #   CriticVerdict, AgentThinkingStep, ExecutionRecord
│
├── ports/                        # Abstract interface layer
│   ├── ai_engine_port.py         # AIEnginePort ABC — evaluate_code / evaluate_code_stream
│   └── governance_port.py        # GovernancePort ABC — log_evaluation_event / log_human_override
│
├── adapters/                     # Concrete port implementations
│   ├── ibm.py                    # IBMAIEngine — Granite dual-agent + COS persistence
│   ├── local.py                  # LocalAIEngine — regex engine, MOCK_MODE fallback
│   └── watsonx_governance_adapter.py  # WatsonxGovernanceAdapter — lineage tracking via ibm-watsonx-ai SDK
│
├── backend/                      # Auth & data service (Node.js / Express)
│   ├── src/
│   │   ├── app.ts                # Express server bootstrap
│   │   ├── config/               # env, CORS, database, Passport config
│   │   ├── controllers/          # auth, findings, analytics, user controllers
│   │   ├── middleware/           # authenticate, validate, errorHandler
│   │   ├── routes/               # auth, findings, analytics, user route handlers
│   │   ├── services/             # auth, OAuth, token services
│   │   └── types/                # Shared TypeScript types
│   ├── prisma/                   # Prisma schema + migrations
│   └── package.json
│
├── frontend/                     # Next.js dashboard (React 19)
│   ├── app/
│   │   ├── page.tsx              # Landing page (public)
│   │   ├── agent/page.tsx        # Primary analysis workspace (protected)
│   │   ├── audit/page.tsx        # Governance audit console (protected)
│   │   ├── analytics/page.tsx    # KPI dashboards and trend charts (protected)
│   │   ├── export/page.tsx       # OpenAPI spec viewer and download
│   │   ├── docs/page.tsx         # Architecture blueprint
│   │   └── how-it-works/         # Pipeline explainer
│   ├── components/
│   │   ├── AnalysisFeed.tsx      # Streaming chat-style message thread
│   │   ├── ViolationCard.tsx     # Finding card with diff + patch download
│   │   └── layout/               # AppShell, TopBar, Sidebar, ThinkingDrawer
│   ├── lib/
│   │   ├── api.ts                # Axios singleton with Bearer token interceptors
│   │   ├── types.ts              # Canonical TypeScript domain interfaces
│   │   └── store/                # Zustand stores: auth, session, findings, theme
│   └── proxy.ts                  # Next.js edge middleware — route protection
│
├── Documentation/                # Extended design and architecture documents
├── Testing-example-files/        # Example source files for manual engine testing
└── deploy/                       # Deployment manifests (IBM Code Engine, etc.)
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
| `WATSONX_GOV_USE_CASE_ID` | watsonx.governance use case ID | N | `019f5c23-...` |
| `WATSONX_INVENTORY_ID` | watsonx.governance model inventory ID | N | `019f5c00-...` |
| `COS_API_KEY` | IBM COS API key for execution record persistence | N | `abc123...` |
| `COS_INSTANCE_CRN` | IBM COS service instance CRN | N | `crn:v1:bluemix:...` |
| `COS_ENDPOINT` | IBM COS regional endpoint | N | `https://s3.us-south.cloud-object-storage.appdomain.cloud` |
| `COS_BUCKET` | COS bucket name for execution records | N | `sentinel-records` |

### Auth Service (`backend/.env`)

| Variable | Description | Required | Example |
|---|---|---|---|
| `PORT` | Server port | N | `4000` |
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

# Run in MOCK_MODE (no credentials required)
docker run -p 8080:8080 -e MOCK_MODE=true sentinel-spec-engine

# Run with IBM Granite (production)
docker run -p 8080:8080 \
  -e MOCK_MODE=false \
  -e WATSONX_API_KEY=your_key \
  -e WATSONX_URL=https://us-south.ml.cloud.ibm.com \
  -e WATSONX_PROJECT_ID=your_project_id \
  sentinel-spec-engine
```

---

## API Reference

### Compliance Engine (`:8080`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/evaluate` | Synchronous compliance check — single-file or multi-file payload, returns `ComplianceReport` |
| `POST` | `/evaluate/stream` | SSE streaming — yields `AgentThinkingStep` events then final report |
| `POST` | `/override` | Log a human override or policy rejection to watsonx.governance |
| `GET` | `/compliance/matrix` | Returns all 22 rules with domain, severity, and rule ID |
| `GET` | `/analytics/summary` | Aggregated analytics (violation counts, trends, agent latency) |
| `GET` | `/health` | Liveness probe — `{"status": "ok", "engine": "...", "mock_mode": bool}` |

### Auth Service (`:4000`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate with email + password → JWT |
| `POST` | `/api/auth/register` | Register new user account |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/google` | Initiate Google OAuth 2.0 flow |
| `GET` | `/api/user/me` | Fetch authenticated user profile |
| `GET` | `/api/findings` | List governance findings (filterable by domain, tier, severity, date) |
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
