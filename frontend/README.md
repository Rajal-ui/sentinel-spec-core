# Sentinel Spec — Frontend

### Autonomous Architecture Compliance Dashboard for IBM Bob IDE

![Next.js](https://img.shields.io/badge/Next.js-16.2.10-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?style=flat-square&logo=tailwindcss)
![Zustand](https://img.shields.io/badge/Zustand-5.x-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Description

Sentinel Spec is an autonomous architecture-compliance reviewer that operates inside IBM Bob IDE at authorship time and as a blocking gate in CI/CD pipelines. The frontend application provides a real-time analysis workspace where engineers submit source files or code diffs and receive structured policy findings — each carrying a severity tier, confidence score, cited ADR, and a machine-generated inline fix — before a pull request is ever opened. Every finding, override decision, and approval action is written to an immutable governance lineage record in watsonx.governance, producing an auditor-ready decision trail that satisfies SOC 2, ISO 27001, and financial-services regulatory requirements.

The interface is architecturally decoupled from the backend analysis pipeline through a typed REST contract (`/v1/findings`, `/v1/analytics`, `/v1/findings/:id/resolve`), with all client state managed via Zustand persistent stores. Authentication is enforced at two layers — a Next.js edge middleware cookie check guards every protected route at the network boundary, while a client-side Axios interceptor injects Bearer tokens on every API request and purges credentials on any `401` response. This dual-layer model ensures the dashboard surface area is never reachable without a valid session regardless of client-side navigation method.

---

## Key Features

- **Real-Time Compliance Analysis Workspace:** Submit source files via drag-and-drop upload or direct code paste; the agent session engine pattern-matches against ADR rule templates, streams structured findings back, and maintains a versioned session history with per-tier violation counters (`blocking_count`, `warning_count`, `logged_only_count`).

- **Governance Audit Console:** Filter the full governance record ledger by policy domain (`security`, `data_residency`, `api_contract`, `architecture`), finding tier, confidence range, override status, and date window. Exports the filtered view to PDF via the browser print API with a single action.

- **Override Approval Workflow:** Compliance officers and engineering managers can submit, approve, or reject override requests against blocking findings directly from the Audit Console. Every state transition is persisted to the backend and reflected in real-time across all connected sessions.

- **Analytics & Trend Intelligence:** Time-series charts of blocking and warning violation volumes, domain-level breakdown bar charts, override-rate trend lines, and developer leaderboards are rendered via Recharts against live analytics API endpoints.

- **Full-File Patch Download:** When a finding is resolved, the Download Patch action reconstructs the complete corrected source file by applying the `diff_old → diff_new` substitution against the original ingested file content, then triggers a named browser download (e.g. `billing_fixed.py`).

- **OpenAPI Specification Export:** The Export page renders the live OpenAPI 3.1.0 spec for the Sentinel Spec backend API with syntax highlighting, one-click clipboard copy, and raw file download — enabling direct import into Postman, Insomnia, or IBM API Connect.

---

## Architecture & Data Flow

```
Browser Request
      │
      ▼
┌─────────────────────────────────┐
│  Next.js Edge Middleware        │  proxy.ts — cookie presence check
│  (Route Protection)             │  → redirect to /?login=1 if absent
└─────────────┬───────────────────┘
              │ authenticated
              ▼
┌─────────────────────────────────┐
│  Next.js App Router (React 19)  │  app/agent, app/audit, app/analytics
│  Client Components              │  app/export, app/profile, app/settings
└──────┬──────────────────────────┘
       │
       ├── Zustand Stores (persist)
       │     ├── useAuthStore      → user, token, modal state
       │     ├── useSessionStore   → analysis sessions, messages, findings
       │     ├── useFindingsStore  → governance record cache
       │     └── useThemeStore     → light / dark preference
       │
       └── Axios API Client (lib/api.ts)
             baseURL: NEXT_PUBLIC_AUTH_API_URL
             → Bearer token injection (request interceptor)
             → 401 credential purge (response interceptor)
             │
             ▼
        Backend REST API  (default: http://localhost:4000/api)
```

### Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.10 | App Router, SSR, edge middleware, route protection |
| React | 19.2.4 | UI component model, concurrent rendering |
| TypeScript | 5.x | Static typing, domain model contracts (`lib/types.ts`) |
| Tailwind CSS | 4.x | Utility-first styling, glassmorphic design system |
| Zustand | 5.0.14 | Client state management with `persist` middleware |
| Framer Motion | 12.x | Page transitions, animated finding cards, streaming cursor |
| Recharts | 3.x | Trend charts, domain bar charts, override-rate lines |
| Axios | 1.18.x | HTTP client with auth interceptors |
| React Hook Form | 7.x | Login, register, settings forms |
| Zod | 4.x | Runtime schema validation for form inputs |
| Lucide React | 1.x | Icon system |

---

## Project Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page (public)
│   ├── layout.tsx                # Root layout — theme init, AuthSyncProvider
│   ├── globals.css               # Design tokens, glass utilities, badge styles
│   ├── agent/
│   │   └── page.tsx              # Primary analysis workspace
│   ├── audit/
│   │   └── page.tsx              # Governance record audit console
│   ├── analytics/
│   │   └── page.tsx              # KPI dashboards and trend charts
│   ├── export/
│   │   └── page.tsx              # OpenAPI spec viewer and download
│   ├── dashboard/
│   │   └── page.tsx              # Redirect shim → /agent
│   ├── docs/
│   │   └── page.tsx              # Architecture blueprint and capability docs
│   ├── how-it-works/
│   │   └── page.tsx              # Pipeline explainer (public)
│   ├── ibm-integration/
│   │   └── page.tsx              # IBM services integration detail (public)
│   ├── profile/
│   │   └── page.tsx              # User profile management (protected)
│   └── settings/
│       └── page.tsx              # Account settings (protected)
│
├── components/
│   ├── AnalysisFeed.tsx          # Chat-style message thread with streaming support
│   ├── AnalysisResults.tsx       # Accordion findings list per agent message
│   ├── HistoryPanel.tsx          # Session history sidebar with metric chip strip
│   ├── ViolationCard.tsx         # Expandable finding card with diff and patch download
│   ├── AuthSyncProvider.tsx      # Hydrates auth state on mount
│   ├── ThemeInit.tsx             # Flicker-free theme injection (inline script)
│   ├── layout/
│   │   ├── AppShell.tsx          # Full-height shell: TopBar + Sidebar + main slot
│   │   ├── TopBar.tsx            # Live blocking/findings counters, nav links
│   │   ├── Sidebar.tsx           # Collapsible navigation sidebar
│   │   ├── LoginModal.tsx        # Auth modal (login + register tabs)
│   │   └── ThinkingDrawer.tsx    # Slide-out AI reasoning step visualiser
│   └── shared/
│       ├── CodeBlock.tsx         # Syntax-highlighted code with copy action
│       ├── ConfidenceBar.tsx     # Tier-coloured confidence percentage bar
│       ├── FindingCard.tsx       # Standalone finding display (audit page)
│       ├── Leaderboard.tsx       # Developer violation leaderboard table
│       ├── ShaderBackground.tsx  # Animated canvas background (landing page)
│       ├── StatsRow.tsx          # KPI metric strip (analytics page)
│       └── StatusBadge.tsx       # FindingTier and StatusType badge components
│
├── lib/
│   ├── api.ts                    # Axios singleton with Bearer token interceptors
│   ├── types.ts                  # Canonical TypeScript domain interfaces
│   ├── mock-data.ts              # Seeded mock findings and governance records
│   ├── useAuthSync.ts            # Hook: hydrate auth from API on mount
│   └── store/
│       ├── auth.ts               # Zustand auth store (user, token, modal)
│       ├── session.ts            # Zustand session store (messages, findings, history)
│       ├── findings.ts           # Zustand findings cache store
│       └── theme.ts              # Zustand theme store (light/dark)
│
├── public/                       # Static assets
├── proxy.ts                      # Next.js edge middleware — route protection
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript compiler options
└── package.json                  # Dependencies and scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x (or pnpm / yarn)
- A running instance of the Sentinel Spec backend API (default: `http://localhost:4000`)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/your-org/sentinel-spec.git
cd sentinel-spec/frontend
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.example .env.local
# Edit .env.local with your values (see Environment Configuration below)
```

**4. Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Configuration

| Variable Name | Description | Required | Example Value |
|---|---|---|---|
| `NEXT_PUBLIC_AUTH_API_URL` | Base URL for the Sentinel Spec backend REST API | **Y** | `http://localhost:4000/api` |

> **Note:** All variables prefixed with `NEXT_PUBLIC_` are inlined into the client bundle at build time. Do not store secrets in `NEXT_PUBLIC_` variables. The JWT token itself is managed client-side via Zustand persist + `sentinel-auth` cookie and never needs to be provided as an env variable.

---

## Usage

### Development server

```bash
npm run dev
# Starts Next.js dev server at http://localhost:3000
# Hot module replacement enabled — edit any file under app/ or components/ for instant refresh
```

### Production build

```bash
npm run build    # Compile and optimise for production
npm run start    # Start the production server
```

### Lint

```bash
npm run lint     # Run ESLint across the project
```

### Type checking

```bash
npx tsc --noEmit --skipLibCheck
# Validates all TypeScript without emitting output files
# Use --skipLibCheck to exclude .next/dev auto-generated route types
```

### Clearing the build cache

If the dev server returns unexpected 404s on valid routes, clear the Next.js compile cache and restart:

```bash
# macOS / Linux
rm -rf .next && npm run dev

# Windows (PowerShell)
Remove-Item -Recurse -Force .next; npm run dev
```

---

## Route Reference

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page — product overview and hero demo |
| `/how-it-works` | Public | Pipeline explainer |
| `/ibm-integration` | Public | IBM watsonx services integration detail |
| `/docs` | Public | Architecture blueprint and capability reference |
| `/export` | Public | OpenAPI 3.1.0 spec viewer and download |
| `/agent` | **Protected** | Primary compliance analysis workspace |
| `/audit` | **Protected** | Governance record audit console |
| `/analytics` | **Protected** | KPI dashboards and violation trend charts |
| `/profile` | **Protected** | User profile management |
| `/settings` | **Protected** | Account and notification settings |
| `/dashboard` | **Protected** | Redirect → `/agent` |

Protected routes are enforced by edge middleware in `proxy.ts`. Unauthenticated requests are redirected to `/?login=1&next=<intended-path>`.

---

## User Roles

| Role | Description |
|---|---|
| `developer` | Submit code for analysis; view own findings and session history |
| `compliance_officer` | Approve or reject override requests; full audit console access |
| `engineering_manager` | View analytics, leaderboards, and team-level governance reports |
| `admin` | Full access to all features and user management |

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`
2. Follow the existing code style — inline styles for layout metrics, Tailwind utilities for colour and interactive states
3. Keep changes minimal and traceable: every modified line should map directly to a stated requirement
4. Open a pull request against `main` with a clear description of what was changed and why

Please ensure `npm run lint` and `npx tsc --noEmit --skipLibCheck` pass with no new errors before submitting a PR.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](../LICENSE) for the full text.

---

<p align="center" style="font-size:12px; color:#6b7280;">Sentinel Spec &mdash; Built for IBM Bob IDE</p>
